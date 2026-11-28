import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardFilters } from "./dashboard-filters";
import { TableSortHeader } from "./table-sort-header";
import { nextTableSort } from "@/lib/table-sort";
import { AdminShell } from "./admin-shell";
import { OperatorReviewPanel } from "./operator-review-panel";
import type { OperatorVehicle, VehiclePhoto } from "@/lib/operators/vehicles";
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

const verificationSorts = {
  updated: {
    column: "updated_at",
    ascending: false,
    label: "Recently updated",
  },
  operator: {
    column: "business_name",
    ascending: true,
    label: "Operator: A–Z",
  },
  operator_desc: {
    column: "business_name",
    ascending: false,
    label: "Operator: Z–A",
  },
  area: { column: "operating_base", ascending: true, label: "Area: A–Z" },
  area_desc: { column: "operating_base", ascending: false, label: "Area: Z–A" },
  vans: {
    column: "vehicle_count",
    ascending: true,
    label: "Vans: fewest first",
  },
  vans_desc: {
    column: "vehicle_count",
    ascending: false,
    label: "Vans: most first",
  },
  submitted: {
    column: "submitted_at",
    ascending: true,
    label: "Submitted: oldest first",
  },
  submitted_desc: {
    column: "submitted_at",
    ascending: false,
    label: "Submitted: newest first",
  },
  status: { column: "status", ascending: true, label: "Status: A–Z" },
  status_desc: { column: "status", ascending: false, label: "Status: Z–A" },
} as const;
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
  const sort =
    typeof params.sort === "string" &&
    Object.hasOwn(verificationSorts, params.sort)
      ? (params.sort as keyof typeof verificationSorts)
      : "updated";
  const ordering = verificationSorts[sort];
  const activeFilters = [!!search, status !== "submitted"].filter(
    Boolean,
  ).length;
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
    .from("operator_verification_queue")
    .select("*", { count: "exact" })
    .order(ordering.column, {
      ascending: ordering.ascending,
      nullsFirst: false,
    })
    .order("id", { ascending: false })
    .range((page - 1) * 25, page * 25 - 1);
  if (status === "submitted")
    query = query.or(
      "status.eq.submitted,and(status.eq.approved,pending_vehicle_count.gt.0)",
    );
  else if (status !== "all") query = query.eq("status", status);
  if (search) {
    const pattern = JSON.stringify(`%${search}%`);
    query = query.or(
      `business_name.ilike.${pattern},registration_number.ilike.${pattern}`,
    );
  }
  const [result, waiting, approved, aged, rejected] = await Promise.all([
    query,
    actor.supabase
      .from("operator_verification_queue")
      .select("id", { count: "exact", head: true })
      .or(
        "status.eq.submitted,and(status.eq.approved,pending_vehicle_count.gt.0)",
      ),
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
  ]);
  if ([result, waiting, approved, aged, rejected].some((r) => r.error))
    throw new Error("Unable to load operator verification.");
  const rows = result.data as (OperatorApplication & {
    pending_vehicle_count: number;
    vehicle_count: number;
  })[];
  let app: (OperatorApplication & { vehicle_count: number }) | undefined =
    selected ? rows.find((r) => r.id === selected) : rows[0];
  if (selected && !app) {
    const record = await actor.supabase
      .from("operator_verification_queue")
      .select()
      .eq("id", selected)
      .maybeSingle();
    if (record.error) throw new Error("Unable to load this operator.");
    if (!record.data) notFound();
    app = record.data as OperatorApplication & { vehicle_count: number };
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
      .order("sort_order")
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
  const reviewVehicles = app
    ? await actor.supabase.rpc("get_operator_review_vehicles", {
        p_owner: app.owner_id,
      })
    : { data: [], error: null };
  if (reviewVehicles.error)
    throw new Error("Unable to load registered vehicles.");
  const vehicleRows = reviewVehicles.data as OperatorVehicle[];
  const vehiclePhotos = vehicleRows.length
    ? await actor.supabase
        .from("operator_vehicle_photos")
        .select()
        .in(
          "vehicle_id",
          vehicleRows.map((vehicle) => vehicle.id),
        )
    : { data: [], error: null };
  if (vehiclePhotos.error) throw new Error("Unable to load vehicle photos.");
  const href = (options: {
    operator?: string;
    page?: number;
    status?: string;
    sort?: string;
  }) =>
    "/admin?" +
    new URLSearchParams({
      status: options.status ?? status,
      sort: options.sort ?? sort,
      ...(search ? { search } : {}),
      page: String(options.page ?? page),
      ...(options.operator ? { operator: options.operator } : {}),
    });
  return (
    <AdminShell
      title="Operator verification"
      description="Review operator credentials, supporting documents, and business details before approval."
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
          </div>
          <DashboardFilters
            activeCount={activeFilters}
            defaultOpen={activeFilters > 0}
          >
            <form
              action="/admin"
              className="dashboard-list-controls"
              key={`${search}:${status}:${sort}`}
            >
              <label>
                <span className="filter-control-label">Search operators</span>
                <input
                  type="search"
                  name="search"
                  aria-label="Search operator or registration number"
                  placeholder="Name or registration no."
                  defaultValue={search}
                  maxLength={100}
                />
              </label>
              <label>
                <span className="filter-control-label">Application status</span>
                <select
                  name="status"
                  aria-label="Application status"
                  defaultValue={status}
                >
                  <option value="submitted">Waiting for review</option>
                  <option value="all">All applications</option>
                  {applicationStatuses
                    .filter((value) => value !== "submitted")
                    .map((value) => (
                      <option key={value} value={value}>
                        {statusLabels[value]}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                <span className="filter-control-label">Sort operators</span>
                <select
                  name="sort"
                  aria-label="Sort operators"
                  defaultValue={sort}
                >
                  {Object.entries(verificationSorts).map(([value, option]) => (
                    <option key={value} value={value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className="requirements-button">
                Apply filters
              </button>
              {(activeFilters > 0 || sort !== "updated") && (
                <Link href="/admin" className="filter-clear-button">
                  Clear filters
                </Link>
              )}
            </form>
          </DashboardFilters>
          <div className="admin-table-scroll">
            <table className="admin-table operator-queue-table">
              <thead>
                <tr>
                  {[
                    {
                      label: "Operator",
                      ascending: "operator",
                      descending: "operator_desc",
                    },
                    {
                      label: "Area",
                      ascending: "area",
                      descending: "area_desc",
                    },
                    {
                      label: "Vans",
                      ascending: "vans",
                      descending: "vans_desc",
                    },
                    {
                      label: "Submitted",
                      ascending: "submitted",
                      descending: "submitted_desc",
                    },
                    {
                      label: "Status",
                      ascending: "status",
                      descending: "status_desc",
                    },
                  ].map((column) => (
                    <TableSortHeader
                      key={column.label}
                      {...column}
                      sort={sort}
                      href={href({
                        sort: nextTableSort(
                          sort,
                          column.ascending,
                          column.descending,
                        ),
                        page: 1,
                        operator: selected,
                      })}
                    />
                  ))}
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
                      {row.operator_updated_at && (
                        <span
                          className="admin-operator-update"
                          title={new Date(
                            row.operator_updated_at,
                          ).toISOString()}
                        >
                          Updated by operator ·{" "}
                          {shortDate(row.operator_updated_at)}
                        </span>
                      )}
                    </td>
                    <td>{row.operating_base || "—"}</td>
                    <td>{row.vehicle_count}</td>
                    <td>
                      <time dateTime={row.submitted_at ?? undefined}>
                        {shortDate(row.submitted_at)}
                      </time>
                    </td>
                    <td>
                      <span className={`status-badge status-${row.status}`}>
                        {row.status === "approved" &&
                        row.pending_vehicle_count > 0
                          ? "Additional van review"
                          : row.status === "submitted"
                            ? "Initial registration"
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
            vehicles={vehicleRows}
            photos={vehiclePhotos.data as VehiclePhoto[]}
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
            vehicleCount={app.vehicle_count}
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
