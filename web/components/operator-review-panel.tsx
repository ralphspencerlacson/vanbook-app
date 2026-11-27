import Link from "next/link";
import {
  DocumentReviewControls,
  VehicleReviewControls,
} from "./document-review-controls";
import type { OperatorVehicle, VehiclePhoto } from "@/lib/operators/vehicles";
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
  vehicles = [],
  photos = [],
}: {
  application: OperatorApplication;
  documents: ApplicationDocument[];
  requirements: DocumentRequirement[];
  events: ApplicationEvent[];
  vehicleCount?: number;
  vehicles?: OperatorVehicle[];
  photos?: VehiclePhoto[];
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
        {app.operator_updated_at && (
          <p className="admin-operator-update">
            <strong>Updated by operator</strong> ·{" "}
            {displayDate(app.operator_updated_at)}
            {app.resubmitted_at && (
              <> · Resubmitted {displayDate(app.resubmitted_at)}</>
            )}
          </p>
        )}
        <h3 className="sr-only">Supporting documents</h3>
        {categories.length ? (
          categories.map((category) => {
            const files = documents.filter((d) => d.category === category.code);
            return (
              <div className="admin-document-row" key={category.code}>
                <div>
                  <strong>{category.label}</strong>
                  {files[0]?.review_note && (
                    <p className="operator-review-note">
                      {files[0].review_note}
                    </p>
                  )}
                  {files[0] && (
                    <DocumentReviewControls
                      key={`${files[0].id}-${app.version}`}
                      id={files[0].id}
                      version={app.version}
                      label={category.label}
                      note={files[0].review_note ?? ""}
                    />
                  )}
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
                    ? files[0].review_status === "approved"
                      ? "Approved"
                      : files[0].review_status === "changes_requested"
                        ? "Resubmit"
                        : "Pending review"
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
      <section className="admin-vehicle-review">
        <h3>Registered vehicles ({vehicles.length})</h3>
        {vehicles.map((vehicle) => (
          <article key={vehicle.id}>
            <strong>{vehicle.title}</strong>
            <p>
              {vehicle.plate_number} · {vehicle.model_year} · {vehicle.seats}{" "}
              seats · {vehicle.location}
            </p>
            <p>
              {vehicle.status === "published"
                ? "Approved"
                : vehicle.status === "rejected"
                  ? "Changes requested"
                  : "Pending vehicle review"}
            </p>
            <div className="admin-vehicle-photo-links">
              {photos
                .filter((photo) => photo.vehicle_id === vehicle.id)
                .map((photo) => (
                  <a
                    key={photo.id}
                    href={`/vehicle-photos/${photo.id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View {photo.position} photo ↗
                  </a>
                ))}
            </div>
            {app.status === "approved" ? (
              <VehicleReviewControls
                id={vehicle.id}
                version={vehicle.version}
              />
            ) : (
              <p>Approve the operator before publishing this vehicle.</p>
            )}
          </article>
        ))}
      </section>
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
