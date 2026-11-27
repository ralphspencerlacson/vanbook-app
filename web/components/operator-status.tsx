import Link from "next/link";
import type {
  ApplicationDocument,
  DocumentRequirement,
  OperatorApplication,
} from "@/lib/operators/types";
import { displayDate } from "@/lib/operators/types";
export function ApplicationTimeline({
  submitted,
  approved = false,
}: {
  submitted?: string | null;
  approved?: boolean;
}) {
  return (
    <ol className="operator-timeline">
      {[
        [
          "Submitted",
          submitted ? displayDate(submitted) : "Application received",
        ],
        ["Documents check", "Franchise, registration, insurance, and licenses"],
        ["Vehicle check", "Vehicle details, seating, and photos"],
        ["Approved and live", "Start receiving group requests"],
      ].map(([title, description], index) => (
        <li
          key={title}
          className={
            approved || index === 0
              ? "is-complete"
              : index === 1
                ? "is-current"
                : ""
          }
        >
          <strong>{title}</strong>
          <span>{description}</span>
        </li>
      ))}
    </ol>
  );
}
export function OperatorStatus({
  application,
  documents,
  requirements,
}: {
  application: OperatorApplication;
  documents: ApplicationDocument[];
  requirements: DocumentRequirement[];
}) {
  const changed = application.status === "changes_requested";
  const approved = application.status === "approved";
  const rejected = application.status === "rejected";
  return (
    <main className="site-container operator-status-page">
      <section className="operator-submitted-hero">
        <span aria-hidden="true">{approved ? "✓" : changed ? "↻" : "◷"}</span>
        <h1>
          {approved
            ? "Your business is approved"
            : changed
              ? "Updates needed on your application"
              : rejected
                ? "Application not approved"
                : "Application submitted"}
        </h1>
        <p>
          {approved
            ? "Your business verification is complete. Each van is reviewed before it can receive requests."
            : changed
              ? "Review the notes below, make the requested corrections, and resubmit your application."
              : rejected
                ? "Read the review note below. Contact support if you need help with this decision."
                : "We’re reviewing your business, supporting documents, and vehicles. You can track progress here."}
        </p>
        <small>Application OP-{application.id.slice(0, 8).toUpperCase()}</small>
      </section>
      <ApplicationTimeline
        submitted={application.submitted_at}
        approved={approved}
      />
      {application.review_note && (
        <p className="operator-pending-banner">
          <strong>Review note:</strong> {application.review_note}
        </p>
      )}
      <div className="operator-status-actions">
        {!rejected && (
          <Link href="/operator/requests" className="site-button">
            {approved ? "Open operator portal" : "Preview operator portal"}
          </Link>
        )}
        {!approved && !rejected && (
          <Link href="/operator/application" className="site-outline-button">
            Edit application
          </Link>
        )}
      </div>
      <OperatorDocumentStatus
        documents={documents}
        requirements={requirements}
      />
    </main>
  );
}
export function OperatorDocumentStatus({
  documents,
  requirements,
}: {
  documents: ApplicationDocument[];
  requirements: DocumentRequirement[];
}) {
  const categories = [
    ...requirements,
    ...documents
      .filter(
        (document) =>
          !requirements.some((item) => item.code === document.category),
      )
      .filter(
        (document, index, all) =>
          all.findIndex((item) => item.category === document.category) ===
          index,
      )
      .map((document) => ({
        code: document.category,
        label: document.category.replaceAll("_", " "),
        required: false,
      })),
  ];
  return (
    <section className="operator-panel operator-document-status">
      <h2>Your document review</h2>
      <p className="operator-muted">
        Each uploaded file has its own review result. Replace documents marked
        “Resubmit” through Edit application.
      </p>
      <div>
        {categories.map((item) => {
          const file = documents.find(
            (document) => document.category === item.code,
          );
          const status = !file
            ? item.required
              ? "Not uploaded"
              : "Optional"
            : file.review_status === "approved"
              ? "Approved"
              : file.review_status === "changes_requested"
                ? "Resubmit"
                : "Pending review";
          return (
            <div className="operator-document-status-row" key={item.code}>
              <div>
                <strong>{item.label}</strong>
                {file?.review_note && <p>{file.review_note}</p>}
                {file && <small>{file.file_name}</small>}
              </div>
              <span
                className={`requirement-badge ${status === "Approved" ? "is-active" : ["Resubmit", "Not uploaded"].includes(status) ? "is-required" : "is-optional"}`}
              >
                {status}
              </span>
              {file && (
                <a
                  href={`/documents/${file.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="operator-text-button"
                >
                  View
                </a>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
