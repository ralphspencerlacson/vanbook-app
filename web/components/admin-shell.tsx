import Link from "next/link";
import { BrandMark } from "./brand-mark";
import { AdminNavigation } from "./admin-navigation";
import { SessionRefresh } from "./session-refresh";
import { SignOutButton } from "./sign-out-button";
import { LoginArrival } from "./login-transition";

export function AdminFrame({
  waiting,
  children,
}: {
  waiting?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="workspace-page admin-page">
      <SessionRefresh />
      <a href="#admin-content" className="admin-skip-link">
        Skip to content
      </a>
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <BrandMark />
          <span>Admin</span>
        </div>
        <AdminNavigation waiting={waiting} />
        <div className="admin-sidebar-footer">
          <Link href="/account" className="admin-profile">
            <span className="admin-avatar">VB</span>
            <span>
              Administrator<small>Manage your account</small>
            </span>
          </Link>
          <SignOutButton />
          <Link href="/" className="admin-back-link">
            ← Back to VANBOOK
          </Link>
        </div>
      </aside>
      <main id="admin-content" className="admin-content">
        {children}
      </main>
    </div>
  );
}

export function AdminShell({
  title,
  description,
  toolbar,
  children,
}: {
  title: string;
  description?: string;
  toolbar?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="admin-view">
      <LoginArrival />
      <header className="admin-heading">
        <div>
          <h1>{title}</h1>
          {description && <p>{description}</p>}
        </div>
        {toolbar}
      </header>
      {children}
    </div>
  );
}
