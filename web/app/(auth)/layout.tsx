import { AuthFrame } from "@/components/auth-shell";
import { AuthAccessCard } from "@/components/auth-access-card";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthFrame>
      <AuthAccessCard>{children}</AuthAccessCard>
    </AuthFrame>
  );
}
