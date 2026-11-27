import { AuthCardContent } from "@/components/auth-shell";
import { CustomerRegistrationPreview } from "@/components/customer-registration-preview";
export default function RegisterPage() {
  return (
    <AuthCardContent
      title="Create your account"
      description="Your next group journey starts here."
    >
      <CustomerRegistrationPreview />
    </AuthCardContent>
  );
}
