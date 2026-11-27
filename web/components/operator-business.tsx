import {requireWorkspace} from "@/lib/operators/server";
import {WorkspaceShell} from "./workspace-shell";
export async function OperatorBusiness() {
 const actor=await requireWorkspace("/admin");
 const {data:app,error}=await actor.supabase.from("operator_applications").select().eq("owner_id",actor.user.id).single();
 if(error) throw new Error("Unable to load your business details.");
 return <WorkspaceShell title="My business" description="Your approved operator account." operator><section className="workspace-panel"><span className="status-badge status-approved">Approved operator</span><h2 className="workspace-section-title mt-4">{app.business_name}</h2><dl className="application-details">{[["Contact person",app.contact_name],["Contact email",app.contact_email],["Contact number",app.contact_phone],["Operating base",app.operating_base],["Service areas",app.service_areas.join(", ")]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><p className="workspace-muted mt-4">Contact administration to update your business details. Manage your vehicle listings from My vehicles.</p></section></WorkspaceShell>;
}
