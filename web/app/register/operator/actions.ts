"use server";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/auth/site-url";
import { readCredentials } from "@/lib/auth/forms";
import { parseDraft } from "@/lib/operators/validation";
import { readVehicle, photoPositions } from "@/lib/operators/vehicles";
import {
  readUploads,
  validateUploads,
  uploadOperatorFile,
} from "@/lib/operators/uploads";
export type RegistrationResult = {
  success?: boolean;
  message: string;
  errors?: Record<string, string>;
  applicationId?: string;
};
export async function registerOperator(
  form: FormData,
): Promise<RegistrationResult> {
  const { email, password, errors: credentials } = readCredentials(form, true);
  const { draft, errors: business } = parseDraft(form, true);
  const errors = { ...credentials, ...business };
  if (Object.keys(errors).length)
    return { message: "Please check the business and account fields.", errors };
  if (email.toLowerCase() === "admin@vanbook.ph")
    return {
      message: "Use a dedicated business email for an operator account.",
    };
  if (form.get("agreement") !== "on" || form.get("declaration") !== "on")
    return { message: "Accept both operator agreements before submitting." };
  let fleet;
  let files: ReturnType<typeof readUploads>;
  try {
    const keys: unknown = JSON.parse(String(form.get("vehicle_keys") ?? "[]"));
    if (
      !Array.isArray(keys) ||
      !keys.length ||
      keys.length > 5 ||
      new Set(keys).size !== keys.length ||
      keys.some((key) => !Number.isSafeInteger(key) || key < 0 || key > 999)
    )
      throw new Error("Add between one and five vehicles.");
    fleet = keys.map((key) => ({
      key,
      details: readVehicle(form, `vehicle:${key}:`, draft.operating_base),
    }));
    files = readUploads(form);
    await validateUploads(files);
    for (const vehicle of fleet)
      if (!files.some(([key]) => key === `photo:${vehicle.key}:front`))
        throw new Error("Upload a front photo for each vehicle.");
    if (
      files.filter(
        ([key]) => key.startsWith("document:") && key.split(":").length === 2,
      ).length > 12 ||
      fleet.some(
        (vehicle) =>
          files.filter(([key]) => key.startsWith(`document:${vehicle.key}:`))
            .length > 12,
      )
    )
      throw new Error("Upload up to 12 documents per user or van.");
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? error.message
          : "Check your vehicles and files.",
    };
  }
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return {
      message:
        "Operator registration is not configured yet. Please contact support.",
    };
  }
  const requirements = await admin
    .from("operator_document_requirements")
    .select()
    .eq("active", true);
  if (requirements.error)
    return { message: "Operator registration is temporarily unavailable." };
  const allowed = new Set([
    ...requirements.data.flatMap((item) =>
      item.scope === "van"
        ? fleet.map((vehicle) => `document:${vehicle.key}:${item.code}`)
        : [`document:${item.code}`],
    ),
    ...fleet.flatMap((vehicle) =>
      photoPositions.map((position) => `photo:${vehicle.key}:${position}`),
    ),
  ]);
  if (files.some(([key]) => !allowed.has(key)))
    return {
      message:
        "The document checklist changed. Refresh the page and try again.",
    };
  for (const item of requirements.data.filter((item) => item.required)) {
    const keys =
      item.scope === "van"
        ? fleet.map((vehicle) => `document:${vehicle.key}:${item.code}`)
        : [`document:${item.code}`];
    if (keys.some((name) => !files.some(([key]) => key === name)))
      return {
        message: `Upload ${item.label}${item.scope === "van" ? " for each van" : ""} before submitting.`,
      };
  }
  const requestHeaders = await headers();
  const ip =
    requestHeaders.get("x-vercel-forwarded-for") ??
    requestHeaders.get("x-forwarded-for") ??
    "local";
  for (const value of ["ip:" + ip, "email:" + email.toLowerCase()]) {
    const limit = await admin.rpc("check_registration_limit", {
      p_key: createHash("sha256").update(value).digest("hex"),
    });
    if (limit.error || !limit.data)
      return {
        message:
          "Too many attempts. Please wait 15 minutes before trying again.",
      };
  }
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: false,
    user_metadata: { account_type: "operator", full_name: draft.contact_name },
  });
  if (created.error || !created.data.user)
    return {
      message:
        "We couldn't register this address. If you already registered, sign in or use password recovery.",
    };
  const owner = created.data.user.id;
  const paths: string[] = [];
  let applicationId = "";
  try {
    const app = await admin
      .from("operator_applications")
      .insert({ owner_id: owner, ...draft })
      .select("id")
      .single();
    if (app.error) throw new Error("application");
    applicationId = app.data.id;
    for (const [key, file] of files.filter(
      ([key]) => key.startsWith("document:") && key.split(":").length === 2,
    )) {
      const uploaded = await uploadOperatorFile(
        admin,
        owner,
        applicationId,
        file,
      );
      paths.push(uploaded.storage_path);
      const saved = await admin.from("operator_documents").insert({
        application_id: applicationId,
        category: key.slice(9),
        ...uploaded,
      });
      if (saved.error) throw new Error("document");
    }
    for (const vehicle of fleet) {
      const record = await admin
        .from("operator_vehicles")
        .insert({ operator_id: owner, ...vehicle.details })
        .select("id")
        .single();
      if (record.error) throw new Error("vehicle");
      for (const item of requirements.data.filter(
        (item) => item.scope === "van",
      )) {
        const file = files.find(
          ([key]) => key === `document:${vehicle.key}:${item.code}`,
        )?.[1];
        if (!file) continue;
        const uploaded = await uploadOperatorFile(
          admin,
          owner,
          applicationId,
          file,
        );
        paths.push(uploaded.storage_path);
        const saved = await admin.from("operator_documents").insert({
          application_id: applicationId,
          vehicle_id: record.data.id,
          category: item.code,
          ...uploaded,
        });
        if (saved.error) throw new Error("vehicle document");
      }
      for (const position of photoPositions) {
        const file = files.find(
          ([key]) => key === `photo:${vehicle.key}:${position}`,
        )?.[1];
        if (!file) continue;
        const uploaded = await uploadOperatorFile(
          admin,
          owner,
          applicationId,
          file,
        );
        paths.push(uploaded.storage_path);
        const photo = await admin
          .from("operator_vehicle_photos")
          .insert({ vehicle_id: record.data.id, position, ...uploaded });
        if (photo.error) throw new Error("photo");
      }
    }
    const final = await admin.rpc("finalize_operator_registration", {
      p_id: applicationId,
    });
    if (final.error) throw new Error("finalize");
  } catch {
    // A transport error can happen after commit. Never roll back a submission
    // unless a fresh read confirms it is still this request's unfinished draft.
    const check = applicationId
      ? await admin
          .from("operator_applications")
          .select("status")
          .eq("id", applicationId)
          .maybeSingle()
      : { data: null, error: null };
    if (check.error)
      return {
        message:
          "We couldn't confirm your submission. Try signing in after verifying your email, or contact support.",
      };
    if (check.data?.status !== "submitted") {
      const cleanup = paths.length
        ? await admin.storage.from("operator-documents").remove(paths)
        : { error: null };
      if (!cleanup.error) await admin.auth.admin.deleteUser(owner);
      return {
        message:
          "We couldn't finish registration. Please try again. Contact support if the email is already registered.",
      };
    }
  }
  try {
    const callback = new URL("/auth/callback", getSiteUrl());
    callback.searchParams.set("next", "/operator");
    await (
      await createClient()
    ).auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: callback.toString() },
    });
  } catch {
    /* The success page includes resend instructions if delivery fails. */
  }
  return {
    success: true,
    applicationId,
    message:
      "Application submitted. Verify your email to sign in and track the review.",
  };
}
