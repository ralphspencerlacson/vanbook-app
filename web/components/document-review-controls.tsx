"use client";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { reviewDocument, reviewVehicle } from "@/app/admin/actions";
export function DocumentReviewControls({
  id,
  version,
  label,
  note: initialNote,
}: {
  id: string;
  version: number;
  label: string;
  note: string;
}) {
  const router = useRouter();
  const [note, setNote] = useState(initialNote);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const busy = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    const status = (
      (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement
    )?.value;
    busy.current = true;
    setPending(true);
    try {
      const result = await reviewDocument(id, version, status, note);
      setMessage(result.message ?? "");
      if (result.success) router.refresh();
    } catch {
      setMessage("Could not save this review. Try again.");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <details className="admin-document-review-editor">
      <summary>Review {label}</summary>
      <form onSubmit={submit}>
        <label className="sr-only" htmlFor={`document-note-${id}`}>
          Review note for {label}
        </label>
        <textarea
          id={`document-note-${id}`}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Explain any requested replacement…"
          maxLength={3000}
          rows={2}
          disabled={pending}
        />
        <div>
          <button value="approved" disabled={pending}>
            Approve document
          </button>
          <button value="changes_requested" disabled={pending}>
            Request replacement
          </button>
        </div>
        {message && <p role="status">{message}</p>}
      </form>
    </details>
  );
}
export function VehicleReviewControls({
  id,
  version,
}: {
  id: string;
  version: number;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  async function decide(status: string) {
    if (pending) return;
    setPending(true);
    try {
      const result = await reviewVehicle(id, version, status);
      setMessage(result.message ?? "");
      if (result.success) router.refresh();
    } catch {
      setMessage("Could not save the vehicle review.");
    } finally {
      setPending(false);
    }
  }
  return (
    <div>
      <button disabled={pending} onClick={() => decide("published")}>
        Approve vehicle
      </button>
      <button disabled={pending} onClick={() => decide("rejected")}>
        Request vehicle changes
      </button>
      {message && <p role="status">{message}</p>}
    </div>
  );
}
