import Link from "next/link";
import { Suspense } from "react";
import { requireWorkspace } from "@/lib/operators/server";
import {
  WorkspaceLoading,
  AccessDenied,
  WorkspaceUnavailable,
} from "@/components/workspace-shell";
import { AdminShell } from "@/components/admin-shell";
import { AdminUsersForm } from "@/components/admin-users-form";
import { DashboardFilters } from "@/components/dashboard-filters";
import { TableSortHeader } from "@/components/table-sort-header";
import { nextTableSort } from "@/lib/table-sort";
import type { AccountAccess } from "@/lib/auth/access";

const roles: AccountAccess["role"][] = [
  "customer",
  "operator",
  "admin",
  "super_admin",
  "agent",
];
const roleLabels: Record<AccountAccess["role"], string> = {
  customer: "Customer",
  operator: "Operator",
  admin: "Admin",
  super_admin: "Super admin",
  agent: "Agent (not enabled)",
};
type UserRow = {
  id: string;
  email: string;
  full_name: string;
  role: AccountAccess["role"];
  email_confirmed_at: string | null;
  created_at: string;
};
const sortOptions = {
  newest: {
    column: "created_at",
    ascending: false,
    label: "Joined: newest first",
  },
  oldest: {
    column: "created_at",
    ascending: true,
    label: "Joined: oldest first",
  },
  name: { column: "full_name", ascending: true, label: "User: A–Z" },
  name_desc: { column: "full_name", ascending: false, label: "User: Z–A" },
  role: { column: "role", ascending: true, label: "Role: A–Z" },
  role_desc: { column: "role", ascending: false, label: "Role: Z–A" },
  verified: {
    column: "email_confirmed_at",
    ascending: true,
    label: "Email: verified first",
  },
  unverified: {
    column: "email_confirmed_at",
    ascending: true,
    label: "Email: not verified first",
  },
} as const;
const date = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "Asia/Manila",
});

