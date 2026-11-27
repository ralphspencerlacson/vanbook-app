"use server";
import { revalidatePath } from "next/cache";
import { getActor } from "@/lib/operators/server";
import { isUuid } from "@/lib/operators/types";
import { parseDraft, operationError } from "@/lib/operators/validation";
import { readVehicle, photoPositions } from "@/lib/operators/vehicles";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  readUploads,
  validateUploads,
  uploadOperatorFile,
  cleanUnreferencedUploads,
} from "@/lib/operators/uploads";
type Result = { success?: boolean; message: string };
function refresh(application: string) {
  revalidatePath("/operator", "layout");
  revalidatePath("/admin");
  revalidatePath(`/admin/operators/${application}`);
}
export async function resubmitApplication(form: FormData): Promise<Result> {
  const id = String(form.get("id") ?? "");
  const version = Number(form.get("version"));
  if (!isUuid(id) || !Number.isSafeInteger(version) || version < 1)
    return { message: "Refresh the application before saving." };
  const parsed = parseDraft(form, true);
  if (Object.keys(parsed.errors).length)
    return { message: "Complete all required business and contact details." };
  let files;
  try {
    files = readUploads(form);
    if (files.some(([key]) => !key.startsWith("document:")))
      throw new Error("Choose supporting documents only.");
    await validateUploads(files);
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : "Check your files.",
    };
  }
  const actor = await getActor();
  if (!actor.user || !actor.ready || actor.access?.role !== "operator")
    return {
      message: "Sign in with your operator account to edit the application.",
    };
  const [application, requirements] = await Promise.all([
    actor.supabase
      .from("operator_applications")
      .select("id,status")
      .eq("id", id)
      .eq("owner_id", actor.user.id)
      .maybeSingle(),
    actor.supabase
      .from("operator_document_requirements")
      .select()
      .eq("active", true),
  ]);
  if (
    application.error ||
    requirements.error ||
    !application.data ||
    !["draft", "submitted", "changes_requested"].includes(
      application.data.status,
    )
  )
    return { message: "This application is unavailable for editing." };
  if (
    files.some(
      ([key]) =>
        !requirements.data.some((item) => key === `document:${item.code}`),
    )
  )
    return { message: "The checklist changed. Refresh before uploading." };
  let admin;
  const paths: string[] = [];
  try {
    admin = createAdminClient();
    const documents = [];
    for (const [key, file] of files) {
      const uploaded = await uploadOperatorFile(admin, actor.user.id, id, file);
      paths.push(uploaded.storage_path);
      documents.push({ category: key.slice(9), ...uploaded });
    }
    const result = await actor.supabase.rpc("operator_resubmit_application", {
      p_id: id,
      p_version: version,
      p_details: parsed.draft,
      p_documents: documents,
    });
    if (result.error) {
      await cleanUnreferencedUploads(admin, paths);
      return {
        message:
          result.error.code === "P0001"
            ? "Complete all required documents and replace every file marked for resubmission."
            : operationError(result.error),
      };
    }
    refresh(id);
    return {
      success: true,
      message:
        "Application updated and resubmitted. Your operator update is visible to administrators.",
    };
  } catch {
    if (admin) await cleanUnreferencedUploads(admin, paths).catch(() => {});
    return {
      message:
        "We couldn't save the update. Your entries are still here. Please try again.",
    };
  }
}
export async function saveVehicle(form: FormData): Promise<Result> {
  const id = String(form.get("id") ?? "");
  const version = Number(form.get("version") ?? "0");
  if (
    (id && !isUuid(id)) ||
    !Number.isSafeInteger(version) ||
    (id && version < 1)
  )
    return { message: "Refresh your vehicle before saving." };
  let details, files;
  try {
    details = readVehicle(form);
    files = readUploads(form);
    if (
      files.some(
        ([key]) =>
          !photoPositions.some((position) => key === `photo:van:${position}`),
      )
    )
      throw new Error("Choose valid vehicle photos.");
    await validateUploads(files);
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? error.message
          : "Check your vehicle and photos.",
    };
  }
  const actor = await getActor();
  if (!actor.user || !actor.ready || actor.access?.role !== "operator")
    return { message: "Operator sign-in is required." };
  const application = await actor.supabase
    .from("operator_applications")
    .select("id")
    .eq("owner_id", actor.user.id)
    .maybeSingle();
  if (application.error || !application.data)
    return { message: "Your application is unavailable." };
  if (id) {
    const vehicle = await actor.supabase.rpc("get_managed_vehicles", {
      p_id: id,
    });
    if (vehicle.error || !vehicle.data?.length)
      return { message: "Vehicle not found or access denied." };
  }
  let admin;
  const paths: string[] = [];
  try {
    admin = createAdminClient();
    const photos = [];
    for (const [key, file] of files) {
      const uploaded = await uploadOperatorFile(
        admin,
        actor.user.id,
        application.data.id,
        file,
      );
      paths.push(uploaded.storage_path);
      photos.push({ position: key.split(":").at(-1), ...uploaded });
    }
    const result = await actor.supabase.rpc("save_operator_vehicle", {
      p_id: id || null,
      p_version: version,
      p_details: details,
      p_photos: photos,
    });
    if (result.error) {
      await cleanUnreferencedUploads(admin, paths);
      return { message: operationError(result.error) };
    }
    refresh(application.data.id);
    return {
      success: true,
      message:
        "Vehicle saved for review. Availability requires operator and vehicle approval.",
    };
  } catch {
    if (admin) await cleanUnreferencedUploads(admin, paths).catch(() => {});
    return {
      message:
        "We couldn't save your vehicle. Your entries are still here. Please try again.",
    };
  }
}
export async function setVehicleAvailability(
  id: string,
  version: number,
  available: boolean,
): Promise<Result> {
  if (
    !isUuid(id) ||
    !Number.isSafeInteger(version) ||
    version < 1 ||
    typeof available !== "boolean"
  )
    return { message: "Refresh your vehicle list before trying again." };
  const actor = await getActor();
  if (!actor.user || actor.access?.role !== "operator" || !actor.ready)
    return { message: "Operator sign-in is required." };
  const result = await actor.supabase.rpc("set_vehicle_availability", {
    p_id: id,
    p_version: version,
    p_available: available,
  });
  if (result.error) return { message: operationError(result.error) };
  revalidatePath("/operator/vans");
  return {
    success: true,
    message: available
      ? "Vehicle is available for requests."
      : "Vehicle is unavailable for requests.",
  };
}
