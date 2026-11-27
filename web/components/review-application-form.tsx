"use client";
import { useRef, useState } from "react";
import { reviewApplication } from "@/app/admin/actions";
import { type OperatorApplication } from "@/lib/operators/types";

export function ReviewApplicationForm({
  application,
}: {
  application: OperatorApplication;
}) {
  const [decision, setDecision] = useState("changes_requested");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const busy = useRef(false);
  if (application.status !== "submitted")
    return (
      <p className="workspace-feedback">
        Only submitted applications can receive a review decision. Applications
        returned for changes must be resubmitted by the operator.
      </p>
    );
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setMessage("");
    try {
      const result = await reviewApplication(
        application.id,
        application.version,
        decision,
        note,
      );
      if (result.success) {
        window.location.reload();
        return;
      }
      setMessage(
        result.message ?? "We couldn't record this decision. Please try again.",
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
    <form onSubmit={submit} className="space-y-5">
      <h2 className="workspace-section-title">Record review decision</h2>
      <p className="workspace-muted">
        Approval covers the operator business only. It does not approve vehicles
        or publish listings.
      </p>
      {message && (
        <p role="alert" className="workspace-feedback is-error">
          {message}
        </p>
      )}
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
          <option value="changes_requested">Request changes</option>
          <option value="approved">Approve operator</option>
          <option value="rejected">Reject application</option>
        </select>
      </div>
      <div>
        <label htmlFor="review-note" className="field-label">
          Review note {decision === "approved" ? "(optional)" : "(required)"}
        </label>
        <textarea
          id="review-note"
          aria-describedby="review-note-help"
          className="field-input"
          rows={5}
          maxLength={3000}
          required={decision !== "approved"}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={pending}
        />
        <p id="review-note-help" className="workspace-muted mt-2">
          Shown to the operator and saved in the review history.
        </p>
      </div>
      <button type="submit" className="primary-button" disabled={pending}>
        {pending ? "Saving…" : "Save decision"}
      </button>
    </form>
  );
}
