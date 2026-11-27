import type { ApplicationDocument } from "@/lib/operators/types";

export function DocumentList({
  documents,
}: {
  documents: ApplicationDocument[];
}) {
  if (!documents.length)
    return <p className="workspace-muted">No supporting documents uploaded.</p>;
  return (
    <ul className="document-list">
      {documents.map((doc) => (
        <li key={doc.id}>
          <div className="min-w-0">
            <strong className="break-all">{doc.file_name}</strong>
            <p>
              {(doc.size_bytes / 1024 / 1024).toFixed(2)} MB ·{" "}
              {doc.content_type === "application/pdf" ? "PDF" : "Image"}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a
              href={`/documents/${doc.id}`}
              target="_blank"
              rel="noreferrer"
              className="workspace-link"
            >
              View document
            </a>
          </div>
        </li>
      ))}
    </ul>
  );
}
