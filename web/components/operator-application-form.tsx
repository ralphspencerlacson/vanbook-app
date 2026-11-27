"use client";
import { useEffect, useRef, useState } from "react";
import {
  createApplication,
  saveApplication,
  submitApplication,
} from "@/app/operator/actions";
import {
  canEdit,
  displayDate,
  type OperatorApplication,
  type ApplicationDocument,
  type ApplicationEvent,
  type DocumentRequirement,
  type OperatorActionResult,
} from "@/lib/operators/types";
import { StatusBadge } from "./workspace-shell";
import { OperatorDocuments } from "./operator-documents";

function fields(app: OperatorApplication | null) {
  return {
    business_name: app?.business_name ?? "",
    registration_number: app?.registration_number ?? "",
    contact_name: app?.contact_name ?? "",
    contact_email: app?.contact_email ?? "",
    contact_phone: app?.contact_phone ?? "",
    operating_base: app?.operating_base ?? "",
    service_areas: app?.service_areas.join(", ") ?? "",
    notes: app?.notes ?? "",
  };
}
export function OperatorApplicationForm({
  application,
  documents,
  events,
  requirements,
}: {
  application: OperatorApplication | null;
  documents: ApplicationDocument[];
  events: ApplicationEvent[];
  requirements: DocumentRequirement[];
}) {
  const [app, setApp] = useState(application);
  const [draft, setDraft] = useState(fields(application));
  const [step, setStep] = useState(0);
  const [pending, setPending] = useState(false);
  const [documentBusy, setDocumentBusy] = useState(false);
  const [result, setResult] = useState<OperatorActionResult>({});
  const busy = useRef(false);
  const summary = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (result.message) summary.current?.focus();
  }, [result]);
  async function start() {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    try {
      const response = await createApplication();
      setResult(response);
      if (response.application) {
        setApp(response.application);
        setDraft(fields(response.application));
      } else if (response.success) window.location.reload();
    } catch {
      setResult({
        message: "We couldn't start your application. Please try again.",
      });
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  async function save(submit = false) {
    if (!app || busy.current || documentBusy) return;
    busy.current = true;
    setPending(true);
    try {
      const form = new FormData();
      Object.entries(draft).forEach(([key, value]) => form.set(key, value));
      const saved = await saveApplication(app.id, app.version, form, submit);
      setResult(saved);
      if (saved.errors)
        setStep(
          saved.errors.business_name ||
            saved.errors.contact_name ||
            saved.errors.contact_email ||
            saved.errors.contact_phone ||
            saved.errors.registration_number
            ? 0
            : 1,
        );
      if (saved.application) setApp(saved.application);
      if (!saved.success || !saved.application || !submit) return;
      const sent = await submitApplication(app.id, saved.application.version);
      setResult(sent);
      if (sent.application) setApp(sent.application);
    } catch {
      setResult({
        message:
          "We couldn't save your application. Your entries are still here; please try again.",
      });
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  const feedback = result.message && (
    <div
      ref={summary}
      tabIndex={-1}
      role={result.success ? "status" : "alert"}
      className={`workspace-feedback ${result.success ? "is-success" : "is-error"}`}
    >
      {result.message}
    </div>
  );
  if (!app)
    return (
      <section className="workspace-panel space-y-5">
        <h2 className="workspace-section-title">
          Register your operator business
        </h2>
        <p>
          Save your business details, add supporting documents, and submit your
          application for administrator review. Vehicle verification is a
          separate step.
        </p>
        {feedback}
        <button
          className="primary-button"
          type="button"
          onClick={start}
          disabled={pending}
        >
          {pending ? "Starting…" : "Start operator application"}
        </button>
      </section>
    );
  const editable = canEdit(app.status);
  const field = (key: keyof typeof draft, label: string, optional = false) => (
    <div key={key}>
      <label className="field-label" htmlFor={`application-${key}`}>
        {label}
        {optional ? (
          <span className="font-normal text-slate-500"> (optional)</span>
        ) : (
          <span className="font-normal text-slate-500">
            {" "}
            (required to submit)
          </span>
        )}
      </label>
      <input
        id={`application-${key}`}
        className="field-input"
        name={key}
        type={
          key === "contact_email"
            ? "email"
            : key === "contact_phone"
              ? "tel"
              : "text"
        }
        value={draft[key]}
        onChange={(e) =>
          setDraft((current) => ({ ...current, [key]: e.target.value }))
        }
        disabled={pending || !editable}
        aria-invalid={!!result.errors?.[key]}
        aria-describedby={result.errors?.[key] ? `error-${key}` : undefined}
      />
      {result.errors?.[key] && (
        <p id={`error-${key}`} className="field-error">
          {result.errors[key]}
        </p>
      )}
    </div>
  );
  return (
    <div className="space-y-5">
      <section className="workspace-panel flex flex-wrap items-center justify-between gap-4">
        <div>
          <StatusBadge status={app.status} />
          <p className="workspace-muted mt-2">
            Last saved: {displayDate(app.updated_at)}
          </p>
        </div>
        <a href="/operator" className="workspace-link">
          Reload current status
        </a>
      </section>
      {app.review_note && (
        <section className="workspace-panel">
          <h2 className="workspace-section-title">Administrator feedback</h2>
          <p className="mt-3 whitespace-pre-wrap">{app.review_note}</p>
        </section>
      )}
      {app.status === "approved" && (
        <p className="workspace-feedback is-success">
          Your business application is approved. Vehicles still need separate
          verification before any listing can be published.
        </p>
      )}
      {app.status === "submitted" && (
        <p className="workspace-feedback">
          Your application is being reviewed. Editing and document changes are
          locked until an administrator requests corrections.
        </p>
      )}
      {app.status === "rejected" && (
        <p className="workspace-feedback">
          This application has been rejected. Review the administrator feedback
          above.
        </p>
      )}
      <section className="workspace-panel">
        {feedback}
        <nav className="application-steps" aria-label="Application steps">
          {["Business & contact", "Service coverage", "Documents & submit"].map(
            (label, i) => (
              <button
                key={label}
                type="button"
                aria-current={step === i ? "step" : undefined}
                onClick={() => setStep(i)}
              >
                {i + 1}. {label}
              </button>
            ),
          )}
        </nav>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
          className="space-y-6"
        >
          {step === 0 && (
            <div className="workspace-form-grid">
              {field("business_name", "Business name")}
              {field(
                "registration_number",
                "Business registration number",
                true,
              )}
              {field("contact_name", "Contact person")}
              {field("contact_email", "Contact email")}
              {field("contact_phone", "Contact number")}
            </div>
          )}
          {step === 1 && (
            <div className="space-y-5">
              {field("operating_base", "Operating base / city")}
              {field("service_areas", "Service areas")}
              <p className="workspace-muted">
                Separate cities or provinces with commas. Include only areas
                your business serves.
              </p>
              <div>
                <label htmlFor="application-notes" className="field-label">
                  Additional information (optional)
                </label>
                <textarea
                  id="application-notes"
                  name="notes"
                  className="field-input"
                  rows={4}
                  maxLength={3000}
                  value={draft.notes}
                  onChange={(e) =>
                    setDraft((current) => ({
                      ...current,
                      notes: e.target.value,
                    }))
                  }
                  disabled={!editable || pending}
                />
              </div>
            </div>
          )}
          {step === 2 && (
            <>
              <OperatorDocuments
                applicationId={app.id}
                ownerId={app.owner_id}
                documents={documents}
                requirements={requirements}
                editable={editable && !pending}
                onBusyChange={setDocumentBusy}
              />
              <div className="rounded-xl bg-slate-50 p-4 text-sm">
                <strong>Before you submit</strong>
                <p className="mt-2">
                  Save your details and check that your business name, contact
                  person, contact email, contact number, operating base, and
                  service areas are complete. Required documents must be
                  attached.
                </p>
              </div>
            </>
          )}
          <div className="workspace-actions">
            {editable && (
              <button
                type="submit"
                className="workspace-secondary"
                disabled={pending || documentBusy}
              >
                {pending ? "Please wait…" : "Save draft"}
              </button>
            )}
            {step < 2 ? (
              <button
                type="button"
                className="primary-button"
                onClick={() => setStep(step + 1)}
              >
                Next step
              </button>
            ) : (
              editable && (
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => save(true)}
                  disabled={pending || documentBusy}
                >
                  Submit for review
                </button>
              )
            )}
          </div>
        </form>
      </section>
      <section className="workspace-panel">
        <h2 className="workspace-section-title">Application history</h2>
        {events.length ? (
          <ol className="application-history">
            {events.map((event) => (
              <li key={event.id}>
                <StatusBadge status={event.to_status} />
                <time>{displayDate(event.created_at)}</time>
                {event.note && <p>{event.note}</p>}
              </li>
            ))}
          </ol>
        ) : (
          <p className="workspace-muted mt-3">
            History will appear after your first submission.
          </p>
        )}
      </section>
    </div>
  );
}
