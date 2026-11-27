import { Suspense } from "react";
import { getActor } from "@/lib/operators/server";
import { AdminFrame } from "@/components/admin-shell";
import { WorkspaceLoading } from "@/components/workspace-shell";

async function AuthorizedLayout({ children }: { children: React.ReactNode }) {
  const actor = await getActor();
  // Individual pages still authorize every query and mutation. Operators retain
  // their business workspace; only administrators receive this navigation.
  if (!actor.isAdmin) return children;
  const waiting = await actor.supabase
    .from("operator_applications")
    .select("id", { count: "exact", head: true })
    .eq("status", "submitted");
  return (
    <AdminFrame waiting={waiting.error ? undefined : waiting.count ?? 0}>
      {children}
    </AdminFrame>
  );
}

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <Suspense fallback={<WorkspaceLoading />}>
      <AuthorizedLayout>{children}</AuthorizedLayout>
    </Suspense>
  );
}
