"use server";
import { revalidatePath } from "next/cache";
import { getActor } from "@/lib/operators/server";
import {
  canEdit,
  isUuid,
  type OperatorActionResult,
} from "@/lib/operators/types";
import { operationError, parseDraft } from "@/lib/operators/validation";

export async function createApplication(): Promise<OperatorActionResult> {
  try {
    const actor = await getActor();
    if (!actor.user)
      return { message: "Please sign in before starting an application." };
    if (!actor.ready)
      return { message: "This workspace is not available yet." };
    const result = await actor.supabase
      .from("operator_applications")
      .insert({ owner_id: actor.user.id })
      .select()
      .single();
    if (result.error?.code === "23505") return { success: true };
    if (result.error) return { message: operationError(result.error) };
    revalidatePath("/operator");
    return { success: true, application: result.data };
  } catch {
    return { message: "We couldn't start your application. Please try again." };
  }
}
export async function saveApplication(
  id: string,
  version: number,
  form: FormData,
  submitting = false,
): Promise<OperatorActionResult> {
  if (!(form instanceof FormData))
    return { message: "Enter valid application details." };
  if (!isUuid(id) || !Number.isSafeInteger(version) || version < 1)
    return { message: "Refresh the application before saving." };
  const { draft, errors } = parseDraft(form, submitting);
  if (Object.keys(errors).length)
    return { errors, message: "Please check the highlighted fields." };
  try {
    const actor = await getActor();
    if (!actor.user || !actor.ready)
      return { message: "Please sign in to continue." };
    const result = await actor.supabase
      .from("operator_applications")
      .update(draft)
      .eq("id", id)
      .eq("owner_id", actor.user.id)
      .eq("version", version)
      .in("status", ["draft", "changes_requested"])
      .select()
      .maybeSingle();
    if (result.error) return { message: operationError(result.error) };
    if (!result.data) return { message: operationError({ code: "40001" }) };
    revalidatePath("/operator");
    return { success: true, message: "Draft saved.", application: result.data };
  } catch {
    return { message: operationError({}) };
  }
}
export async function submitApplication(
  id: string,
  version: number,
): Promise<OperatorActionResult> {
  if (!isUuid(id) || !Number.isSafeInteger(version) || version < 1)
    return { message: "Refresh the application before submitting." };
  try {
    const actor = await getActor();
    if (!actor.user || !actor.ready)
      return { message: "Please sign in to continue." };
    const result = await actor.supabase.rpc("submit_operator_application", {
      p_id: id,
      p_version: version,
    });
    if (result.error) return { message: operationError(result.error) };
    const application = Array.isArray(result.data)
      ? result.data[0]
      : result.data;
    if (!application?.id)
      return {
        message:
          "We couldn't confirm the submission. Reload the current status before trying again.",
      };
    revalidatePath("/operator");
    revalidatePath("/admin");
    return {
      success: true,
      message: "Your application has been submitted for review.",
      application,
    };
  } catch {
    return { message: operationError({}) };
  }
}
export async function registerDocument(input: {
  applicationId: string;
  path: string;
  category: string;
  fileName: string;
  contentType: string;
  size: number;
}): Promise<OperatorActionResult> {
  if (
    !input ||
    typeof input !== "object" ||
    ![
      input.applicationId,
      input.path,
      input.category,
      input.fileName,
      input.contentType,
    ].every((value) => typeof value === "string") ||
    !isUuid(input.applicationId) ||
    !input.path ||
    input.path.length > 500 ||
    !input.category ||
    input.category.length > 64 ||
    !input.fileName ||
    input.fileName.length > 255 ||
    !["application/pdf", "image/png", "image/jpeg"].includes(
      input.contentType,
    ) ||
    !Number.isSafeInteger(input.size) ||
    input.size < 1 ||
    input.size > 10485760
  )
    return { message: "Choose a PDF, PNG, or JPEG file up to 10 MB." };
  try {
    const actor = await getActor();
    if (
      !actor.user ||
      !actor.ready ||
      !input.path.startsWith(`${actor.user.id}/${input.applicationId}/`)
    )
      return { message: "You don't have permission to add this document." };
    const result = await actor.supabase.from("operator_documents").insert({
      application_id: input.applicationId,
      storage_path: input.path,
      category: input.category,
      file_name: input.fileName,
      content_type: input.contentType,
      size_bytes: input.size,
    });
    if (result.error) return { message: operationError(result.error) };
    revalidatePath("/operator");
    return { success: true };
  } catch {
    return { message: operationError({}) };
  }
}
export async function removeDocumentRecord(
  id: string,
): Promise<OperatorActionResult> {
  if (!isUuid(id)) return { message: "This document could not be found." };
  try {
    const actor = await getActor();
    if (!actor.user || !actor.ready)
      return { message: "Please sign in to continue." };
    const record = await actor.supabase
      .from("operator_documents")
      .select("id,application_id,storage_path")
      .eq("id", id)
      .maybeSingle();
    if (record.error || !record.data)
      return { message: "This document could not be found." };
    const application = await actor.supabase
      .from("operator_applications")
      .select("owner_id,status")
      .eq("id", record.data.application_id)
      .single();
    if (
      application.error ||
      application.data.owner_id !== actor.user.id ||
      !canEdit(application.data.status)
    )
      return { message: "This application is locked for review." };
    const removed = await actor.supabase.storage
      .from("operator-documents")
      .remove([record.data.storage_path]);
    if (removed.error)
      return { message: "We couldn't remove the file. Please try again." };
    const result = await actor.supabase
      .from("operator_documents")
      .delete()
      .eq("id", id)
      .select("id");
    if (result.error || !result.data?.length)
      return {
        message:
          "We couldn't finish removing this document. Refresh and try again.",
      };
    revalidatePath("/operator");
    return { success: true };
  } catch {
    return { message: operationError({}) };
  }
}
