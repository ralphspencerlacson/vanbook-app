"use server";
import { revalidatePath } from "next/cache";
import { getActor } from "@/lib/operators/server";
import { isUuid, type OperatorActionResult } from "@/lib/operators/types";
import { operationError } from "@/lib/operators/validation";

export async function reviewApplication(
  id: string,
  version: number,
  decision: string,
  note: string,
): Promise<OperatorActionResult> {
  if (
    typeof note !== "string" ||
    !isUuid(id) ||
    !Number.isSafeInteger(version) ||
    version < 1 ||
    !["approved", "changes_requested", "rejected"].includes(decision)
  )
    return { message: "Choose a valid review decision." };
  if (note.length > 3000 || (decision !== "approved" && !note.trim()))
    return {
      message:
        "Explain the requested changes or rejection in the review note (up to 3,000 characters).",
    };
  try {
    const actor = await getActor();
    if (!actor.user || !actor.isAdmin || !actor.ready)
      return { message: "Administrator access is required." };
    const result = await actor.supabase.rpc("review_operator_application", {
      p_id: id,
      p_version: version,
      p_decision: decision,
      p_note: note.trim(),
    });
    if (result.error) return { message: operationError(result.error) };
    const application = Array.isArray(result.data)
      ? result.data[0]
      : result.data;
    if (!application?.id)
      return {
        message:
          "We couldn't confirm the decision. Reload the application before trying again.",
      };
    revalidatePath("/admin");
    revalidatePath(`/admin/operators/${id}`);
    revalidatePath("/operator");
    return { success: true, application, message: "Review decision saved." };
  } catch {
    return { message: operationError({}) };
  }
}
export async function saveRequirement(
  form: FormData,
): Promise<OperatorActionResult> {
  if (!(form instanceof FormData))
    return { message: "Enter a valid document requirement." };
  const code = String(form.get("code") ?? "").trim();
  const label = String(form.get("label") ?? "").trim();
  if (!/^[a-z][a-z0-9_]{0,63}$/.test(code) || !label || label.length > 150)
    return {
      message:
        "Enter a document label (up to 150 characters). Refresh the page if the requirement still cannot be saved.",
    };
  try {
    const actor = await getActor();
    if (!actor.user || !actor.isAdmin || !actor.ready)
      return { message: "Administrator access is required." };
    const result = await actor.supabase.from("operator_document_requirements").upsert(
      {
        code,
        label,
        required: form.get("required") === "true",
        active: form.get("active") !== "false",
      },
      { onConflict: "code" },
    );
    if (result.error) return { message: operationError(result.error) };
    revalidatePath("/admin/documents");
    revalidatePath("/operator");
    return { success: true, message: "Document checklist updated." };
  } catch {
    return { message: operationError({}) };
  }
}
