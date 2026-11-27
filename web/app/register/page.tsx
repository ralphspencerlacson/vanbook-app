import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
import { safeNext } from "@/lib/auth/forms";

async function RegisterContent({ searchParams }: PageProps<"/register">) {
  const params = await searchParams;
  return <AuthForm mode="register" next={safeNext(params.next)} />;
}

export default function RegisterPage(props: PageProps<"/register">) {
  return (
    <AuthShell
      title="Create your account"
      description="We'll send a confirmation link to your email. Confirm your address to finish signing up."
    >
      <Suspense fallback={<p role="status">Loading registration…</p>}>
        <RegisterContent {...props} />
      </Suspense>
    </AuthShell>
  );
}
