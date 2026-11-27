"use client";

import { LoginArrival } from "@/components/login-transition";

export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="workspace-panel">
      <LoginArrival />
      <h1 className="workspace-section-title">Unable to load this section</h1>
      <p role="alert">Check your connection and try again.</p>
      <button className="primary-button mt-4" onClick={reset}>Try again</button>
    </section>
  );
}
