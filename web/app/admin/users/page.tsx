import Link from "next/link";
import { Suspense } from "react";
import { requireWorkspace } from "@/lib/operators/server";
import {
  WorkspaceShell,
  WorkspaceLoading,
  AccessDenied,
  WorkspaceUnavailable,
} from "@/components/workspace-shell";
import { AdminUsersForm } from "@/components/admin-users-form";
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
};
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
  const search =
    typeof params.search === "string" ? params.search.trim().slice(0, 100) : "";
  const page = Math.max(
    1,
    Math.min(10000, Number.parseInt(String(params.page ?? "1"), 10) || 1),
  );
  let query = actor.supabase
    .from("users")
    .select("id,email,full_name,role,email_confirmed_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id")
    .range((page - 1) * 25, page * 25 - 1);
  if (role !== "all") query = query.eq("role", role);
  if (search) query = query.ilike("email", `%${search}%`);
  const { data, error, count } = await query;
  if (error) throw new Error("Unable to load user accounts.");
  const href = (p: number) =>
    "/admin/users?" + new URLSearchParams({ role, search, page: String(p) });
  return (
    <WorkspaceShell
      title="Users"
      description="View customer, operator, and staff accounts and their roles."
      admin
    >
      <section className="workspace-panel">
        <form className="workspace-filters" action="/admin/users">
          <div>
            <label className="field-label" htmlFor="user-search">
              Search by email
            </label>
            <input
              className="field-input"
              id="user-search"
              name="search"
              maxLength={100}
              defaultValue={search}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="user-role">
              Account role
            </label>
            <select
              id="user-role"
              name="role"
              className="field-input"
              defaultValue={role}
            >
              <option value="all">All roles</option>
              {roles.map((r) => (
                <option value={r} key={r}>
                  {roleLabels[r]}
                </option>
              ))}
            </select>
          </div>
          <button className="workspace-secondary">Apply filters</button>
        </form>
        <h2 className="workspace-section-title">
          User accounts ({count ?? 0})
        </h2>
        {data.length ? (
          <ul className="operator-review-list">
            {(data as UserRow[]).map((u) => (
              <li key={u.id}>
                <div>
                  <strong>{u.full_name || u.email}</strong>
                  {u.full_name && <p>{u.email}</p>}
                </div>
                <p>
                  {roleLabels[u.role]} ·{" "}
                  {u.email_confirmed_at
                    ? "Email verified"
                    : "Email not verified"}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="workspace-empty">No users match these filters.</p>
        )}
        <nav className="workspace-pagination" aria-label="Users pagination">
          {page > 1 && (
            <Link href={href(page - 1)} className="workspace-secondary">
              Previous
            </Link>
          )}
          <span>Page {page}</span>
          {page * 25 < (count ?? 0) && (
            <Link href={href(page + 1)} className="workspace-secondary">
              Next
            </Link>
          )}
        </nav>
      </section>
      {actor.isSuperAdmin && (
        <section className="workspace-panel mt-5">
          <AdminUsersForm />
        </section>
      )}
    </WorkspaceShell>
  );
}
export default function Page(props: PageProps<"/admin/users">) {
  return (
    <Suspense fallback={<WorkspaceLoading />}>
      <Users {...props} />
    </Suspense>
  );
}
