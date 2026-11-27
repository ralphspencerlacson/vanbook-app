"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { register, resendConfirmation, signIn } from "@/app/auth/actions";
import type { AuthResult } from "@/lib/auth/forms";
import { useHydrated } from "./use-hydrated";
import { useLoginTransition } from "./login-transition";

export function AuthForm({
  mode,
  next = "/account",
  notice,
}: {
  mode: "register" | "sign-in";
  next?: string;
  notice?: string;
}) {
  const registering = mode === "register";
  const hydrated = useHydrated();
  const { enter } = useLoginTransition();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [result, setResult] = useState<AuthResult>({});
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const message = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (result.message) message.current?.focus();
  }, [result]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await run(registering ? register : signIn);
  }

  async function run(action: (form: FormData) => Promise<AuthResult>) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    const data = new FormData();
    data.set("email", email);
    data.set("password", password);
    data.set("confirmPassword", confirmPassword);
    data.set("next", next);
    try {
      const response = await action(data);
      if (response.redirectTo) {
        setPassword("");
        setConfirmPassword("");
        if (!registering && (response.redirectTo === "/admin" || response.redirectTo.startsWith("/admin/"))) {
          enter(response.redirectTo);
        } else {
          window.location.assign(response.redirectTo);
        }
        return;
      }
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
    <div className="auth-form-stack space-y-6">
      {notice && (
        <p
          role="status"
          className="rounded-xl bg-slate-100 p-4 text-sm leading-6 text-slate-700"
        >
          {notice}
        </p>
      )}
      {result.message && (
        <div
          ref={message}
          tabIndex={-1}
          role={result.success ? "status" : "alert"}
          className={`rounded-xl border p-4 text-sm leading-6 ${result.success ? "border-teal-200 bg-teal-50 text-teal-950" : "border-red-200 bg-red-50 text-red-900"}`}
        >
          {result.message}
        </div>
      )}
      <form
        onSubmit={submit}
        className="auth-credentials-form space-y-5"
        aria-busy={pending}
      >
        <div>
          <label htmlFor="email" className="field-label">
            Email address
          </label>
          <input
            className="field-input"
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={!!result.errors?.email}
            aria-describedby={result.errors?.email ? "email-error" : undefined}
            disabled={pending || !hydrated}
          />
          {result.errors?.email && (
            <p id="email-error" className="field-error">
              {result.errors.email}
            </p>
          )}
        </div>
        <div>
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="password" className="field-label">
              Password
            </label>
            {!registering && (
              <Link
                href="/forgot-password"
                className="mb-1.5 text-xs text-teal-800 underline underline-offset-4"
              >
                Forgot password?
              </Link>
            )}
          </div>
          <input
            className="field-input"
            id="password"
            name="password"
            type="password"
            autoComplete={registering ? "new-password" : "current-password"}
            required
            minLength={registering ? 8 : undefined}
            maxLength={128}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={!!result.errors?.password}
            aria-describedby={
              result.errors?.password
                ? "password-error"
                : registering
                  ? "password-help"
                  : undefined
            }
            disabled={pending || !hydrated}
          />
          {registering && (
            <p id="password-help" className="mt-2 text-xs text-slate-500">
              Use at least 8 characters. A longer, unique password is best.
            </p>
          )}
          {result.errors?.password && (
            <p id="password-error" className="field-error">
              {result.errors.password}
            </p>
          )}
        </div>
        {registering && (
          <div>
            <label htmlFor="confirmPassword" className="field-label">
              Confirm password
            </label>
            <input
              className="field-input"
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              maxLength={128}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              aria-invalid={!!result.errors?.confirmPassword}
              aria-describedby={
                result.errors?.confirmPassword ? "confirm-error" : undefined
              }
              disabled={pending || !hydrated}
            />
            {result.errors?.confirmPassword && (
              <p id="confirm-error" className="field-error">
                {result.errors.confirmPassword}
              </p>
            )}
          </div>
        )}
        <button
          className="primary-button w-full"
          disabled={pending || !hydrated}
          type="submit"
        >
          {pending
            ? "Please wait…"
            : registering
              ? "Create account"
              : "Sign in"}
        </button>
      </form>
      <button
        type="button"
        onClick={() => run(resendConfirmation)}
        disabled={pending || !hydrated}
        className="auth-resend text-sm font-medium text-teal-800 underline underline-offset-4 disabled:opacity-50"
      >
        Resend confirmation email
      </button>
      <p className="text-sm text-slate-600">
        {registering ? "Already have an account? " : "New to VANBOOK PH? "}
        <Link
          className="font-semibold text-teal-800 underline underline-offset-4"
          href={`${registering ? "/sign-in" : "/register"}?next=${encodeURIComponent(next)}`}
        >
          {registering ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </div>
  );
}
