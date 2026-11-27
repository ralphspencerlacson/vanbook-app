"use server";
import { createHash, randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/auth/site-url";
import { readCredentials } from "@/lib/auth/forms";
import { parseDraft } from "@/lib/operators/validation";

export type RegistrationResult = { success?: boolean; message: string; errors?: Record<string,string> };
export async function registerOperator(form: FormData): Promise<RegistrationResult> {
 const {email,password,errors:credentials}=readCredentials(form,true);
 const {draft,errors:business}=parseDraft(form,true);
 const errors={...credentials,...business};
 if(Object.keys(errors).length) return {message:"Please check the highlighted fields.",errors};
 if(email.toLowerCase()==="admin@vanbook.ph") return {message:"Use a dedicated business email for an operator account."};
 const files=[...form.entries()].filter(([key,value])=>key.startsWith("document:") && value instanceof File && value.size>0) as [string,File][];
 if(files.length>12 || files.reduce((sum,[,file])=>sum+file.size,0)>3*1024*1024) return {message:"Upload up to 12 files, with a combined size of 3 MB or less."};
 for(const [,file] of files) {
   if(!["application/pdf","image/png","image/jpeg"].includes(file.type) || file.name.length>255) return {message:"Documents must be PDF, PNG, or JPEG files."};
   const bytes=new Uint8Array(await file.slice(0,8).arrayBuffer());
   const valid=file.type==="application/pdf" ? new TextDecoder().decode(bytes.slice(0,5))==="%PDF-" : file.type==="image/png" ? [137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v) : bytes[0]===255 && bytes[1]===216 && bytes[2]===255;
   if(!valid) return {message:"A document does not match its file type. Choose a valid PDF, PNG, or JPEG."};
 }
 let admin;
 try { admin=createAdminClient(); } catch {return {message:"Operator registration is not configured yet. Please contact VANBOOK PH support."};}
 const requirements=await admin.from("operator_document_requirements").select().eq("active",true);
 if(requirements.error) return {message:"Operator registration is not available yet. Please try again later."};
 if(files.some(([key])=>!requirements.data.some(r=>key===`document:${r.code}`))) return {message:"The document checklist changed. Refresh the page and try again."};
 for(const requirement of requirements.data) if(requirement.required && !files.some(([key])=>key===`document:${requirement.code}`)) return {message:`Upload ${requirement.label} before submitting.`};
 const requestHeaders=await headers();
 const ip=requestHeaders.get("x-vercel-forwarded-for") ?? requestHeaders.get("x-forwarded-for") ?? "local";
 for(const value of ["ip:"+ip,"email:"+email.toLowerCase()]) {
   const limit=await admin.rpc("check_registration_limit",{p_key:createHash("sha256").update(value).digest("hex")});
   if(limit.error || !limit.data) return {message:"Too many registration attempts. Please wait 15 minutes before trying again."};
 }
 // createUser reserves a unique address without sending mail or starting a session.
 // Only a user created successfully by THIS request is eligible for rollback.
 const created=await admin.auth.admin.createUser({email,password,email_confirm:false,user_metadata:{account_type:"operator"}});
 if(created.error || !created.data.user) return {message:"We couldn't register this address. If you already registered, wait for approval or use password recovery."};
 const userId=created.data.user.id;
 const paths:string[]=[];
 try {
   const app=await admin.from("operator_applications").insert({owner_id:userId,...draft}).select("id").single();
   if(app.error) throw new Error("registration");
   for(const [key,file] of files) {
     const extension=file.type==="application/pdf" ? "pdf" : file.type==="image/png" ? "png" : "jpg";
     const path=`${userId}/${app.data.id}/${randomUUID()}.${extension}`;
     const upload=await admin.storage.from("operator-documents").upload(path,file,{contentType:file.type,upsert:false});
     if(upload.error) throw new Error("upload");
     paths.push(path);
     const document=await admin.from("operator_documents").insert({application_id:app.data.id,storage_path:path,category:key.slice(9),file_name:file.name,content_type:file.type,size_bytes:file.size});
     if(document.error) throw new Error("document");
   }
   const final=await admin.rpc("finalize_operator_registration",{p_id:app.data.id});
   if(final.error) throw new Error("registration");
 } catch {
   // If object cleanup fails, retain the pending identity for an admin to investigate;
   // Supabase refuses deletion while a user owns Storage objects.
   const cleanup=paths.length ? await admin.storage.from("operator-documents").remove(paths) : {error:null};
   if(!cleanup.error) await admin.auth.admin.deleteUser(userId);
   return {message:"We couldn't finish your registration. Please try again. Contact support if your address is already registered."};
 }
 try {
   const client=await createClient();
   const callback=new URL("/auth/callback",getSiteUrl());
   const sent=await client.auth.resend({type:"signup",email,options:{emailRedirectTo:callback.toString()}});
   if(sent.error) return {success:true,message:"Your application was submitted, but the confirmation email could not be sent. Use Resend confirmation email on the sign-in page. Approval and email verification are both required before sign-in."};
 } catch {return {success:true,message:"Your application was submitted. Use Resend confirmation email on the sign-in page to verify your address. Approval is required before sign-in."};}
 return {success:true,message:"Application submitted. Verify the confirmation email in this browser. You can sign in after an administrator approves your application."};
}
