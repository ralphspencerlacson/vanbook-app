"use client";
import type {
  ApplicationDocument,
  DocumentRequirement,
} from "@/lib/operators/types";

export function VehicleDocumentFields({
  requirements,
  documents = [],
  prefix = "document:",
  disabled = false,
  onFilesChange,
}: {
  requirements: DocumentRequirement[];
  documents?: ApplicationDocument[];
  prefix?: string;
  disabled?: boolean;
  onFilesChange?: (key: string, file?: File) => void;
}) {
  const items = requirements.filter((item) => item.scope === "van");
  if (!items.length) return null;
  return (
    <fieldset className="operator-vehicle-documents">
      <legend>Documents for this van</legend>
      <p className="operator-muted">
        Upload each van’s own documents. Shared user documents are supplied once
        for the operator account.
      </p>
      {items.map((item) => {
        const current = documents.find(
          (document) => document.category === item.code,
        );
        return (
          <div className="operator-replace-document" key={item.code}>
            <label htmlFor={prefix + item.code}>
              {item.label} ({item.required ? "required" : "optional"})
            </label>
            {item.description && (
              <p className="operator-muted">{item.description}</p>
            )}
            {current && (
              <p className="operator-muted">
                Current: {current.file_name} ·{" "}
                {current.review_status === "approved"
                  ? "Approved"
                  : current.review_status === "changes_requested"
                    ? "Resubmit"
                    : "Pending review"}
              </p>
            )}
            {current?.review_note && (
              <p className="operator-review-note">{current.review_note}</p>
            )}
            <input
              id={prefix + item.code}
              name={prefix + item.code}
              type="file"
              accept="application/pdf,image/png,image/jpeg"
              required={
                (item.required && !current) ||
                current?.review_status === "changes_requested"
              }
              disabled={disabled}
              onChange={(event) =>
                onFilesChange?.(prefix + item.code, event.target.files?.[0])
              }
            />
          </div>
        );
      })}
    </fieldset>
  );
}
