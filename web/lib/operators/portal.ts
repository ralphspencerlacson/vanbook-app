import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { requireWorkspace } from "./server";
import type {
  OperatorApplication,
  ApplicationDocument,
  DocumentRequirement,
} from "./types";
export const getOperator = cache(async () => {
  const actor = await requireWorkspace("/operator");
  if (!actor.ready)
    throw new Error(
      "Account permissions are unavailable. Please contact support.",
    );
  if (actor.access?.role !== "operator")
    redirect(actor.isAdmin ? "/admin" : "/account");
  const result = await actor.supabase
    .from("operator_applications")
    .select()
    .eq("owner_id", actor.user.id)
    .maybeSingle();
  if (result.error || !result.data)
    throw new Error(
      "Your application could not be loaded. Please contact support.",
    );
  return { ...actor, application: result.data as OperatorApplication };
});
export async function getOperatorDocuments() {
  const actor = await getOperator();
  const [documents, requirements] = await Promise.all([
    actor.supabase
      .from("operator_documents")
      .select()
      .eq("application_id", actor.application.id)
      .order("created_at", { ascending: false }),
    actor.supabase
      .from("operator_document_requirements")
      .select()
      .eq("active", true)
      .order("sort_order")
      .order("label"),
  ]);
  if (documents.error || requirements.error)
    throw new Error("Unable to load your document checklist.");
  return {
    ...actor,
    documents: documents.data as ApplicationDocument[],
    requirements: requirements.data as DocumentRequirement[],
  };
}
