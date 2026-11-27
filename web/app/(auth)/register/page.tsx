import { Suspense } from "react";
import { AuthCardContent } from "@/components/auth-shell";
import { CustomerRegistrationPreview } from "@/components/customer-registration-preview";
import { redirectSignedIn } from "@/lib/auth/guest";

async function RegistrationContent() {
  await redirectSignedIn();
  return (
    <AuthCardContent
      title="Create your account"
      description="Your next group journey starts here."
    >
      <CustomerRegistrationPreview />
    </AuthCardContent>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<p role="status">Checking your session…</p>}>
      <RegistrationContent />
    </Suspense>
  );
}
