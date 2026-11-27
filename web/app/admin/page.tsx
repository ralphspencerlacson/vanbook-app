import { Suspense } from "react";
import { requireWorkspace } from "@/lib/operators/server";
import { OperatorBusiness } from "@/components/operator-business";
import { AdminVerification } from "@/components/admin-verification";
import {
  AccessDenied,
  WorkspaceLoading,
  WorkspaceUnavailable,
} from "@/components/workspace-shell";
async function Content({ searchParams }: PageProps<"/admin">) {
  const actor = await requireWorkspace("/admin");
  if (!actor.ready) return <WorkspaceUnavailable admin />;
  if (actor.access?.role === "operator") return <OperatorBusiness />;
  if (!actor.isAdmin) return <AccessDenied />;
  return <AdminVerification actor={actor} params={await searchParams} />;
}
export default function Page(props: PageProps<"/admin">) {
  return (
    <Suspense fallback={<WorkspaceLoading />}>
      <Content {...props} />
    </Suspense>
  );
}
