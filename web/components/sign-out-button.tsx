"use client";

import { useRef, useState } from "react";
import { signOut } from "@/app/auth/actions";

export function SignOutButton({ iconOnly = false }: { iconOnly?: boolean }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);
  async function handleSignOut() {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      const result = await signOut();
      if (result.redirectTo) window.location.replace(result.redirectTo);
      else setError(result.message || "Please try signing out again.");
    } catch {
      setError(
        "We couldn't sign you out. Check your connection and try again.",
      );
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <div className={iconOnly ? "sign-out-icon-control" : "space-y-3"}>
      <button
        type="button"
        className={iconOnly ? "sign-out-icon-button" : "primary-button"}
        aria-label={iconOnly ? "Sign out" : undefined}
        title={iconOnly ? (pending ? "Signing out…" : "Sign out") : undefined}
        aria-busy={pending}
        disabled={pending}
        onClick={handleSignOut}
      >
        {iconOnly ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 5H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4M16 17l5-5-5-5M21 12H9" />
          </svg>
        ) : pending ? "Signing out…" : "Sign out"}
      </button>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}
