import { VehicleReviewControls } from "./document-review-controls";
import { AdminDocumentChecklist } from "./admin-document-checklist";
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
      <p className="operator-muted">
        <strong>
          {app.status === "approved"
            ? vehicles
                .slice(1)
                .some((vehicle) => vehicle.status !== "published")
              ? "Additional van verification"
              : vehicles.some((vehicle) => vehicle.status !== "published")
                ? "Van verification"
                : "Operator verification complete"
            : "Initial operator and first-van verification"}
        </strong>
      </p>
      {app.operator_updated_at && (
        <p className="admin-operator-update">
          Updated by operator · {displayDate(app.operator_updated_at)}
          {app.resubmitted_at && (
            <> · Resubmitted {displayDate(app.resubmitted_at)}</>
          )}
        </p>
      )}
      <h3>Shared user documents</h3>
      {app.status === "approved" && (
        <p className="operator-muted">
          The operator is already approved. Shared user documents remain on
          file; each additional van needs its own verification.
        </p>
      )}
      <AdminDocumentChecklist
        documents={documents.filter(
          (document) =>
            !document.vehicle_id &&
            !requirements.some(
              (item) => item.code === document.category && item.scope === "van",
            ),
        )}
        requirements={requirements.filter((item) => item.scope !== "van")}
        version={app.version}
      />
      {documents.some(
        (document) =>
          !document.vehicle_id &&
          requirements.some(
            (item) => item.code === document.category && item.scope === "van",
          ),
      ) && (
        <details>
          <summary>Earlier uploads without a van association</summary>
          <p>
            These files do not satisfy an individual van’s checklist. Ask the
            operator to upload them for the correct van.
          </p>
          {documents
            .filter(
              (document) =>
                !document.vehicle_id &&
                requirements.some(
                  (item) =>
                    item.code === document.category && item.scope === "van",
                ),
            )
            .map((document) => (
              <p key={document.id}>
                <a
                  href={`/documents/${document.id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {document.file_name}
                </a>
              </p>
            ))}
        </details>
      )}
      <section className="admin-vehicle-review">
        <h3>Registered vehicles ({vehicles.length})</h3>
        {vehicles.map((vehicle, index) => (
          <article key={vehicle.id}>
            <h4>
              Van {index + 1} · {vehicle.title}
            </h4>
            <p>
              {index === 0 ? "First van" : "Additional van"} ·{" "}
              {vehicle.status === "published"
                ? "Verification complete"
                : "Verification required — hidden from listings"}
            </p>
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
            <AdminDocumentChecklist
              documents={documents.filter(
                (document) => document.vehicle_id === vehicle.id,
              )}
              requirements={requirements.filter((item) => item.scope === "van")}
              version={vehicle.version}
            />
            {app.status === "approved" ? (
              <VehicleReviewControls
                id={vehicle.id}
                version={vehicle.version}
              />
            ) : (
              <p>
                Review this van’s documents and photos. Initial approval
                publishes the first van together with the operator.
              </p>
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
