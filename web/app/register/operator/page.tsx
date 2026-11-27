import Link from "next/link";
import { Suspense } from "react";
import { BrandMark } from "@/components/brand-mark";
import { OperatorRegistrationForm } from "@/components/operator-registration-form";
import { createAdminClient, hasAdminKey } from "@/lib/supabase/admin";
import type { DocumentRequirement } from "@/lib/operators/types";
async function Registration() {
 if(!hasAdminKey()) return <p role="alert">Operator registration is not configured yet. Please contact VANBOOK PH support.</p>;
 const client=createAdminClient();
 const {data,error}=await client.from("operator_document_requirements").select().eq("active",true).order("label");
 if(error) return <p role="alert">Operator registration is not available yet. Please try again later.</p>;
 return <OperatorRegistrationForm requirements={data as DocumentRequirement[]}/>;
}
export default function Page() {return <div className="workspace-page"><header className="workspace-header"><BrandMark/><Link href="/sign-in" className="text-white">Sign in</Link></header><main className="registration-page workspace-panel"><h1 className="text-2xl font-bold">Register your operator business</h1><p className="workspace-muted my-4">Provide your account, business details, and documents. Our team will review your application before you can sign in.</p><Suspense fallback={<p role="status">Loading registration…</p>}><Registration/></Suspense></main></div>;}
