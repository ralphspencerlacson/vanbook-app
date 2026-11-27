import Link from "next/link";
import { BrandMark } from "./brand-mark";
import { SignOutButton } from "./sign-out-button";
import { SessionRefresh } from "./session-refresh";
import { type ApplicationStatus, statusLabels } from "@/lib/operators/types";
import { AdminShell } from "./admin-shell";
import { VanLoadingScreen } from "./van-loading-screen";

export function WorkspaceShell({
  title,
  description,
  admin = false,
  children,
  operator = false,
}: {
  title: string;
  description?: string;
  admin?: boolean;
  superAdmin?: boolean;
  operator?: boolean;
  children: React.ReactNode;
}) {
  if (admin)
    return (
      <AdminShell title={title} description={description}>
        {children}
      </AdminShell>
    );
  return (
    <div className="workspace-page">
      <SessionRefresh />
      <header className="workspace-header">
        <BrandMark />
        <div className="workspace-account">
          <Link href="/account">Your account</Link>
          <SignOutButton />
        </div>
      </header>
      <div className="workspace-layout">
        <nav className="workspace-nav" aria-label="Workspace">
          <Link href="/">Browse vehicles</Link>
          {operator && (
            <>
              <Link href="/admin">My business</Link>
              <Link href="/admin/vehicles">My vehicles</Link>
            </>
          )}
          {admin && (
            <>
              <Link href="/admin">Review applications</Link>
              <Link href="/admin/documents">Document checklist</Link>
              <Link href="/admin/vehicles">All vehicles</Link>
              <Link href="/admin/users">Users</Link>
            </>
          )}
        </nav>
        <main className="workspace-main">
          <div className="workspace-heading">
            <p>{admin ? "ADMINISTRATION" : "OPERATOR WORKSPACE"}</p>
            <h1>{title}</h1>
            {description && <div>{description}</div>}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
export function StatusBadge({ status }: { status: ApplicationStatus }) {
  return (
    <span className={`status-badge status-${status}`}>
      {statusLabels[status]}
    </span>
  );
}
export function WorkspaceLoading() {
  return <VanLoadingScreen />;
}
export function WorkspaceUnavailable({ admin = false }: { admin?: boolean }) {
  return (
    <WorkspaceShell title="Workspace unavailable" admin={admin}>
      <div className="workspace-panel">
        <p>This workspace is not available yet. Please try again later.</p>
        <Link href="/account" className="workspace-link">
          Return to your account
        </Link>
      </div>
    </WorkspaceShell>
  );
}
export function AccessDenied() {
  return (
    <WorkspaceShell title="Administrator access required">
      <div className="workspace-panel">
        <p>Your account does not have access to administration.</p>
        <Link href="/account" className="workspace-link">
          Return to your account
        </Link>
      </div>
    </WorkspaceShell>
  );
}
