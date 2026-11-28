import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getOperatorDocuments } from "@/lib/operators/portal";
import { OperatorStatus } from "@/components/operator-status";
import { LoginArrival } from "@/components/login-transition";
async function Content() {
  const actor = await getOperatorDocuments();
  if (actor.application.status === "approved") redirect("/operator/requests");
  return (
    <>
      <LoginArrival />
      <OperatorStatus
        application={actor.application}
        documents={actor.documents}
        requirements={actor.requirements}
        vehicles={actor.vehicles}
      />
    </>
  );
}
export default function Page() {
  return (
    <Suspense
      fallback={
        <p className="operator-loading" role="status">
          Loading application status…
        </p>
      }
    >
      <Content />
    </Suspense>
  );
}
