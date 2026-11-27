import { Suspense } from "react";
import { connection } from "next/server";
import { PublicShell } from "@/components/public-shell";
import { OperatorRegistrationForm } from "@/components/operator-registration-form";
import { createAdminClient, hasAdminKey } from "@/lib/supabase/admin";
import type { DocumentRequirement } from "@/lib/operators/types";
async function Registration() {
  await connection();
  if (!hasAdminKey())
    return (
      <p className="operator-panel" role="alert">
        Operator registration is not configured yet. Please contact VANBOOK PH
        support.
      </p>
    );
  const { data, error } = await createAdminClient()
    .from("operator_document_requirements")
    .select()
    .eq("active", true)
    .order("sort_order")
    .order("label");
  if (error)
    return (
      <p className="operator-panel" role="alert">
        Operator registration is not available yet. Please try again later.
      </p>
    );
  return (
    <OperatorRegistrationForm requirements={data as DocumentRequirement[]} />
  );
}
export default function Page() {
  return (
    <PublicShell operator>
      <main className="site-container operator-registration-page">
        <header className="operator-page-heading">
          <span className="site-small-label">BECOME A VANBOOK OPERATOR</span>
          <h1>Register your vans</h1>
          <p>
            Tell us about your business, upload your documents, and add your
            vehicles for review.
          </p>
        </header>
        <Suspense fallback={<p role="status">Loading registration…</p>}>
          <Registration />
        </Suspense>
      </main>
    </PublicShell>
  );
}
