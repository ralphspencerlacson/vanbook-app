"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { registerDocument, removeDocumentRecord } from "@/app/operator/actions";
import {
  type ApplicationDocument,
  type DocumentRequirement,
} from "@/lib/operators/types";

export function DocumentList({
  documents,
  editable = false,
  onRemove,
  busy = false,
}: {
  documents: ApplicationDocument[];
  editable?: boolean;
  onRemove?: (id: string) => void;
  busy?: boolean;
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
            {editable && (
              <button
                type="button"
                onClick={() => onRemove?.(doc.id)}
                disabled={busy}
                className="text-sm text-red-700 underline"
              >
                Remove
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
export function OperatorDocuments({
  applicationId,
  ownerId,
  documents,
  requirements,
  editable,
  onBusyChange,
}: {
  applicationId: string;
  ownerId: string;
  documents: ApplicationDocument[];
  requirements: DocumentRequirement[];
  editable: boolean;
  onBusyChange: (busy: boolean) => void;
}) {
  const router = useRouter();
  const [category, setCategory] = useState(requirements[0]?.code ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const busy = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  async function upload() {
    if (busy.current) return;
    if (!file || !category) {
      setMessage("Choose a document category and a file first.");
      return;
    }
    if (
      !["application/pdf", "image/png", "image/jpeg"].includes(file.type) ||
      file.size < 1 ||
      file.size > 10485760
    ) {
      setMessage("Use a PDF, PNG, or JPEG file up to 10 MB.");
      return;
    }
    busy.current = true;
    setPending(true);
    onBusyChange(true);
    setMessage("");
    const extension =
      file.type === "application/pdf"
        ? "pdf"
        : file.type === "image/png"
          ? "png"
          : "jpg";
    const path = `${ownerId}/${applicationId}/${crypto.randomUUID()}.${extension}`;
    try {
      const supabase = createClient();
      const uploaded = await supabase.storage
        .from("operator-documents")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (uploaded.error) {
        setMessage(
          "We couldn't upload the file. Check your connection and try again.",
        );
        return;
      }
      const recorded = await registerDocument({
        applicationId,
        path,
        category,
        fileName: file.name,
        contentType: file.type,
        size: file.size,
      });
      if (!recorded.success) {
        await supabase.storage.from("operator-documents").remove([path]);
        setMessage(
          recorded.message ?? "We couldn't attach this file. Please try again.",
        );
        return;
      }
      setFile(null);
      if (input.current) input.current.value = "";
      setMessage("Document uploaded.");
      router.refresh();
    } catch {
      setMessage(
        "We couldn't upload the file. Your selection is still here; please try again.",
      );
    } finally {
      busy.current = false;
      setPending(false);
      onBusyChange(false);
    }
  }
  async function remove(id: string) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    onBusyChange(true);
    setMessage("");
    try {
      const result = await removeDocumentRecord(id);
      setMessage(
        result.success
          ? "Document removed."
          : (result.message ?? "Please try removing the document again."),
      );
      if (result.success) router.refresh();
    } catch {
      setMessage("We couldn't remove this document. Please try again.");
    } finally {
      busy.current = false;
      setPending(false);
      onBusyChange(false);
    }
  }
  return (
    <section className="space-y-5">
      <h2 className="workspace-section-title">Supporting documents</h2>
      <ul className="workspace-muted space-y-1">
        {requirements
          .filter((r) => r.active)
          .map((r) => (
            <li key={r.code}>
              {r.label} {r.required ? "(required)" : "(optional)"}
            </li>
          ))}
      </ul>
      {editable && requirements.length > 0 && (
        <div className="workspace-upload">
          <div>
            <label htmlFor="document-category" className="field-label">
              Document category
            </label>
            <select
              id="document-category"
              className="field-input"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={pending}
            >
              {requirements
                .filter((r) => r.active)
                .map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.label}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label htmlFor="supporting-file" className="field-label">
              Supporting file
            </label>
            <input
              id="supporting-file"
              ref={input}
              type="file"
              accept="application/pdf,image/png,image/jpeg"
              className="workspace-file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              disabled={pending}
            />
            <p className="workspace-muted">
              PDF, PNG, or JPEG · up to 10 MB per file · private access
            </p>
          </div>
          <button
            type="button"
            className="workspace-secondary"
            onClick={upload}
            disabled={pending}
          >
            {pending ? "Please wait…" : "Upload document"}
          </button>
        </div>
      )}
      {message && (
        <p role="status" className="workspace-feedback">
          {message}
        </p>
      )}
      <DocumentList
        documents={documents}
        editable={editable}
        onRemove={remove}
        busy={pending}
      />
    </section>
  );
}
