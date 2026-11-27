import Link from "next/link";
import { Suspense } from "react";
import { requireWorkspace } from "@/lib/operators/server";
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
  return (
    <AdminShell
      title={config.title}
      description={config.description}
      toolbar={
        <nav className="admin-period-tabs" aria-label="Date range">
          {[
            ["today", "Today"],
            ["week", "This week"],
            ["month", "This month"],
          ].map(([value, label]) => (
            <Link
              href={`/admin/${section}?period=${value}`}
              key={value}
              aria-current={period === value ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>
      }
    >
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
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                {config.columns.map((column) => (
                  <th key={column} scope="col">
                    {column}
                  </th>
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
