import type {
  ApplicationDocument,
  DocumentRequirement,
} from "@/lib/operators/types";
import { DocumentReviewControls } from "./document-review-controls";

export function AdminDocumentChecklist({
  documents,
  requirements,
  version,
}: {
  documents: ApplicationDocument[];
  requirements: DocumentRequirement[];
  version: number;
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
    <div className="admin-document-checklist">
      {categories.map((category) => {
        const files = documents.filter(
          (document) => document.category === category.code,
        );
        const file = files[0];
        return (
          <div className="admin-document-row" key={category.code}>
            <div>
              <strong>{category.label}</strong>
              {file?.review_note && (
                <p className="operator-review-note">{file.review_note}</p>
              )}
              {file && (
                <DocumentReviewControls
                  key={`${file.id}-${version}`}
                  id={file.id}
                  version={version}
                  label={category.label}
                  note={file.review_note ?? ""}
                />
              )}
              {files.slice(1).map((extra) => (
                <a
                  key={extra.id}
                  href={`/documents/${extra.id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {extra.file_name} ↗
                </a>
              ))}
            </div>
            <span
              className={`admin-document-status ${file ? "is-uploaded" : category.required ? "is-missing" : "is-optional"}`}
            >
              {file
                ? file.review_status === "approved"
                  ? "Approved"
                  : file.review_status === "changes_requested"
                    ? "Resubmit"
                    : "Pending review"
                : category.required
                  ? "Missing"
                  : "Optional"}
            </span>
            {file ? (
              <a
                className="admin-document-view"
                href={`/documents/${file.id}`}
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
      })}
    </div>
  );
}
