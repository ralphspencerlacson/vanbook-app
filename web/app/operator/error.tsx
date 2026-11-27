"use client";
import Link from "next/link";
import { LoginArrival } from "@/components/login-transition";
export default function ErrorPage({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <main className="site-container operator-error">
      <LoginArrival />
      <h1>We couldn’t load this section</h1>
      <p role="alert">
        Check your connection and try again. If your application is unavailable,
        contact support.
      </p>
      <button className="site-button" onClick={reset}>
        Try again
      </button>
      <Link href="/sign-in">Return to sign-in</Link>
    </main>
  );
}
