import Link from "next/link";
import { Suspense } from "react";
import { PublicShell } from "@/components/public-shell";
import { ApplicationTimeline } from "@/components/operator-status";
import { isUuid } from "@/lib/operators/types";
async function Confirmation({
  searchParams,
}: PageProps<"/register/operator/success">) {
  const { application } = await searchParams;
  const reference =
    typeof application === "string" && isUuid(application)
      ? `OP-${application.slice(0, 8).toUpperCase()}`
      : undefined;
  return (
    <main className="site-container operator-status-page">
      <section className="operator-submitted-hero">
        <span aria-hidden="true">◷</span>
        <h1>Application submitted</h1>
        <p>
          We’ll review your business, documents, and vehicles. Confirm your
          email to sign in and follow the review.
        </p>
        {reference && <small>Application {reference}</small>}
      </section>
      <ApplicationTimeline />
      <p className="operator-pending-banner">
        Open the confirmation email in this browser. If it hasn’t arrived, use
        “Resend confirmation email” on the sign-in page.
      </p>
      <div className="operator-status-actions">
        <Link className="site-button" href="/sign-in?next=%2Foperator">
          Sign in to view application
        </Link>
        <Link className="site-outline-button" href="/operator/application">
          Edit application
        </Link>
      </div>
    </main>
  );
}
export default function Page(props: PageProps<"/register/operator/success">) {
  return (
    <PublicShell operator>
      <Suspense
        fallback={
          <p className="operator-loading" role="status">
            Loading confirmation…
          </p>
        }
      >
        <Confirmation {...props} />
      </Suspense>
    </PublicShell>
  );
}
