"use client";
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  registerOperator,
  type RegistrationResult,
} from "@/app/register/operator/actions";
import type { DocumentRequirement } from "@/lib/operators/types";
import { VehicleFields } from "./vehicle-fields";
import { useHydrated } from "./use-hydrated";
const fields = [
  ["business_name", "Registered business name", "text", 200],
  [
    "registration_number",
    "Business registration number (optional)",
    "text",
    100,
  ],
  ["contact_name", "Contact person", "text", 150],
  ["contact_email", "Contact email", "email", 254],
  ["contact_phone", "Mobile number", "tel", 30],
  ["operating_base", "Operating base", "text", 200],
  ["service_areas", "Service areas (separate with commas)", "text", 3000],
] as const;
const serviceAreaOptions = [
  "Metro Manila", "Rizal", "Laguna", "Cavite",
  "Batangas", "Bulacan", "Pampanga", "Quezon",
];
const placeholders: Record<string, string> = {
  business_name: "As on DTI/SEC registration",
  registration_number: "Registration no.",
  contact_name: "Full name",
  contact_email: "business@email.com",
  contact_phone: "09XX XXX XXXX",
  operating_base: "City or municipality",
  service_areas: "Add other areas, separated by commas",
};
export function OperatorRegistrationForm({
  requirements,
  heading,
}: {
  requirements: DocumentRequirement[];
  heading: ReactNode;
}) {
  const router = useRouter();
  const [result, setResult] = useState<RegistrationResult>();
  const [pending, setPending] = useState(false);
  const [vehicles, setVehicles] = useState([0]);
  const [files, setFiles] = useState<Record<string, File>>({});
  const [agreement, setAgreement] = useState(false);
  const [declaration, setDeclaration] = useState(false);
  const [serviceAreas, setServiceAreas] = useState("");
  const [businessFieldsReady, setBusinessFieldsReady] = useState(false);
  const [vehicleCompletion, setVehicleCompletion] = useState<Record<string, boolean>>({});
  const busy = useRef(false);
  const next = useRef(1);
  const hydrated = useHydrated();
  function updateFile(key: string, file?: File) {
    setFiles((previous) => {
      const value = { ...previous };
      if (file) value[key] = file;
      else delete value[key];
      return value;
    });
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setResult(undefined);
    try {
      const response = await registerOperator(
        new FormData(event.currentTarget),
      );
      if (response.success && response.applicationId) {
        router.replace(
          `/register/operator/success?application=${response.applicationId}`,
        );
        return;
      }
      setResult(response);
    } catch {
      setResult({
        message:
          "We couldn't submit your application. Your entries are still here. Please try again.",
      });
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  const required = requirements.filter((item) => item.required);
  const uploaded = required.filter((item) => files[`document:${item.code}`]).length;
  const documentsReady = required.every(
    (item) => !!files[`document:${item.code}`],
  );
  const selectedAreas = serviceAreas.split(",")
    .map((area) => area.trim()).filter(Boolean);
  const businessReady = businessFieldsReady && selectedAreas.length > 0;
  const vehiclesReady = vehicles.every((key) => vehicleCompletion[key]);
  function checkCompletion(event: FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    const complete = (selector: string) =>
      Array.from(form.querySelectorAll<HTMLInputElement>(selector))
        .every((input) => input.validity.valid);
    const values = new FormData(form);
    setBusinessFieldsReady(
      complete('.operator-business-details input[required]:not([name="service_areas"])') &&
      values.get("password") === values.get("confirmPassword"),
    );
    setVehicleCompletion(Object.fromEntries(
      Array.from(form.querySelectorAll<HTMLElement>("[data-vehicle-key]")).map((vehicle) => [
        vehicle.dataset.vehicleKey!,
        Array.from(vehicle.querySelectorAll<HTMLInputElement>("input[required]")).every((input) => input.validity.valid),
      ]),
    ));
  }
  function toggleArea(area: string) {
    const selected = selectedAreas.some((value) => value.toLowerCase() === area.toLowerCase());
    setServiceAreas((selected
      ? selectedAreas.filter((value) => value.toLowerCase() !== area.toLowerCase())
      : [...selectedAreas, area]).join(", "));
  }
  return (
    <form
      className="operator-registration-layout"
      onSubmit={submit}
      onChange={checkCompletion}
      aria-busy={pending}
    >
      <div className="operator-registration-main">
        {heading}
        {result && (
          <p role="alert" className="requirements-error">
            {result.message}
          </p>
        )}
        <section className="operator-panel operator-business-details">
          <h2>1 · Business details</h2>
          <div className="operator-form-grid">
            {fields.map(([key, label, type, max]) => (
              <div key={key} className={key === "service_areas" ? "operator-service-areas" : undefined}>
                <label>
                {label}
                <input
                  name={key}
                  type={type}
                  maxLength={max}
                  placeholder={placeholders[key]}
                  {...(key === "service_areas" ? {
                    value: serviceAreas,
                    onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
                      setServiceAreas(event.target.value),
                  } : {})}
                  required={key !== "registration_number"}
                  disabled={pending || !hydrated}
                  aria-invalid={!!result?.errors?.[key]}
                />
                {result?.errors?.[key] && (
                  <span className="field-error">{result.errors[key]}</span>
                )}
                </label>
                {key === "service_areas" && (
                  <span className="operator-service-area-options" role="group" aria-label="Popular service areas">
                    {serviceAreaOptions.map((area) => (
                      <button
                        type="button"
                        key={area}
                        disabled={pending || !hydrated}
                        aria-pressed={selectedAreas.some((value) => value.toLowerCase() === area.toLowerCase())}
                        onClick={() => toggleArea(area)}
                      >
                        {area}
                      </button>
                    ))}
                  </span>
                )}
              </div>
            ))}
          </div>
          <div className="operator-account-heading">
            <h3>Your operator account</h3>
            <p>Confirm your email to track your application. Approval is required to receive requests.</p>
          </div>
          <div className="operator-form-grid operator-account-fields">
            <label>
              Account email
              <input
                type="email"
                name="email"
                autoComplete="email"
                required
                maxLength={254}
                disabled={pending || !hydrated}
              />
            </label>
            <label>
              Password
              <input
                type="password"
                name="password"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={128}
                disabled={pending || !hydrated}
              />
            </label>
            <label>
              Confirm password
              <input
                type="password"
                name="confirmPassword"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={128}
                disabled={pending || !hydrated}
              />
            </label>
          </div>
        </section>
        <section className="operator-panel">
          <div className="operator-panel-heading">
            <h2>2 · Documents</h2>
            <span>
              {uploaded} of {required.length} required ready
            </span>
          </div>
          <progress
            className="operator-upload-progress"
            max={Math.max(1, required.length)}
            value={uploaded}
            aria-label="Document upload progress"
          />
          <div className="operator-registration-documents">
            {requirements.map((item) => (
              <div className="operator-registration-document" key={item.code}>
                <div>
                  <label htmlFor={`document:${item.code}`}>{item.label}</label>
                  {item.description && (
                    <details className="operator-document-instructions">
                      <summary>Instructions</summary>
                      <p id={`document-help:${item.code}`}>{item.description}</p>
                    </details>
                  )}
                  {files[`document:${item.code}`] && (
                    <small className="operator-document-filename">
                      {files[`document:${item.code}`].name}
                    </small>
                  )}
                </div>
                <span
                  className={`requirement-badge ${files[`document:${item.code}`] ? "is-active" : item.required ? "is-required" : "is-optional"}`}
                >
                  {files[`document:${item.code}`]
                    ? "Ready to submit"
                    : item.required
                      ? "Required"
                      : "Optional"}
                </span>
                <div className={`operator-file-choice ${files[`document:${item.code}`] ? "has-file" : ""}`}>
                  <span aria-hidden="true">
                    {files[`document:${item.code}`] ? "Replace" : "Upload"}
                  </span>
                  <input
                    id={`document:${item.code}`}
                    aria-label={`${item.label} (${item.required ? "required" : "optional"})`}
                    name={`document:${item.code}`}
                    aria-describedby={
                      item.description
                        ? `document-help:${item.code}`
                        : undefined
                    }
                    type="file"
                    accept="application/pdf,image/png,image/jpeg"
                    required={item.required}
                    disabled={pending || !hydrated}
                    onChange={(event) =>
                      updateFile(
                        `document:${item.code}`,
                        event.target.files?.[0],
                      )
                    }
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="operator-muted">
            PDF, PNG, or JPEG. Documents and vehicle photos together must be 3
            MB or less. Files are private.
          </p>
        </section>
        <section className="operator-panel">
          <h2>3 · Vehicles</h2>
          <input
            type="hidden"
            name="vehicle_keys"
            value={JSON.stringify(vehicles)}
          />
          {vehicles.map((key, index) => (
            <div className="operator-registration-vehicle" key={key} data-vehicle-key={key}>
              <div className="operator-panel-heading">
                <h3>{vehicles.length > 1 ? `Vehicle ${index + 1}` : "At least one van with a front photo"}</h3>
                {vehicles.length > 1 && (
                  <button
                    type="button"
                    className="operator-text-button"
                    disabled={pending}
                    onClick={() => {
                      setVehicles(vehicles.filter((value) => value !== key));
                      setFiles((previous) =>
                        Object.fromEntries(
                          Object.entries(previous).filter(
                            ([name]) => !name.startsWith(`photo:${key}:`),
                          ),
                        ),
                      );
                    }}
                  >
                    Remove vehicle
                  </button>
                )}
              </div>
              <VehicleFields
                prefix={`vehicle:${key}:`}
                photoPrefix={`photo:${key}:`}
                disabled={pending || !hydrated}
                onFilesChange={updateFile}
              />
            </div>
          ))}
          {vehicles.length < 5 && (
            <button
              type="button"
              className="site-outline-button"
              disabled={pending}
              onClick={() => setVehicles([...vehicles, next.current++])}
            >
              ＋ Add another vehicle
            </button>
          )}
        </section>
        <section className="operator-panel">
          <h2>4 · Agreement</h2>
          <label className="site-checkbox">
            <input
              name="declaration"
              type="checkbox"
              required
              checked={declaration}
              onChange={(event) => setDeclaration(event.target.checked)}
              disabled={pending}
            />
            I confirm these details are accurate and my vans hold the applicable
            franchise, insurance, and registered seat capacity.
          </label>
          <label className="site-checkbox">
            <input
              name="agreement"
              type="checkbox"
              required
              checked={agreement}
              onChange={(event) => setAgreement(event.target.checked)}
              disabled={pending}
            />
            I agree to operator verification and the platform’s booking and
            cancellation requirements.
          </label>
          <button
            className="site-button"
            disabled={pending || !hydrated || !agreement || !declaration}
          >
            {pending ? "Submitting application…" : "Submit application"}
          </button>
        </section>
      </div>
      <aside className="operator-checklist">
        <h2>Your checklist</h2>
        <ul>
          {[
            { label: "Business details", complete: businessReady },
            { label: `Documents (${uploaded}/${required.length})`, complete: documentsReady },
            { label: "At least 1 vehicle with photos", complete: vehiclesReady },
            { label: "Agreement accepted", complete: agreement && declaration },
          ].map((item) => (
            <li key={item.label} data-complete={item.complete}>
              <span className="operator-checklist-indicator" aria-hidden="true">
                {item.complete ? "✓" : ""}
              </span>
              <span>
                {item.label}
                <span className="sr-only">{item.complete ? ": complete" : ": incomplete"}</span>
              </span>
            </li>
          ))}
        </ul>
        <p>
          Already registered?{" "}
          <Link href="/sign-in?next=%2Foperator">
            Log in to the operator portal.
          </Link>
        </p>
      </aside>
    </form>
  );
}