async function Users({ searchParams }: PageProps<"/admin/users">) {
  const actor = await requireWorkspace("/admin/users");
  if (!actor.ready) return <WorkspaceUnavailable />;
  if (!actor.isAdmin) return <AccessDenied />;
  const params = await searchParams;
  const role =
    typeof params.role === "string" &&
    roles.includes(params.role as AccountAccess["role"])
      ? params.role
      : "all";
  const verification =
    params.verification === "verified" || params.verification === "unverified"
      ? params.verification
      : "all";
  const sort =
    typeof params.sort === "string" && Object.hasOwn(sortOptions, params.sort)
      ? (params.sort as keyof typeof sortOptions)
      : "newest";
  const search =
    typeof params.search === "string" ? params.search.trim().slice(0, 100) : "";
  const page = Math.max(
    1,
    Math.min(10000, Number.parseInt(String(params.page ?? "1"), 10) || 1),
  );
  let query = actor.supabase
    .from("users")
    .select("id,email,full_name,role,email_confirmed_at,created_at", {
      count: "exact",
    });
  const ordering = sortOptions[sort];
  query = query.order(ordering.column, {
    ascending: ordering.ascending,
    nullsFirst: sort === "unverified",
  });
  if (sort === "name" || sort === "name_desc")
    query = query.order("email", { ascending: sort === "name" });
  query = query.order("id").range((page - 1) * 25, page * 25 - 1);
  if (role !== "all") query = query.eq("role", role);
  if (verification === "verified")
    query = query.not("email_confirmed_at", "is", null);
  if (verification === "unverified")
    query = query.is("email_confirmed_at", null);
  if (search) {
    const pattern = JSON.stringify(`%${search}%`);
    query = query.or(`email.ilike.${pattern},full_name.ilike.${pattern}`);
  }
  const [result, all, customers, operators, staff] = await Promise.all([
    query,
    actor.supabase.from("users").select("id", { count: "exact", head: true }),
    actor.supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("role", "customer"),
    actor.supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("role", "operator"),
    actor.supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .in("role", ["admin", "super_admin", "agent"]),
  ]);
  if ([result, all, customers, operators, staff].some((item) => item.error))
    throw new Error("Unable to load user accounts.");
  const rows = result.data as UserRow[];
  const count = result.count ?? 0;
  const href = (next: number, nextSort = sort) =>
    "/admin/users?" +
    new URLSearchParams({
      role,
      search,
      verification,
      sort: nextSort,
      page: String(next),
    });
  const activeFilters = [
    role !== "all",
    !!search,
    verification !== "all",
  ].filter(Boolean).length;
  const filtered =
    role !== "all" || search || verification !== "all" || sort !== "newest";
  return (
    <AdminShell
      title="Users"
      description="View customer, operator, and staff accounts and their roles."
      toolbar={actor.isSuperAdmin ? <AdminUsersForm /> : undefined}
    >
      <div className="admin-metrics users-metrics">
        {[
          ["All accounts", all.count, "Registered on VANBOOK"],
          ["Customers", customers.count, "Personal and group travellers"],
          ["Operators", operators.count, "Registered business accounts"],
          ["Staff", staff.count, "Admin and reserved agent roles"],
        ].map(([label, count, detail]) => (
          <div className="admin-metric" key={label}>
            <span>{label}</span>
            <strong>{count ?? 0}</strong>
            <small>{detail}</small>
          </div>
        ))}
      </div>
      <section
        className="requirements-list users-directory"
        aria-labelledby="users-list-title"
      >
        <header className="requirements-list-heading">
          <div>
            <h2 id="users-list-title">User accounts ({count})</h2>
            <p>Find an account by name or email, then narrow the results.</p>
          </div>
          <span className="users-count">
            {count} {count === 1 ? "account" : "accounts"}
          </span>
        </header>
        <DashboardFilters
          activeCount={activeFilters}
          defaultOpen={activeFilters > 0}
        >
          <form
            className="users-filters"
            action="/admin/users"
            key={`${role}:${search}:${verification}:${sort}`}
          >
            <label className="users-search">
              <span className="filter-control-label">Search users</span>
              <input
                type="search"
                aria-label="Search users"
                name="search"
                maxLength={100}
                placeholder="Name or email address…"
                defaultValue={search}
              />
            </label>
            <label>
              <span className="filter-control-label">Account role</span>
              <select name="role" aria-label="Account role" defaultValue={role}>
                <option value="all">All roles</option>
                {roles.map((value) => (
                  <option value={value} key={value}>
                    {roleLabels[value]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="filter-control-label">Email status</span>
              <select
                name="verification"
                aria-label="Email status"
                defaultValue={verification}
              >
                <option value="all">All email statuses</option>
                <option value="verified">Verified</option>
                <option value="unverified">Not verified</option>
              </select>
            </label>
            <label>
              <span className="filter-control-label">Sort users</span>
              <select name="sort" aria-label="Sort users" defaultValue={sort}>
                {Object.entries(sortOptions).map(([value, option]) => (
                  <option key={value} value={value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="users-filter-actions">
              <button type="submit" className="requirements-button">
                Apply filters
              </button>
              {filtered && (
                <Link href="/admin/users" className="filter-clear-button">
                  Clear filters
                </Link>
              )}
            </div>
          </form>
        </DashboardFilters>
        <div className="users-table-wrap">
          <table className="users-table">
            <caption className="sr-only">
              User names, emails, roles, email verification, and registration
              dates
            </caption>
            <thead>
              <tr>
                {[
                  { label: "User", ascending: "name", descending: "name_desc" },
                  { label: "Role", ascending: "role", descending: "role_desc" },
                  {
                    label: "Email status",
                    ascending: "verified",
                    descending: "unverified",
                  },
                  {
                    label: "Joined",
                    ascending: "oldest",
                    descending: "newest",
                  },
                ].map((column) => (
                  <TableSortHeader
                    key={column.label}
                    {...column}
                    sort={sort}
                    href={href(
                      1,
                      nextTableSort(
                        sort,
                        column.ascending,
                        column.descending,
                      ) as keyof typeof sortOptions,
                    )}
                  />
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((user) => (
                <tr key={user.id}>
                  <th scope="row">
                    <div className="users-identity">
                      <span className="users-avatar" aria-hidden="true">
                        {(user.full_name || user.email)
                          .trim()
                          .split(/\s+/)
                          .slice(0, 2)
                          .map((part) => part[0])
                          .join("")
                          .toUpperCase()}
                      </span>
                      <div>
                        <strong>{user.full_name || "No name provided"}</strong>
                        <span>{user.email}</span>
                      </div>
                    </div>
                  </th>
                  <td data-label="Role">
                    <span className={`user-role-badge role-${user.role}`}>
                      {roleLabels[user.role]}
                    </span>
                  </td>
                  <td data-label="Email status">
                    <span
                      className={`user-verification ${user.email_confirmed_at ? "is-verified" : "is-unverified"}`}
                    >
                      <span aria-hidden="true">
                        {user.email_confirmed_at ? "✓" : "○"}
                      </span>{" "}
                      {user.email_confirmed_at
                        ? "Email verified"
                        : "Email not verified"}
                    </span>
                  </td>
                  <td data-label="Joined" className="users-joined">
                    {date.format(new Date(user.created_at))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && (
          <div className="requirements-empty">
            <h3>No users match these filters</h3>
            <p>Try a different name, email address, role, or email status.</p>
            <Link href="/admin/users" className="filter-clear-button">
              Clear filters
            </Link>
          </div>
        )}
        <footer className="users-list-footer">
          <span>
            {rows.length
              ? `${(page - 1) * 25 + 1}–${(page - 1) * 25 + rows.length}`
              : "0"}{" "}
            of {count} accounts
          </span>
          <nav aria-label="Users pagination">
            {page > 1 && <Link href={href(page - 1)}>← Previous</Link>}
            <span>Page {page}</span>
            {page * 25 < count && <Link href={href(page + 1)}>Next →</Link>}
          </nav>
        </footer>
      </section>
    </AdminShell>
  );
}
export default function Page(props: PageProps<"/admin/users">) {
  return (
    <Suspense fallback={<WorkspaceLoading />}>
      <Users {...props} />
    </Suspense>
  );
}
