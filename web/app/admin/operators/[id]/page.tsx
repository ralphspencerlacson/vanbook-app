import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireWorkspace } from "@/lib/operators/server";
import {
  isUuid,
  displayDate,
  type OperatorApplication,
  type ApplicationDocument,
  type ApplicationEvent,
} from "@/lib/operators/types";
import {
  WorkspaceShell,
  WorkspaceLoading,
  WorkspaceUnavailable,
  AccessDenied,
  StatusBadge,
} from "@/components/workspace-shell";
import { DocumentList } from "@/components/operator-documents";
import { ReviewApplicationForm } from "@/components/review-application-form";

async function ReviewContent({ params }: PageProps<"/admin/operators/[id]">) {
  const { id } = await params;
  const actor = await requireWorkspace(`/admin/operators/${id}`);
  if (!actor.ready) return <WorkspaceUnavailable admin />;
  if (!actor.isAdmin) return <AccessDenied />;
  if (!isUuid(id)) return notFound();
  const [record, documents, events] = await Promise.all([
    actor.supabase
      .from("operator_applications")
      .select()
      .eq("id", id)
      .maybeSingle(),
    actor.supabase
      .from("operator_documents")
      .select()
      .eq("application_id", id)
      .order("created_at", { ascending: false }),
    actor.supabase
      .from("operator_application_events")
      .select()
      .eq("application_id", id)
      .order("created_at", { ascending: false }),
  ]);
  if (record.error || documents.error || events.error)
    throw new Error("Unable to load this application.");
  if (!record.data) return notFound();
  const app = record.data as OperatorApplication;
  const fields = [
    ["Business name", app.business_name],
    ["Registration number", app.registration_number],
    ["Contact person", app.contact_name],
    ["Contact email", app.contact_email],
    ["Contact number", app.contact_phone],
    ["Operating base", app.operating_base],
    ["Service coverage", app.service_areas.join(", ")],
    ["Submitted", displayDate(app.submitted_at)],
    ["Last updated", displayDate(app.updated_at)],
  ];
  return (
    <WorkspaceShell
      title={app.business_name || "Operator application"}
      description="Review the saved business details and supporting documents before recording a decision."
      admin
      superAdmin={actor.isSuperAdmin}
    >
      <Link href="/admin" className="workspace-link">
        ← Back to review queue
      </Link>
      <div className="review-layout">
        <div className="space-y-5">
          <section className="workspace-panel">
            <StatusBadge status={app.status} />
            <dl className="application-details">
              {fields.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value || "Not provided"}</dd>
                </div>
              ))}
            </dl>
            {app.notes && (
              <div className="mt-5">
                <h2 className="workspace-section-title">
                  Additional information
                </h2>
                <p className="mt-2 whitespace-pre-wrap">{app.notes}</p>
              </div>
            )}
          </section>
          <section className="workspace-panel space-y-4">
            <h2 className="workspace-section-title">Supporting documents</h2>
            <DocumentList documents={documents.data as ApplicationDocument[]} />
          </section>
          <section className="workspace-panel">
            <h2 className="workspace-section-title">Review history</h2>
            {events.data.length ? (
              <ol className="application-history">
                {(events.data as ApplicationEvent[]).map((event) => (
                  <li key={event.id}>
                    <StatusBadge status={event.to_status} />
                    <time>{displayDate(event.created_at)}</time>
                    {event.note && <p>{event.note}</p>}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="workspace-muted mt-3">No review decisions yet.</p>
            )}
          </section>
        </div>
        <aside className="workspace-panel review-decision">
          <ReviewApplicationForm application={app} />
        </aside>
      </div>
    </WorkspaceShell>
  );
}
export default function ReviewPage(props: PageProps<"/admin/operators/[id]">) {
  return (
    <Suspense fallback={<WorkspaceLoading />}>
      <ReviewContent {...props} />
    </Suspense>
  );
}
