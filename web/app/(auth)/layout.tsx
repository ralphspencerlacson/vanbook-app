import { AuthFrame } from "@/components/auth-shell";
import { AuthAccessCard } from "@/components/auth-access-card";
import { SessionRefresh } from "@/components/session-refresh";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthFrame>
      <SessionRefresh />
      <AuthAccessCard>{children}</AuthAccessCard>
    </AuthFrame>
  );
}
