import Link from "next/link";
import { BrandMark } from "./brand-mark";
import { SignOutButton } from "./sign-out-button";
import { Suspense } from "react";
import { PublicAccountActions, PublicAccountLoading } from "./public-account-actions";
import { SessionRefresh } from "./session-refresh";
import { PublicNavigation } from "./public-navigation";

export function PublicHeader({
  operator = false,
  name,
}: {
  operator?: boolean;
  name?: string;
}) {
  return (
    <header className={`site-header ${operator ? "is-operator" : ""}`}>
      <div className="site-container site-header-inner">
        <div className="site-brand-link">
          <BrandMark href={operator ? "/operator" : "/"} />
        </div>
        {operator ? (
          <>
            <span className="site-operator-label">for Operators</span>
            <div className="site-header-actions">
              <Link href="/" className="site-quiet-button">
                Customer site
              </Link>
              {name ? (
                <>
                  <span className="site-account-name">{name}</span>
                  <SignOutButton iconOnly />
                </>
              ) : (
                <Suspense fallback={<PublicAccountLoading />}>
                  <PublicAccountActions operator />
                </Suspense>
              )}
            </div>
          </>
        ) : (
          <PublicNavigation
            accountActions={
              <Suspense fallback={<PublicAccountLoading />}>
                <PublicAccountActions operator={false} />
              </Suspense>
            }
          />
        )}
      </div>
    </header>
  );
}
export function PublicFooter() {
  return (
    <footer className="site-footer">
      <div className="site-container">
        <div className="site-footer-grid">
          <div>
            <BrandMark />
            <p>
              Legal, verified vans for group trips. Travel together with
              confidence.
            </p>
          </div>
          <div>
            <h2>Book</h2>
            <Link href="/#get-quotes">Get quotes</Link>
            <Link href="/#popular-routes">Popular routes</Link>
            <Link href="/#corporate">Corporate trips</Link>
          </div>
          <div>
            <h2>Operators</h2>
            <Link href="/operator">Operator portal</Link>
            <Link href="/register/operator">Register your vans</Link>
          </div>
          <div>
            <h2>Help</h2>
            <Link href="/#how-it-works">How it works</Link>
            <Link href="/sign-in">Manage your account</Link>
          </div>
        </div>
        <div className="site-footer-bottom">
          <span>© 2026 VANBOOK PH</span>
          <span>Made for journeys together.</span>
        </div>
      </div>
    </footer>
  );
}
export function PublicShell({
  children,
  operator,
  name,
  className = "",
  footer = true,
}: {
  children: React.ReactNode;
  operator?: boolean;
  name?: string;
  className?: string;
  footer?: boolean;
}) {
  return (
    <div className={`public-site ${className}`}>
      {!name && <SessionRefresh />}
      <PublicHeader operator={operator} name={name} />
      {children}
      {footer && <PublicFooter />}
    </div>
  );
}
