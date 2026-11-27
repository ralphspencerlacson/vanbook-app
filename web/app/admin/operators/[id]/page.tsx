import { Suspense } from "react";
import { requireWorkspace } from "@/lib/operators/server";
import { AdminVerification } from "@/components/admin-verification";
import {
  AccessDenied,
  WorkspaceLoading,
  WorkspaceUnavailable,
} from "@/components/workspace-shell";
async function Content({
  params,
  searchParams,
}: PageProps<"/admin/operators/[id]">) {
  const { id } = await params;
  const actor = await requireWorkspace("/admin/operators/" + id);
  if (!actor.ready) return <WorkspaceUnavailable admin />;
  if (!actor.isAdmin) return <AccessDenied />;
  return (
    <AdminVerification
      actor={actor}
      params={await searchParams}
      selectedId={id}
    />
  );
}
export default function Page(props: PageProps<"/admin/operators/[id]">) {
  return (
    <Suspense fallback={<WorkspaceLoading />}>
      <Content {...props} />
    </Suspense>
  );
}
