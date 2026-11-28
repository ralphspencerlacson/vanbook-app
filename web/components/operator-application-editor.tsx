"use client";
import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { resubmitApplication } from "@/app/operator/actions";
import type {
  OperatorApplication,
  ApplicationDocument,
  DocumentRequirement,
} from "@/lib/operators/types";
export function OperatorApplicationEditor({
  application,
  documents,
  requirements,
}: {
  application: OperatorApplication;
  documents: ApplicationDocument[];
  requirements: DocumentRequirement[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{
    success?: boolean;
    message: string;
  }>();
  const busy = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    try {
      const response = await resubmitApplication(
        new FormData(event.currentTarget),
      );
      setResult(response);
      if (response.success) {
        router.replace("/operator");
        router.refresh();
      }
    } catch {
      setResult({
        message: "We couldn't save your application. Please try again.",
      });
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <form
      className="operator-application-editor"
      onSubmit={submit}
      aria-busy={pending}
    >
      <input type="hidden" name="id" value={application.id} />
      <input type="hidden" name="version" value={application.version} />
      <section className="operator-panel">
        <h2>Business details</h2>
        <div className="operator-form-grid">
          {[
            ["business_name", "Registered business name", 200],
            [
              "registration_number",
              "Business registration number (optional)",
              100,
            ],
            ["contact_name", "Contact person", 150],
            ["contact_email", "Contact email", 254],
            ["contact_phone", "Mobile number", 30],
            ["operating_base", "Operating base", 200],
            ["service_areas", "Service areas (separate with commas)", 3000],
          ].map(([key, label, max]) => (
            <label key={key}>
              {label}
              <input
                name={String(key)}
                type={
                  key === "contact_email"
                    ? "email"
                    : key === "contact_phone"
                      ? "tel"
                      : "text"
                }
                defaultValue={
                  key === "service_areas"
                    ? application.service_areas.join(", ")
                    : String(
                        application[key as keyof OperatorApplication] ?? "",
                      )
                }
                maxLength={Number(max)}
                required={key !== "registration_number"}
                disabled={pending}
              />
            </label>
          ))}
        </div>
        <label>
          Additional information (optional)
          <textarea
            name="notes"
            defaultValue={application.notes}
            maxLength={3000}
            rows={3}
            disabled={pending}
          />
        </label>
      </section>
      <section className="operator-panel">
        <h2>Shared document replacements</h2>
        <p className="operator-muted">
          For vehicle documents and corrections,{" "}
          <Link href="/operator/vans">open My vans</Link>.
        </p>
        <p className="operator-muted">
          Leave a file empty to keep the current version. Replacement files
          return to pending review.
        </p>
        {requirements
          .filter((item) => item.scope !== "van")
          .map((item) => {
            const file = documents.find(
              (document) =>
                !document.vehicle_id && document.category === item.code,
            );
            return (
              <div className="operator-replace-document" key={item.code}>
                <label htmlFor={`replace:${item.code}`}>
                  {item.label} {item.required ? "(required)" : "(optional)"}
                </label>
                {file && (
                  <p className="operator-muted">
                    Current: {file.file_name} ·{" "}
                    {file.review_status === "changes_requested"
                      ? "Resubmit requested"
                      : file.review_status === "approved"
                        ? "Approved"
                        : "Pending review"}
                  </p>
                )}
                {file?.review_note && (
                  <p className="operator-review-note">{file.review_note}</p>
                )}
                {item.description && (
                  <p className="operator-muted">{item.description}</p>
                )}
                <input
                  id={`replace:${item.code}`}
                  name={`document:${item.code}`}
                  type="file"
                  accept="application/pdf,image/png,image/jpeg"
                  required={
                    (item.required && !file) ||
                    file?.review_status === "changes_requested"
                  }
                  disabled={pending}
                />
              </div>
            );
          })}
        <p className="operator-muted">
          Replacement documents together must be 3 MB or less.
        </p>
      </section>
      {result && (
        <p
          role={result.success ? "status" : "alert"}
          className={
            result.success ? "requirements-success" : "requirements-error"
          }
        >
          {result.message}
        </p>
      )}
      <button className="site-button" disabled={pending}>
        {pending ? "Resubmitting…" : "Save and resubmit application"}
      </button>
    </form>
  );
}
