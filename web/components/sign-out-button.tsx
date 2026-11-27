"use client";

import { useRef, useState } from "react";
import { signOut } from "@/app/auth/actions";

export function SignOutButton() {
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
    <div className="space-y-3">
      <button
        type="button"
        className="primary-button"
        disabled={pending}
        onClick={handleSignOut}
      >
        {pending ? "Signing out…" : "Sign out"}
      </button>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}
