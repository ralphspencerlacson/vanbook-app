"use client";
import { useState, useRef, type FormEvent } from "react";
import Link from "next/link";
import { registerOperator, type RegistrationResult } from "@/app/register/operator/actions";
import type { DocumentRequirement } from "@/lib/operators/types";
import { useHydrated } from "./use-hydrated";
const fields=[
 ["email","Account email","email",254], ["password","Password","password",128], ["confirmPassword","Confirm password","password",128],
 ["business_name","Business name","text",200], ["registration_number","Business registration number (optional)","text",100],
 ["contact_name","Contact person","text",150], ["contact_email","Contact email","email",254], ["contact_phone","Contact number","tel",30],
 ["operating_base","Operating base","text",200], ["service_areas","Service areas (separate with commas)","text",3000],
] as const;
export function OperatorRegistrationForm({requirements}:{requirements:DocumentRequirement[]}) {
 const [result,setResult]=useState<RegistrationResult>(); const [pending,setPending]=useState(false); const busy=useRef(false); const hydrated=useHydrated();
 async function submit(e:FormEvent<HTMLFormElement>) {
  e.preventDefault(); if(busy.current) return; busy.current=true;setPending(true);
  const form=new FormData(e.currentTarget);
  const files=[...form.values()].filter((v):v is File=>v instanceof File);
  try {if(files.reduce((n,f)=>n+f.size,0)>3*1024*1024) {setResult({message:"Keep the combined document size at 3 MB or less."});return;} setResult(await registerOperator(form));}
  catch {setResult({message:"We couldn't submit your application. Check your connection and try again."});}
  finally {busy.current=false;setPending(false);}
 }
 return <>{result && <p role={result.success?"status":"alert"} className={`workspace-feedback ${result.success?"is-success":"is-error"}`}>{result.message}</p>}
 {!result?.success && <form onSubmit={submit} className="registration-grid" aria-busy={pending}>
 {fields.map(([key,label,type,max])=><div key={key}><label className="field-label" htmlFor={key}>{label}</label><input className="field-input" id={key} name={key} type={type} maxLength={max} minLength={type==="password"?8:undefined} autoComplete={type==="password"?"new-password":key==="email"?"email":"off"} required={key!=="registration_number"} disabled={pending || !hydrated} aria-invalid={!!result?.errors?.[key]} aria-describedby={result?.errors?.[key]?`${key}-error`:undefined}/>{result?.errors?.[key] && <p className="field-error" id={`${key}-error`}>{result.errors[key]}</p>}</div>)}
 <div className="registration-wide"><label htmlFor="notes" className="field-label">Additional information (optional)</label><textarea className="field-input" id="notes" name="notes" maxLength={3000} disabled={pending}/></div>
 <fieldset className="registration-wide space-y-4"><legend className="font-semibold">Business documents</legend><p className="workspace-muted">PDF, PNG, or JPEG. Combined upload limit: 3 MB. Your documents are private and reviewed by administrators.</p>
 {requirements.map(r=><div key={r.code}><label className="field-label" htmlFor={`document:${r.code}`}>{r.label} {r.required?"(required)":"(optional)"}</label><input className="field-input" id={`document:${r.code}`} name={`document:${r.code}`} type="file" accept="application/pdf,image/png,image/jpeg" required={r.required} disabled={pending}/></div>)}</fieldset>
 <p className="workspace-muted registration-wide">Verify your email after submitting. Sign-in remains blocked until an administrator approves your application.</p>
 <button className="primary-button registration-wide" disabled={pending || !hydrated}>{pending?"Submitting…":"Submit operator registration"}</button></form>}
 <Link href="/sign-in" className="workspace-link">Back to sign-in</Link></>;
}
