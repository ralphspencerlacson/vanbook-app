import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { SignOutButton } from "@/components/sign-out-button";
import { SessionRefresh } from "@/components/session-refresh";
import { requireWorkspace } from "@/lib/operators/server";
import { homeFor } from "@/lib/auth/access";
async function AccountContent() {
 const actor=await requireWorkspace("/account");
 if(!actor.ready || !actor.access) return <p role="alert">Account permissions are not configured yet. Please contact support.</p>;
 if(actor.access.role!=="customer") redirect(homeFor(actor.access));
 return <div className="space-y-6"><SessionRefresh/><div className="rounded-xl border border-teal-200 bg-teal-50 p-4"><p className="text-sm font-semibold text-teal-900">Customer account · Email confirmed</p><p className="mt-1 break-all text-sm text-teal-950">{actor.user.email}</p></div><p className="text-sm leading-6 text-slate-600">You are signed in to your customer account. Your session stays active until you sign out or it expires.</p><Link href="/" className="workspace-link">Browse vehicles</Link><SignOutButton/></div>;
}
export default function AccountPage() { return <AuthShell title="Your account" description="Manage your customer sign-in."><Suspense fallback={<p role="status">Checking your session…</p>}><AccountContent/></Suspense></AuthShell>; }
