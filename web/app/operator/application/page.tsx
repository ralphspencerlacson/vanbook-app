import { Suspense } from "react";
import { getOperatorDocuments } from "@/lib/operators/portal";
import { OperatorWorkspace } from "@/components/operator-workspace";
import { OperatorApplicationEditor } from "@/components/operator-application-editor";
import { LoginArrival } from "@/components/login-transition";
async function Content() {
  const actor = await getOperatorDocuments();
  const editable = ["submitted", "draft", "changes_requested"].includes(
    actor.application.status,
  );
  return (
    <OperatorWorkspace
      title={editable ? "Edit application" : "Business profile"}
      approved={actor.application.status === "approved"}
    >
      <LoginArrival />
      {editable ? (
        <OperatorApplicationEditor
          application={actor.application}
          documents={actor.documents}
          requirements={actor.requirements}
        />
      ) : (
        <section className="operator-panel">
          <h2>{actor.application.business_name}</h2>
          <dl className="operator-profile-details">
            {[
              ["Contact", actor.application.contact_name],
              ["Email", actor.application.contact_email],
              ["Mobile", actor.application.contact_phone],
              ["Operating base", actor.application.operating_base],
              ["Service areas", actor.application.service_areas.join(", ")],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <p className="operator-muted">
            Contact administration to change an approved business profile.
          </p>
        </section>
      )}
    </OperatorWorkspace>
  );
}
export default function Page() {
  return (
    <Suspense
      fallback={
        <p className="operator-loading" role="status">
          Loading application…
        </p>
      }
    >
      <Content />
    </Suspense>
  );
}
