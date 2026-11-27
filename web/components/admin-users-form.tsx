"use client";
import {useState,type FormEvent} from "react";
import {inviteAdministrator} from "@/app/admin/users/actions";
export function AdminUsersForm() {
 const [result,setResult]=useState<{message:string;success?:boolean}>();const [pending,setPending]=useState(false);
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();const form=e.currentTarget;setPending(true);try {const r=await inviteAdministrator(new FormData(form));setResult(r);if(r.success) form.reset();} catch {setResult({message:"We couldn't send the invitation. Try again."});} finally {setPending(false);}}
 return <form onSubmit={submit} className="space-y-4"><h2 className="workspace-section-title">Add an administrator</h2><p className="workspace-muted">New admins can manage all operators and vehicles. Only the super admin can add admin users. Support agent access is reserved for a later phase.</p><label htmlFor="admin-email" className="field-label">Administrator email</label><input id="admin-email" name="email" type="email" required maxLength={254} className="field-input" disabled={pending}/><button className="primary-button" disabled={pending}>{pending?"Sending…":"Send admin invitation"}</button>{result && <p role={result.success?"status":"alert"} className="workspace-feedback">{result.message}</p>}</form>;
}
