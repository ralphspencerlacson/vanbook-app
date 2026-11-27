"use client";

import Link from "next/link";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto w-full max-w-lg space-y-5 px-6 py-20">
      <h1 className="text-2xl font-semibold">
        We couldn&apos;t load this page
      </h1>
      <p role="alert">Check your connection and try again.</p>
      <button type="button" className="primary-button" onClick={reset}>
        Try again
      </button>
      <p>
        <Link href="/sign-in" className="text-teal-800 underline">
          Return to sign-in
        </Link>
      </p>
    </main>
  );
}
