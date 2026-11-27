import { Suspense } from "react";
import { connection } from "next/server";
import { PublicShell } from "@/components/public-shell";
import { OperatorRegistrationForm } from "@/components/operator-registration-form";
import { OperatorRegistrationLoading } from "@/components/operator-registration-loading";
import { createAdminClient, hasAdminKey } from "@/lib/supabase/admin";
import type { DocumentRequirement } from "@/lib/operators/types";
function RegistrationHeading() {
  return (
    <header className="operator-page-heading">
      <span className="site-small-label">BECOME A VANBOOK OPERATOR</span>
      <h1>Register your vans</h1>
      <p>
        Only LTFRB-franchised operators can list. Submit your business,
        documents, and vehicles for review.
      </p>
    </header>
  );
}
async function Registration() {
  await connection();
  if (!hasAdminKey())
    return (
      <div className="operator-registration-unavailable">
        <RegistrationHeading />
        <p className="operator-panel" role="alert">
          Operator registration is not configured yet. Please contact VANBOOK PH
          support.
        </p>
      </div>
    );
  const { data, error } = await createAdminClient()
    .from("operator_document_requirements")
    .select()
    .eq("active", true)
    .order("sort_order")
    .order("label");
  if (error)
    return (
      <div className="operator-registration-unavailable">
        <RegistrationHeading />
        <p className="operator-panel" role="alert">
          Operator registration is not available yet. Please try again later.
        </p>
      </div>
    );
  return (
    <OperatorRegistrationForm
      requirements={data as DocumentRequirement[]}
      heading={<RegistrationHeading />}
    />
  );
}
export default function Page() {
  return (
    <PublicShell operator className="operator-registration-site" footer={false}>
      <main className="site-container operator-registration-page">
        <Suspense fallback={
          <OperatorRegistrationLoading heading={<RegistrationHeading />} />
        }>
          <Registration />
        </Suspense>
      </main>
    </PublicShell>
  );
}
