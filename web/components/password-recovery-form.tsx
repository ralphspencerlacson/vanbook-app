"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { requestPasswordReset, updatePassword } from "@/app/auth/actions";
import type { AuthResult } from "@/lib/auth/forms";
import { useHydrated } from "./use-hydrated";

export function PasswordRecoveryForm({ mode }: { mode: "request" | "update" }) {
  const hydrated = useHydrated();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [result, setResult] = useState<AuthResult>({});
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const summary = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (result.message) summary.current?.focus();
  }, [result]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    const form = new FormData();
    form.set("email", email);
    form.set("password", password);
    form.set("confirmPassword", confirmPassword);
    try {
      const response = await (mode === "request"
        ? requestPasswordReset(form)
        : updatePassword(form));
      setResult(response);
      if (response.success) {
        setPassword("");
        setConfirmPassword("");
      }
    } catch {
      setResult({
        message:
          "We couldn't reach VANBOOK PH. Check your connection and try again. Your entries are still here.",
      });
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <div className="auth-form-stack">
      {result.message && (
        <div
          ref={summary}
          tabIndex={-1}
          role={result.success ? "status" : "alert"}
          className={`rounded-xl border p-3 text-sm leading-6 ${result.success ? "border-teal-200 bg-teal-50 text-teal-950" : "border-red-200 bg-red-50 text-red-900"}`}
        >
          {result.message}
        </div>
      )}
      {!(mode === "update" && result.success) && (
        <form
          onSubmit={submit}
          className="auth-credentials-form"
          aria-busy={pending}
        >
          {mode === "request" ? (
            <div>
              <label className="field-label" htmlFor="recovery-email">
                Email address
              </label>
              <input
                className="field-input"
                id="recovery-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={pending || !hydrated}
                aria-invalid={!!result.errors?.email}
                aria-describedby={
                  result.errors?.email ? "recovery-email-error" : undefined
                }
              />
              {result.errors?.email && (
                <p className="field-error" id="recovery-email-error">
                  {result.errors.email}
                </p>
              )}
            </div>
          ) : (
            <>
              <div>
                <label className="field-label" htmlFor="new-password">
                  New password
                </label>
                <input
                  className="field-input"
                  id="new-password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={128}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={pending || !hydrated}
                  aria-invalid={!!result.errors?.password}
                  aria-describedby="new-password-help"
                />
                <p
                  className="mt-2 text-xs text-slate-500"
                  id="new-password-help"
                >
                  {result.errors?.password || "Use at least 8 characters."}
                </p>
              </div>
              <div>
                <label className="field-label" htmlFor="confirm-new-password">
                  Confirm new password
                </label>
                <input
                  className="field-input"
                  id="confirm-new-password"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  maxLength={128}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={pending || !hydrated}
                  aria-invalid={!!result.errors?.confirmPassword}
                  aria-describedby={
                    result.errors?.confirmPassword
                      ? "confirm-new-password-error"
                      : undefined
                  }
                />
                {result.errors?.confirmPassword && (
                  <p className="field-error" id="confirm-new-password-error">
                    {result.errors.confirmPassword}
                  </p>
                )}
              </div>
            </>
          )}
          <button
            type="submit"
            className="primary-button w-full"
            disabled={pending || !hydrated}
          >
            {pending
              ? "Please wait…"
              : mode === "request"
                ? "Send reset link"
                : "Update password"}
          </button>
        </form>
      )}
      <Link
        href={mode === "update" && result.success ? "/account" : "/sign-in"}
        className="text-sm font-semibold text-teal-800 underline underline-offset-4"
      >
        {mode === "update" && result.success
          ? "Return to your account"
          : "Back to sign-in"}
      </Link>
      {mode === "update" && !result.success && (
        <Link
          href="/forgot-password"
          className="text-sm text-teal-800 underline"
        >
          Request a new reset link
        </Link>
      )}
    </div>
  );
}
