"use client";
import { useState } from "react";
export function CustomerRegistrationPreview() {
  const [kind, setKind] = useState("personal");
  return (
    <div className="customer-form-preview">
      <form onSubmit={(event) => event.preventDefault()}>
        <div className="customer-name-fields">
          <label>
            First name
            <input placeholder="Juan" autoComplete="given-name" />
          </label>
          <label>
            Last name
            <input placeholder="Dela Cruz" autoComplete="family-name" />
          </label>
        </div>
        <label>
          Mobile number
          <input type="tel" placeholder="+63 900 000 0000" autoComplete="tel" />
        </label>
        <label>
          Email (for receipts)
          <input
            type="email"
            placeholder="name@email.com"
            autoComplete="email"
          />
        </label>
        <fieldset>
          <legend>How will you book?</legend>
          <div className="customer-kind-toggle">
            <button
              type="button"
              aria-pressed={kind === "personal"}
              onClick={() => setKind("personal")}
            >
              Personal
            </button>
            <button
              type="button"
              aria-pressed={kind === "company"}
              onClick={() => setKind("company")}
            >
              Company or org
            </button>
          </div>
        </fieldset>
        <label className="site-checkbox">
          <input type="checkbox" /> I agree to the Terms of Service and Privacy
          Policy.
        </label>
        <button type="button" className="site-button" disabled>
          Create account
        </button>
        <p className="customer-preview-note">
          Customer registration is a preview for now.
        </p>
      </form>
    </div>
  );
}
