import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
export const IDS = {
  operator: "10000000-0000-4000-8000-000000000001",
  other: "10000000-0000-4000-8000-000000000002",
  root: "10000000-0000-4000-8000-000000000003",
  customer: "10000000-0000-4000-8000-000000000004",
};
export async function migration(name: string) {
  return readFile(
    new URL("../../../supabase/migrations/" + name, import.meta.url),
    "utf8",
  );
}
export async function setupSystem(db: PGlite) {
  await db.exec(
    "create role anon; create role authenticated; create role service_role bypassrls; create role migration_runner; create role auth_owner;" +
      "grant create on database postgres to migration_runner; create schema auth; create schema storage; create schema private authorization migration_runner;" +
      "create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb not null default '{}',invited_at timestamptz);" +
      "alter table auth.users owner to auth_owner;" +
      "create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;" +
      "create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);" +
      "create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,metadata jsonb,unique(bucket_id,name));" +
      "alter table storage.objects enable row level security; alter table storage.objects owner to migration_runner;" +
      "create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1] $$;" +
      "grant usage on schema public,auth,storage to anon,authenticated,service_role,migration_runner,auth_owner;" +
      "grant create on schema public to migration_runner; grant select,references,trigger on auth.users to migration_runner;" +
      "grant select,insert,update on storage.buckets to migration_runner; grant select,insert,delete on storage.objects to authenticated,service_role;" +
      "alter default privileges for role migration_runner in schema public grant all on tables to anon,authenticated;" +
      "alter default privileges for role migration_runner in schema public grant execute on functions to anon,authenticated;",
  );
}
export async function createSchema(db: PGlite) {
  await db.exec("set role migration_runner;");
  try {
    await db.exec(await migration("20261127000100_create_schema.sql"));
    await db.exec(await migration("20261127000200_document_checklist.sql"));
    await db.exec(await migration("20261127000300_operator_portal.sql"));
    await db.exec(await migration("20261128000100_account_profile.sql"));
    await db.exec(await migration("20261128000200_scoped_operator_documents.sql"));
    await db.exec(await migration("20261128000300_dashboard_listing_counts.sql"));
  } catch (error) {
    await db.exec("rollback;");
    throw error;
  } finally {
    await db.exec("reset role;");
  }
}
export async function seedUsers(db: PGlite) {
  for (const [key, id] of Object.entries(IDS)) {
    await db.query(
      "insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,now(),$3::jsonb)",
      [
        id,
        key === "root" ? "admin@vanbook.ph" : key + "@example.test",
        JSON.stringify({
          account_type: ["operator", "other"].includes(key)
            ? "operator"
            : "customer",
          full_name: key,
        }),
      ],
    );
  }
  await db.query("update public.users set role='super_admin' where id=$1", [
    IDS.root,
  ]);
}
export async function actor(db: PGlite, id: string, role = "authenticated") {
  if (!["authenticated", "anon", "service_role"].includes(role))
    throw new Error("Invalid test role");
  await db.exec("reset role; set role " + role + ";");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
}
export async function draft(db: PGlite, owner = IDS.operator) {
  await db.exec("reset role;");
  return (
    await db.query<{ id: string; version: number }>(
      "insert into public.operator_applications(owner_id,business_name,contact_name,contact_email,contact_phone,operating_base,service_areas) values($1,'Test Business','Test Operator','operator@example.test','+639171234567','Manila',array['Manila']) returning id,version",
      [owner],
    )
  ).rows[0];
}
export async function submit(db: PGlite, id: string) {
  await db.exec("reset role;");
  await db.query("select public.finalize_operator_registration($1)", [id]);
  return (
    await db.query<{ id: string; version: number }>(
      "select id,version from public.operator_applications where id=$1",
      [id],
    )
  ).rows[0];
}
export async function approve(db: PGlite, id: string) {
  await firstVan(db, id);
  const a = await submit(db, id);
  await actor(db, IDS.root);
  await db.query(
    "select public.review_operator_application($1,$2,'approved','Reviewed')",
    [id, a.version],
  );
}
export async function firstVan(db: PGlite, application: string) {
  await db.exec("reset role;");
  const van = (await db.query<{ id: string }>(
    "insert into public.operator_vehicles(operator_id,title,make,model,model_year,seats,location,plate_number) select owner_id,'Onboarding van','Toyota','Hiace',2025,12,'Manila','FIRST-123' from public.operator_applications where id=$1 returning id", [application],
  )).rows[0];
  await db.query("insert into public.operator_vehicle_photos(vehicle_id,storage_path,position,file_name,content_type,size_bytes) values($1,$2,'front','front.png','image/png',100)", [van.id, `${van.id}/front.png`]);
  return van.id;
}
