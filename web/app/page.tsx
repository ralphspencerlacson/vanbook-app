import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";

export default function Home() {
  return (
    <AuthShell
      title="Welcome back"
      description="Sign in with your email and password."
    >
      <AuthForm mode="sign-in" />
    </AuthShell>
  );
}
