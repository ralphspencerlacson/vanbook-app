import Link from "next/link";
import { getActor } from "@/lib/operators/server";
import { homeFor, isAdminRole } from "@/lib/auth/access";
import { SignOutButton } from "./sign-out-button";

export function PublicAccountLoading() {
  return (
    <span className="site-account-loading" role="status">
      <span className="sr-only">Checking your account…</span>
      <span className="skeleton-block" aria-hidden="true" />
      <span className="skeleton-block" aria-hidden="true" />
    </span>
  );
}

export async function PublicAccountActions({ operator }: { operator: boolean }) {
  const actor = await getActor();
  if (actor.user) {
    if (!actor.ready || !actor.access)
      return (
        <>
          {!operator && (
            <Link href="/#get-quotes" className="site-button is-yellow">Get quotes</Link>
          )}
          <Link href="/account">Check account</Link>
          <SignOutButton iconOnly />
        </>
      );
    return (
      <>
        {!operator && (
          <Link href="/#get-quotes" className="site-button is-yellow">Get quotes</Link>
        )}
        <Link
          href={homeFor(actor.access)}
          className={operator ? "site-quiet-button" : "site-outline-button"}
        >
          {actor.access.role === "operator"
            ? "Go to operator dashboard"
            : isAdminRole(actor.access) ? "Go to admin dashboard" : "Profile"}
        </Link>
        <SignOutButton iconOnly />
      </>
    );
  }
  return operator ? (
    <Link href="/sign-in?next=%2Foperator" className="site-quiet-button">
      Log in
    </Link>
  ) : (
    <>
      <Link href="/#get-quotes" className="site-button is-yellow">Get quotes</Link>
      <nav className="site-auth-actions" aria-label="Account access">
        <Link href="/sign-in" className="site-auth-login">Log in</Link>
        <Link href="/register" className="site-auth-signup">Sign up</Link>
      </nav>
    </>
  );
}
