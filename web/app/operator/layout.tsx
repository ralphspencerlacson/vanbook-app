import { Suspense } from "react";
import { PublicShell } from "@/components/public-shell";
import { getOperator } from "@/lib/operators/portal";
import { SessionRefresh } from "@/components/session-refresh";
async function Authorized({ children }: { children: React.ReactNode }) {
  const actor = await getOperator();
  return (
    <PublicShell operator name={actor.application.business_name}>
      <SessionRefresh />
      {children}
    </PublicShell>
  );
}
export default function Layout({ children }: LayoutProps<"/operator">) {
  return (
    <Suspense
      fallback={
        <p className="operator-loading" role="status">
          Loading your operator portal…
        </p>
      }
    >
      <Authorized>{children}</Authorized>
    </Suspense>
  );
}
