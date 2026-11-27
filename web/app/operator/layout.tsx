import { Suspense } from "react";
import { PublicShell } from "@/components/public-shell";
import { getOperator } from "@/lib/operators/portal";
import { SessionRefresh } from "@/components/session-refresh";
import { VanLoadingScreen } from "@/components/van-loading-screen";
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
      fallback={<VanLoadingScreen label="Checking your session" />}
    >
      <Authorized>{children}</Authorized>
    </Suspense>
  );
}
