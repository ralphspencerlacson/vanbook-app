import { Suspense } from "react";
import { requireWorkspace } from "@/lib/operators/server";
import type { DocumentRequirement } from "@/lib/operators/types";
import {
  WorkspaceShell,
  WorkspaceLoading,
  WorkspaceUnavailable,
  AccessDenied,
} from "@/components/workspace-shell";
import { DocumentRequirementsForm } from "@/components/document-requirements-form";

async function RequirementsContent() {
  const actor = await requireWorkspace("/admin/documents");
  if (!actor.ready) return <WorkspaceUnavailable admin />;
  if (!actor.isAdmin) return <AccessDenied />;
  const result = await actor.supabase
    .from("operator_document_requirements")
    .select()
    .order("sort_order")
    .order("label");
  if (result.error) throw new Error("Unable to load document requirements.");
  return (
    <WorkspaceShell
      title="Document checklist"
      description="Set the supporting documents needed for operator business review."
      admin
      superAdmin={actor.isSuperAdmin}
    >
      <DocumentRequirementsForm
        requirements={result.data as DocumentRequirement[]}
      />
    </WorkspaceShell>
  );
}
export default function RequirementsPage() {
  return (
    <Suspense fallback={<WorkspaceLoading />}>
      <RequirementsContent />
    </Suspense>
  );
}
