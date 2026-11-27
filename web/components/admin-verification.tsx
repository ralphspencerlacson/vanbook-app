import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "./admin-shell";
import { OperatorReviewPanel } from "./operator-review-panel";
import {
  applicationStatuses,
  statusLabels,
  isUuid,
  type OperatorApplication,
  type ApplicationDocument,
  type ApplicationEvent,
  type DocumentRequirement,
} from "@/lib/operators/types";
import type { requireWorkspace } from "@/lib/operators/server";

type Params = Record<string, string | string[] | undefined>;
export function AdminMetric({
  label,
  value,
  detail,
  href,
  attention = false,
}: {
  label: string;
  value: string | number;
  detail: string;
  href?: string;
  attention?: boolean;
}) {
  const content = (
    <>
      <span>{label}</span>
      <strong>{value}</strong>
      <small className={attention ? "is-attention" : undefined}>{detail}</small>
    </>
  );
  return href ? (
    <Link href={href} className="admin-metric">
      {content}
    </Link>
  ) : (
    <div className="admin-metric">{content}</div>
  );
}
function shortDate(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("en-PH", {
        month: "short",
        day: "numeric",
        timeZone: "Asia/Manila",
      }).format(new Date(value))
    : "Not submitted";
}

export async function AdminVerification({
  actor,
  params,
  selectedId,
}: {
  actor: Awaited<ReturnType<typeof requireWorkspace>>;
  params: Params;
  selectedId?: string;
}) {
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
  const selected =
    selectedId ??
    (typeof params.operator === "string" ? params.operator : undefined);
  if (selected && !isUuid(selected)) notFound();
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "2-digit",
    timeZone: "Asia/Manila",
  }).formatToParts(now);
  const monthStart = `${parts.find((p) => p.type === "year")!.value}-${parts.find((p) => p.type === "month")!.value}-01T00:00:00+08:00`;
  let query = actor.supabase
    .from("operator_applications")
    .select("*", { count: "exact" })
    .order("updated_at", { ascending: false })
    .order("id", { ascending: false })
    .range((page - 1) * 25, page * 25 - 1);
  if (status !== "all") query = query.eq("status", status);
  if (search) {
    const pattern = JSON.stringify(`%${search}%`);
    query = query.or(
      `business_name.ilike.${pattern},registration_number.ilike.${pattern}`,
    );
  }
  const [result, waiting, approved, aged, rejected, vehicles] =
    await Promise.all([
      query,
      actor.supabase
        .from("operator_applications")
        .select("id", { count: "exact", head: true })
        .eq("status", "submitted"),
      actor.supabase
        .from("operator_applications")
        .select("id", { count: "exact", head: true })
        .eq("status", "approved"),
      actor.supabase
        .from("operator_applications")
        .select("id", { count: "exact", head: true })
        .eq("status", "submitted")
        .lt(
          "submitted_at",
          new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString(),
        ),
      actor.supabase
        .from("operator_applications")
        .select("id", { count: "exact", head: true })
        .eq("status", "rejected")
        .gte("reviewed_at", monthStart),
      actor.supabase.rpc("get_managed_vehicles"),
    ]);
  if ([result, waiting, approved, aged, rejected].some((r) => r.error))
    throw new Error("Unable to load operator verification.");
  const rows = result.data as OperatorApplication[];
  // This existing management RPC caps its response at 200. Show no per-operator
  // count if it may be truncated, rather than presenting incomplete totals.
  const vehicleCounts: Map<string, number> | null =
    !vehicles.error &&
    Array.isArray(vehicles.data) &&
    vehicles.data.length < 200
      ? new Map<string, number>()
      : null;
  if (vehicleCounts)
    for (const vehicle of vehicles.data as { operator_id: string }[])
      vehicleCounts.set(
        vehicle.operator_id,
        (vehicleCounts.get(vehicle.operator_id) ?? 0) + 1,
      );
  let app = selected ? rows.find((r) => r.id === selected) : rows[0];
  if (selected && !app) {
    const record = await actor.supabase
      .from("operator_applications")
      .select()
      .eq("id", selected)
      .maybeSingle();
    if (record.error) throw new Error("Unable to load this operator.");
    if (!record.data) notFound();
    app = record.data as OperatorApplication;
  }
  const [docs, requirements, events] = await Promise.all([
    app
      ? actor.supabase
          .from("operator_documents")
          .select()
          .eq("application_id", app.id)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    actor.supabase
      .from("operator_document_requirements")
      .select()
      .order("label"),
    app
      ? actor.supabase
          .from("operator_application_events")
          .select()
          .eq("application_id", app.id)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (docs.error || requirements.error || events.error)
    throw new Error("Unable to load verification documents.");
  const href = (options: {
    operator?: string;
    page?: number;
    status?: string;
  }) =>
    "/admin?" +
    new URLSearchParams({
      status: options.status ?? status,
      ...(search ? { search } : {}),
      page: String(options.page ?? page),
      ...(options.operator ? { operator: options.operator } : {}),
    });
  return (
    <AdminShell
      title="Operator verification"
      description="Review operator credentials, supporting documents, and business details before approval."
      waiting={waiting.count ?? 0}
      toolbar={
        <form action="/admin" className="admin-search" role="search">
          <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <circle cx="8.5" cy="8.5" r="5.5" />
            <path d="m13 13 4 4" />
          </svg>
          <input
            type="search"
            name="search"
            aria-label="Search operator or registration number"
            placeholder="Search operator or registration no."
            defaultValue={search}
            maxLength={100}
          />
          <input type="hidden" name="status" value={status} />
          <button type="submit" className="sr-only">
            Search
          </button>
        </form>
      }
    >
      <div className="admin-metrics">
        <AdminMetric
          label="Waiting for review"
          value={waiting.count ?? 0}
          detail={`${aged.count ?? 0} older than 48 hrs`}
          href={href({ status: "submitted", page: 1 })}
          attention
        />
        <AdminMetric
          label="Approved operators"
          value={approved.count ?? 0}
          detail="Business applications approved"
          href={href({ status: "approved", page: 1 })}
        />
        <AdminMetric
          label="Documents expiring"
          value="—"
          detail="Expiry tracking not available yet"
        />
        <AdminMetric
          label="Rejected this month"
          value={rejected.count ?? 0}
          detail="Decisions recorded this month"
        />
      </div>
      <div className="admin-verification-layout">
        <section className="admin-queue" aria-label="Operator applications">
          <div className="admin-queue-toolbar">
            <div>
              <h2>Operators</h2>
              <span>{result.count ?? 0} applications</span>
            </div>
            <form action="/admin" className="admin-status-filter">
              <label htmlFor="queue-status" className="sr-only">
                Application status
              </label>
              <select id="queue-status" name="status" defaultValue={status}>
                {[
                  ["submitted", "Waiting for review"],
                  ["all", "All applications"],
                  ...applicationStatuses
                    .filter((s) => s !== "submitted")
                    .map((s) => [s, statusLabels[s]]),
                ].map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </select>
              {search && <input type="hidden" name="search" value={search} />}
              <button type="submit">Apply</button>
            </form>
          </div>
          <div className="admin-table-scroll">
            <table className="admin-table operator-queue-table">
              <thead>
                <tr>
                  <th scope="col">Operator</th>
                  <th scope="col">Area</th>
                  <th scope="col">Vans</th>
                  <th scope="col">Submitted</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} data-selected={app?.id === row.id}>
                    <td>
                      <Link
                        href={href({ operator: row.id })}
                        aria-current={app?.id === row.id ? "true" : undefined}
                      >
                        {row.business_name || "Untitled application"}
                      </Link>
                      <small>
                        {row.registration_number || row.contact_name}
                      </small>
                    </td>
                    <td>{row.operating_base || "—"}</td>
                    <td>
                      {vehicleCounts
                        ? (vehicleCounts.get(row.owner_id) ?? 0)
                        : "—"}
                    </td>
                    <td>
                      <time dateTime={row.submitted_at ?? undefined}>
                        {shortDate(row.submitted_at)}
                      </time>
                    </td>
                    <td>
                      <span className={`status-badge status-${row.status}`}>
                        {row.status === "submitted"
                          ? "New"
                          : row.status === "changes_requested"
                            ? "Needs changes"
                            : statusLabels[row.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!rows.length && (
            <div className="admin-empty-state">
              <span className="admin-empty-icon" aria-hidden="true">
                ✓
              </span>
              <h3>
                {search || status !== "submitted"
                  ? "No matching operators"
                  : "You're all caught up"}
              </h3>
              <p>
                {search
                  ? "Try another operator name or registration number."
                  : "Operator applications will appear here once they are submitted."}
              </p>
              {search ? (
                <Link href="/admin">Clear search</Link>
              ) : (
                <Link href="/admin/documents">Manage document checklist</Link>
              )}
            </div>
          )}
          <nav className="admin-pagination" aria-label="Review queue pages">
            <span>Page {page}</span>
            <div>
              {page > 1 && (
                <Link href={href({ page: page - 1 })}>Previous</Link>
              )}
              {(result.count ?? 0) > page * 25 && (
                <Link href={href({ page: page + 1 })}>Next</Link>
              )}
            </div>
          </nav>
        </section>
        {app ? (
          <OperatorReviewPanel
            application={app}
            documents={docs.data as ApplicationDocument[]}
            requirements={(requirements.data as DocumentRequirement[]).filter(
              (r) =>
                r.active ||
                docs.data.some(
                  (d: ApplicationDocument) => d.category === r.code,
                ),
            )}
            events={events.data as ApplicationEvent[]}
            vehicleCount={
              vehicleCounts ? (vehicleCounts.get(app.owner_id) ?? 0) : undefined
            }
          />
        ) : (
          <section className="admin-review-panel admin-selection-empty">
            <span className="admin-selection-symbol" aria-hidden="true">
              ▤
            </span>
            <h2>Select an operator</h2>
            <p>
              Choose an application to review its documents and record a
              decision.
            </p>
          </section>
        )}
      </div>
    </AdminShell>
  );
}
