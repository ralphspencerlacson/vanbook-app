import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireWorkspace } from "@/lib/operators/server";
import { AdminVerification } from "@/components/admin-verification";
import {
  AccessDenied,
  WorkspaceLoading,
  WorkspaceUnavailable,
} from "@/components/workspace-shell";
async function Content({ searchParams }: PageProps<"/admin">) {
  const actor = await requireWorkspace("/admin");
  if (!actor.ready) return <WorkspaceUnavailable admin />;
  if (actor.access?.role === "operator") redirect("/operator");
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
