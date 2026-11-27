import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
import { safeNext } from "@/lib/auth/forms";

const notices: Record<string, string> = {
  "operator-pending": "Email verified. Operator sign-in is available only after administrator approval.",
  "permissions-unavailable": "Account permissions are not configured yet. Please contact VANBOOK PH support.",
  "signed-out": "You have signed out of this browser.",
  "session-expired": "Please sign in to continue.",
  "confirm-email":
    "Confirm your email using the link in your inbox before signing in. You can resend it below.",
  "confirmation-failed":
    "That confirmation link may have expired, already been used, or been opened in another browser. Try signing in; if your email is still unconfirmed, resend the confirmation below.",
};

async function SignInContent({ searchParams }: PageProps<"/sign-in">) {
  const params = await searchParams;
  const notice =
    typeof params.notice === "string" ? notices[params.notice] : undefined;
  return (
    <AuthForm mode="sign-in" next={safeNext(params.next)} notice={notice} />
  );
}

export default function SignInPage(props: PageProps<"/sign-in">) {
  return (
    <AuthShell
      title="Welcome back"
      description="Sign in with your email and password."
    >
      <Suspense fallback={<p role="status">Loading sign-in…</p>}>
        <SignInContent {...props} />
      </Suspense>
    </AuthShell>
  );
}
