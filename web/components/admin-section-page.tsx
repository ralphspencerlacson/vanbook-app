import Link from "next/link";
import { Suspense } from "react";
import { requireWorkspace } from "@/lib/operators/server";
import { DashboardFilters } from "./dashboard-filters";
import { TableSortHeader } from "./table-sort-header";
import { nextTableSort } from "@/lib/table-sort";
import { AdminShell } from "./admin-shell";
import { AdminMetric } from "./admin-verification";
import {
  AccessDenied,
  WorkspaceLoading,
  WorkspaceUnavailable,
} from "./workspace-shell";

type Section = "bookings" | "fees" | "complaints" | "reports";
const sections = {
  bookings: {
    title: "Bookings and escalations",
    description:
      "Keep an eye on trips, follow-ups, and bookings that need attention.",
    metrics: [
      "Completed bookings",
      "Net fee revenue",
      "Quotes within 60 min",
      "Operator cancellations",
    ],
    columns: ["Booking", "Route", "Trip date", "Operator", "Fee", "Status"],
    empty: "No bookings to display",
    hint: "Bookings and trip updates will appear here as customers book their journeys.",
  },
  fees: {
    title: "Fee ledger",
    description: "A clear view of booking fees, collections, and adjustments.",
    metrics: [
      "Fees collected",
      "Awaiting collection",
      "Adjustments",
      "Refunds",
    ],
    columns: ["Reference", "Booking", "Operator", "Date", "Amount", "Status"],
    empty: "Your fee ledger is clear",
    hint: "Fee entries will appear here when booking transactions are recorded.",
  },
  complaints: {
    title: "Complaints",
    description: "Review customer concerns and keep track of resolutions.",
    metrics: [
      "Open complaints",
      "Needs follow-up",
      "Resolved this month",
      "Escalated",
    ],
    columns: [
      "Reference",
      "Customer",
      "Booking",
      "Category",
      "Received",
      "Status",
    ],
    empty: "No complaints to review",
    hint: "Customer concerns will appear here when they are submitted.",
  },
  reports: {
    title: "Reports",
    description:
      "Monitor booking activity, operator performance, and service quality.",
    metrics: [
      "Total bookings",
      "Completed trips",
      "Booking revenue",
      "Cancellation rate",
    ],
    columns: ["Period", "Bookings", "Completed", "Revenue", "Cancellations"],
    empty: "No report activity yet",
    hint: "Reports will become available as booking activity is recorded.",
  },
} as const;

async function Content({
  section,
  searchParams,
}: {
  section: Section;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requireWorkspace(`/admin/${section}`);
  if (!actor.ready) return <WorkspaceUnavailable admin />;
  if (!actor.isAdmin) return <AccessDenied />;
  const params = await searchParams;
  const period =
    params?.period === "today" || params?.period === "month"
      ? params.period
      : "week";
  const config = sections[section];
  const columns = config.columns.map((label) => ({
    label,
    ascending: label.toLowerCase().replaceAll(" ", "_"),
    descending: label.toLowerCase().replaceAll(" ", "_") + "_desc",
  }));
  const sort =
    typeof params?.sort === "string" &&
    columns.some(
      (column) =>
        column.ascending === params.sort || column.descending === params.sort,
    )
      ? params.sort
      : "";
  const href = (nextPeriod = period, nextSort = sort) =>
    `/admin/${section}?` +
    new URLSearchParams({
      period: nextPeriod,
      ...(nextSort ? { sort: nextSort } : {}),
    });
  return (
    <AdminShell title={config.title} description={config.description}>
      <div className="admin-metrics">
        {config.metrics.map((label) => (
          <AdminMetric
            key={label}
            label={label}
            value="—"
            detail="No activity recorded"
          />
        ))}
      </div>
      {section === "bookings" && (
        <section className="admin-surface admin-escalations">
          <h2>Needs action now</h2>
          <div className="admin-clear-state">
            <span aria-hidden="true">✓</span>
            <div>
              <strong>No escalations to review</strong>
              <p>Time-sensitive booking alerts will appear here.</p>
            </div>
          </div>
        </section>
      )}
      <section className="admin-surface">
        <div className="requirements-list-heading">
          <h2>
            {section === "fees"
              ? "Transactions"
              : section === "reports"
                ? "Activity reports"
                : section === "complaints"
                  ? "Complaint listing"
                  : "Booking listing"}
          </h2>
        </div>
        <DashboardFilters
          activeCount={Number(period !== "week")}
          defaultOpen={period !== "week"}
        >
          <div className="dashboard-list-controls">
            <nav className="admin-period-tabs" aria-label="Date range">
              {[
                ["today", "Today"],
                ["week", "This week"],
                ["month", "This month"],
              ].map(([value, label]) => (
                <Link
                  href={href(value as typeof period)}
                  key={value}
                  aria-current={period === value ? "page" : undefined}
                >
                  {label}
                </Link>
              ))}
            </nav>
            <form
              action={`/admin/${section}`}
              className="dashboard-list-controls"
              key={sort}
            >
              <input type="hidden" name="period" value={period} />
              <label>
                <span className="filter-control-label">Sort listing</span>
                <select
                  name="sort"
                  aria-label="Sort listing"
                  defaultValue={sort}
                >
                  <option value="">Default order</option>
                  {columns.flatMap((column) => [
                    <option key={column.ascending} value={column.ascending}>
                      {column.label}: ascending
                    </option>,
                    <option key={column.descending} value={column.descending}>
                      {column.label}: descending
                    </option>,
                  ])}
                </select>
              </label>
              <button type="submit" className="requirements-button">
                Apply filters
              </button>
            </form>
          </div>
        </DashboardFilters>
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                {columns.map((column) => (
                  <TableSortHeader
                    key={column.label}
                    {...column}
                    sort={sort}
                    href={href(
                      period,
                      nextTableSort(sort, column.ascending, column.descending),
                    )}
                  />
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={config.columns.length}>
                  <div className="admin-empty-state">
                    <span className="admin-empty-icon" aria-hidden="true">
                      {section === "complaints" ? "✓" : "▤"}
                    </span>
                    <h2>{config.empty}</h2>
                    <p>{config.hint}</p>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  );
}
export function AdminSectionPage(props: {
  section: Section;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<WorkspaceLoading />}>
      <Content {...props} />
    </Suspense>
  );
}
