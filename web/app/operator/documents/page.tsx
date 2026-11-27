import { Suspense } from "react";
import Link from "next/link";
import { getOperatorDocuments } from "@/lib/operators/portal";
import { OperatorWorkspace } from "@/components/operator-workspace";
import { OperatorDocumentStatus } from "@/components/operator-status";
import { LoginArrival } from "@/components/login-transition";
async function Content() {
  const actor = await getOperatorDocuments();
  return (
    <OperatorWorkspace
      title="Documents"
      approved={actor.application.status === "approved"}
      toolbar={
        actor.application.status !== "approved" &&
        actor.application.status !== "rejected" ? (
          <Link className="site-button" href="/operator/application">
            Edit application
          </Link>
        ) : undefined
      }
    >
      <LoginArrival />
      <OperatorDocumentStatus
        documents={actor.documents}
        requirements={actor.requirements}
      />
    </OperatorWorkspace>
  );
}
export default function Page() {
  return (
    <Suspense
      fallback={
        <p className="operator-loading" role="status">
          Loading documents…
        </p>
      }
    >
      <Content />
    </Suspense>
  );
}
