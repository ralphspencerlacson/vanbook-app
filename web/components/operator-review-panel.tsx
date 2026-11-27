import Link from "next/link";
import { ReviewApplicationForm } from "./review-application-form";
import { StatusBadge } from "./workspace-shell";
import {
  displayDate,
  type OperatorApplication,
  type ApplicationDocument,
  type ApplicationEvent,
  type DocumentRequirement,
} from "@/lib/operators/types";

export function OperatorReviewPanel({
  application: app,
  documents,
  requirements,
  events,
  vehicleCount,
}: {
  application: OperatorApplication;
  documents: ApplicationDocument[];
  requirements: DocumentRequirement[];
  events: ApplicationEvent[];
  vehicleCount?: number;
}) {
  const categories = [
    ...requirements.map((r) => ({
      code: r.code,
      label: r.label,
      required: r.required,
    })),
    ...Array.from(
      new Set(
        documents
          .filter((d) => !requirements.some((r) => r.code === d.category))
          .map((d) => d.category),
      ),
    ).map((code) => ({
      code,
      label: code.replaceAll("_", " "),
      required: false,
    })),
  ];
  return (
    <section
      className="admin-review-panel"
      aria-label="Selected operator review"
    >
      <header className="admin-review-identity">
        <span className="admin-operator-avatar" aria-hidden="true">
          {(app.business_name || "Operator").trim().slice(0, 1).toUpperCase()}
        </span>
        <div>
          <h2>{app.business_name || "Untitled application"}</h2>
          <p>
            {app.registration_number
              ? `Registration ${app.registration_number}`
              : "Registration number not provided"}{" "}
            · {app.operating_base || "Area not provided"}
            {vehicleCount !== undefined &&
              ` · ${vehicleCount} ${vehicleCount === 1 ? "van" : "vans"}`}
          </p>
        </div>
        <StatusBadge status={app.status} />
      </header>
      <div className="admin-document-checklist">
        <h3 className="sr-only">Supporting documents</h3>
        {categories.length ? (
          categories.map((category) => {
            const files = documents.filter((d) => d.category === category.code);
            return (
              <div className="admin-document-row" key={category.code}>
                <div>
                  <strong>{category.label}</strong>
                  {files.length > 1 && (
                    <span className="admin-document-count">
                      {files.length} files
                    </span>
                  )}
                  {files.length > 1 && (
                    <div className="admin-extra-files">
                      {files.slice(1).map((file) => (
                        <a
                          key={file.id}
                          href={`/documents/${file.id}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {file.file_name} ↗
                        </a>
                      ))}
                    </div>
                  )}
                </div>
                <span
                  className={`admin-document-status ${files.length ? "is-uploaded" : category.required ? "is-missing" : "is-optional"}`}
                >
                  {files.length
                    ? "Uploaded"
                    : category.required
                      ? "Missing"
                      : "Optional"}
                </span>
                {files.length ? (
                  <a
                    className="admin-document-view"
                    href={`/documents/${files[0].id}`}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`View ${category.label}`}
                  >
                    View
                  </a>
                ) : (
                  <span className="admin-document-unavailable">—</span>
                )}
              </div>
            );
          })
        ) : (
          <div className="admin-inline-empty">
            No supporting documents have been provided.{" "}
            <Link href="/admin/documents">Manage the checklist</Link>
          </div>
        )}
      </div>
      <ReviewApplicationForm
        key={`${app.id}-${app.version}`}
        application={app}
        compact
      />
      <details className="admin-review-details">
        <summary>Business and contact details</summary>
        <dl>
          {[
            ["Contact", app.contact_name],
            ["Email", app.contact_email],
            ["Phone", app.contact_phone],
            ["Operating base", app.operating_base],
            ["Service areas", app.service_areas.join(", ")],
            ["Submitted", displayDate(app.submitted_at)],
          ].map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value || "Not provided"}</dd>
            </div>
          ))}
        </dl>
        {app.notes && <p className="admin-detail-note">{app.notes}</p>}
      </details>
      <details className="admin-review-details">
        <summary>
          Review history <span>{events.length}</span>
        </summary>
        {events.length ? (
          <ol className="admin-review-history">
            {events.map((event) => (
              <li key={event.id}>
                <div>
                  <StatusBadge status={event.to_status} />
                  <time>{displayDate(event.created_at)}</time>
                </div>
                {event.note && <p>{event.note}</p>}
              </li>
            ))}
          </ol>
        ) : (
          <p className="admin-inline-empty">No review activity yet.</p>
        )}
      </details>
    </section>
  );
}
