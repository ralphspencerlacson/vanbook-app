import { OperatorBusiness } from "@/components/operator-business";
import Link from "next/link";
import { Suspense } from "react";
import { requireWorkspace } from "@/lib/operators/server";
import {
  applicationStatuses,
  statusLabels,
  displayDate,
  type OperatorApplication,
} from "@/lib/operators/types";
import {
  WorkspaceShell,
  WorkspaceLoading,
  WorkspaceUnavailable,
  AccessDenied,
  StatusBadge,
} from "@/components/workspace-shell";

async function AdminContent({ searchParams }: PageProps<"/admin">) {
  const actor = await requireWorkspace("/admin");
  if (!actor.ready) return <WorkspaceUnavailable admin />;
  if (actor.access?.role === "operator") return <OperatorBusiness />;
  if (!actor.isAdmin) return <AccessDenied />;
  const params = await searchParams;
  const status =
    typeof params.status === "string" &&
    ["all", ...applicationStatuses].includes(params.status)
      ? params.status
      : "submitted";
  const search =
    typeof params.search === "string" ? params.search.trim().slice(0, 100) : "";
  const page = Math.max(
    1,
    Math.min(10000, Number.parseInt(String(params.page ?? "1"), 10) || 1),
  );
  let query = actor.supabase
    .from("operator_applications")
    .select("*", { count: "exact" })
    .order("updated_at", { ascending: false })
    .order("id", { ascending: false })
    .range((page - 1) * 25, page * 25 - 1);
  if (status !== "all") query = query.eq("status", status);
  if (search) query = query.ilike("business_name", `%${search}%`);
  const [applications, counts] = await Promise.all([
    query,
    Promise.all(
      applicationStatuses.map((s) =>
        actor.supabase
          .from("operator_applications")
          .select("id", { count: "exact", head: true })
          .eq("status", s),
      ),
    ),
  ]);
  if (applications.error || counts.some((r) => r.error))
    throw new Error("Unable to load operator applications.");
  const rows = applications.data as OperatorApplication[];
  const href = (number: number) =>
    `/admin?${new URLSearchParams({ status, search, page: String(number) })}`;
  return (
    <WorkspaceShell
      title="Operator reviews"
      description="Review business applications and keep a clear record of every decision."
      admin
      superAdmin={actor.isSuperAdmin}
    >
      <div className="workspace-stats">
        {applicationStatuses.map((s, i) => (
          <Link href={`/admin?status=${s}`} className="workspace-stat" key={s}>
            <span>{statusLabels[s]}</span>
            <strong>{counts[i].count ?? 0}</strong>
          </Link>
        ))}
      </div>
      <section className="workspace-panel">
        <form className="workspace-filters" method="get">
          <div>
            <label htmlFor="application-filter" className="field-label">
              Status
            </label>
            <select
              id="application-filter"
              name="status"
              className="field-input"
              defaultValue={status}
            >
              <option value="all">All applications</option>
              {applicationStatuses.map((s) => (
                <option key={s} value={s}>
                  {statusLabels[s]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="operator-search" className="field-label">
              Business name
            </label>
            <input
              id="operator-search"
              name="search"
              type="search"
              className="field-input"
              placeholder="Search operators"
              defaultValue={search}
              maxLength={100}
            />
          </div>
          <button type="submit" className="primary-button">
            Apply filters
          </button>
        </form>
        <p className="workspace-muted mb-4">
          {applications.count ?? 0} matching applications · page {page}
        </p>
        {rows.length ? (
          <ul className="operator-review-list">
            {rows.map((app) => (
              <li key={app.id}>
                <div className="min-w-0">
                  <Link
                    href={`/admin/operators/${app.id}`}
                    className="workspace-business-link"
                  >
                    {app.business_name || "Untitled draft"}
                  </Link>
                  <p>{app.operating_base || "Operating base not provided"}</p>
                  <p>{app.contact_name || "Contact person not provided"}</p>
                </div>
                <div className="operator-review-meta">
                  <StatusBadge status={app.status} />
                  <time>{displayDate(app.updated_at)}</time>
                  <Link
                    href={`/admin/operators/${app.id}`}
                    className="workspace-link"
                  >
                    Review application →
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="workspace-empty">
            <h2>No applications found</h2>
            <p>Applications matching these filters will appear here.</p>
          </div>
        )}
        <nav className="workspace-pagination" aria-label="Review queue pages">
          {page > 1 && (
            <Link href={href(page - 1)} className="workspace-secondary">
              Previous
            </Link>
          )}
          {(applications.count ?? 0) > page * 25 && (
            <Link href={href(page + 1)} className="workspace-secondary">
              Next
            </Link>
          )}
        </nav>
      </section>
    </WorkspaceShell>
  );
}
export default function AdminPage(props: PageProps<"/admin">) {
  return (
    <Suspense fallback={<WorkspaceLoading />}>
      <AdminContent {...props} />
    </Suspense>
  );
}
