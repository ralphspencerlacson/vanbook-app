"use client";
import { useRef, useState, type FormEvent } from "react";
import { reviewApplication } from "@/app/admin/actions";
import { type OperatorApplication, statusLabels } from "@/lib/operators/types";
export function ReviewApplicationForm({
  application,
  compact = false,
}: {
  application: OperatorApplication;
  compact?: boolean;
}) {
  const [decision, setDecision] = useState("approved");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const busy = useRef(false);
  const noteInput = useRef<HTMLTextAreaElement>(null);
  if (application.status !== "submitted")
    return (
      <div className="admin-review-result">
        <strong>{statusLabels[application.status]}</strong>
        <p>
          {application.review_note ||
            "Only submitted applications can receive a review decision."}
        </p>
      </div>
    );
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy.current) return;
    const chosen = compact
      ? (((e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null)
          ?.value ?? "approved")
      : decision;
    if (chosen !== "approved" && !note.trim()) {
      setMessage("Add a note explaining the requested changes or rejection.");
      noteInput.current?.focus();
      return;
    }
    busy.current = true;
    setPending(true);
    setMessage("");
    try {
      const result = await reviewApplication(
        application.id,
        application.version,
        chosen,
        note,
      );
      if (result.success) {
        window.location.reload();
        return;
      }
      setMessage(
        result.message ?? "We couldn't save this decision. Please try again.",
      );
    } catch {
      setMessage(
        "We couldn't record this decision. Your note is still here; please try again.",
      );
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <form
      onSubmit={submit}
      className={compact ? "admin-review-form" : "space-y-5"}
      aria-busy={pending}
    >
      {!compact && (
        <>
          <h2 className="workspace-section-title">Record review decision</h2>
          <p className="workspace-muted">
            Initial approval covers the operator and first van together. Review
            their required documents and the first van’s details and photos.
          </p>
          <div>
            <label className="field-label" htmlFor="review-decision">
              Decision
            </label>
            <select
              id="review-decision"
              className="field-input"
              value={decision}
              onChange={(e) => setDecision(e.target.value)}
              disabled={pending}
            >
              <option value="approved">Approve operator</option>
              <option value="changes_requested">Request changes</option>
              <option value="rejected">Reject application</option>
            </select>
          </div>
        </>
      )}
      <div>
        <label htmlFor="review-note" className="field-label">
          {compact ? "Note to operator" : "Review note"}
          {!compact && decision !== "approved" ? " (required)" : ""}
        </label>
        <textarea
          ref={noteInput}
          id="review-note"
          className="field-input"
          rows={compact ? 3 : 5}
          maxLength={3000}
          placeholder="e.g. Please upload a current insurance certificate."
          aria-describedby="review-note-help"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={pending}
        />
        <p id="review-note-help" className="workspace-muted">
          A note is required when requesting changes or rejecting.
        </p>
      </div>
      {message && (
        <p role="alert" className="workspace-feedback is-error">
          {message}
        </p>
      )}
      {compact ? (
        <div className="admin-review-actions">
          <button
            className="admin-approve"
            name="decision"
            value="approved"
            disabled={pending}
          >
            {pending ? "Saving…" : "Approve operator and first van"}
          </button>
          <button
            className="admin-request-changes"
            name="decision"
            value="changes_requested"
            disabled={pending}
          >
            Request changes
          </button>
          <button
            className="admin-reject"
            name="decision"
            value="rejected"
            disabled={pending}
          >
            Reject
          </button>
        </div>
      ) : (
        <button className="primary-button" disabled={pending}>
          {pending ? "Saving…" : "Save decision"}
        </button>
      )}
    </form>
  );
}
