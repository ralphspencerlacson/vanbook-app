// Test-only HTTP adapter around in-memory PostgreSQL. No Docker, disk database,
// hosted credentials, or application auth bypass is involved.
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";

export const OPERATOR_ID = "f28c2830-2944-4ec0-a7b8-1557c6309c08";
export const ADMIN_ID = "10000000-0000-4000-8000-000000000003";
const db = new PGlite();
await db.exec(`
  create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create schema storage;
  create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}',invited_at timestamptz);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
  create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,metadata jsonb,unique(bucket_id,name));
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1] $$;
  grant usage on schema public,auth,storage to anon,authenticated;
  grant select,insert,delete on storage.objects to authenticated;
  insert into auth.users(id,email,email_confirmed_at) values('${OPERATOR_ID}','traveller@example.test',now()),('${ADMIN_ID}','admin@example.test',now());
`);
await db.exec(
  await readFile(
    new URL(
      "../../../supabase/migrations/20261127000100_create_schema.sql",
      import.meta.url,
    ),
    "utf8",
  ),
);
await db.query("update public.users set role='super_admin' where id=$1", [
  ADMIN_ID,
]);

export async function resetOperatorData() {
  await db.exec(
    `truncate public.operator_applications cascade; truncate storage.objects; update public.users set role='customer'; update public.users set role='super_admin' where id='${ADMIN_ID}'; truncate public.operator_document_requirements; insert into public.operator_document_requirements(code,label) values('supporting_document','Supporting document');`,
  );
}
export async function setOperatorApproval(approved) {
  await db.query("update public.users set role='operator' where id=$1", [
    OPERATOR_ID,
  ]);
  let a = (
    await db.query(
      "select id,version,status from public.operator_applications where owner_id=$1",
      [OPERATOR_ID],
    )
  ).rows[0];
  if (!a) {
    a = (
      await db.query(
        "insert into public.operator_applications(owner_id,business_name,contact_name,contact_email,contact_phone,operating_base,service_areas) values($1,'Test Operator Business','Test Operator','traveller@example.test','+639171234567','Manila',array['Manila']) returning id,version,status",
        [OPERATOR_ID],
      )
    ).rows[0];
    await db.query("select public.finalize_operator_registration($1)", [a.id]);
  }
  if (approved) {
    a = (
      await db.query(
        "select id,version from public.operator_applications where owner_id=$1",
        [OPERATOR_ID],
      )
    ).rows[0];
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      ADMIN_ID,
    ]);
    await db.query(
      "select public.review_operator_application($1,$2,'approved','Test review')",
      [a.id, a.version],
    );
  }
}
const tables = new Set([
  "users",
  "operator_applications",
  "operator_documents",
  "operator_application_events",
  "operator_document_requirements",
]);
const identifier = (value) => {
  if (!/^[a-z_]+$/.test(value)) throw new Error("Invalid fixture identifier");
  return `"${value}"`;
};
export async function handleOperatorApi(req, res, url, body, actor, send) {
  if (
    !url.pathname.startsWith("/rest/v1/") &&
    !url.pathname.startsWith("/storage/v1/")
  )
    return false;
  if (!actor) {
    send(401, { message: "Authentication required", code: "PGRST301" });
    return true;
  }
  try {
    const data = await db.transaction(async (tx) => {
      await tx.exec("set local role authenticated;");
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
        actor.id,
      ]);
      if (url.pathname.startsWith("/storage/v1/")) {
        const prefix = "/storage/v1/object/";
        if (
          url.pathname.startsWith(prefix + "sign/operator-documents/") &&
          req.method === "POST"
        ) {
          const path = decodeURIComponent(
            url.pathname.slice((prefix + "sign/operator-documents/").length),
          );
          const visible = await tx.query(
            "select id from storage.objects where bucket_id='operator-documents' and name=$1",
            [path],
          );
          if (!visible.rows.length)
            throw Object.assign(new Error("Access denied"), { code: "42501" });
          return {
            signedURL: `/object/sign/operator-documents/${path}?token=fixture-only`,
          };
        }
        if (
          url.pathname.startsWith(prefix + "operator-documents/") &&
          req.method === "POST"
        ) {
          const path = decodeURIComponent(
            url.pathname.slice((prefix + "operator-documents/").length),
          );
          const result = await tx.query(
            "insert into storage.objects(bucket_id,name) values('operator-documents',$1) returning id",
            [path],
          );
          return { Id: result.rows[0].id, Key: `operator-documents/${path}` };
        }
        if (
          url.pathname === prefix + "operator-documents" &&
          req.method === "DELETE"
        ) {
          return (
            await tx.query(
              "delete from storage.objects where bucket_id='operator-documents' and name=any($1::text[]) returning name",
              [body.prefixes ?? []],
            )
          ).rows;
        }
        throw new Error("Unknown fixture storage request");
      }
      if (url.pathname.startsWith("/rest/v1/rpc/")) {
        const name = url.pathname.split("/").at(-1);
        if (name === "account_access")
          return (await tx.query("select public.account_access() as value"))
            .rows[0].value;
        if (name === "submit_operator_application")
          return [
            (
              await tx.query(
                "select row_to_json(public.submit_operator_application($1::uuid,$2::bigint)) as value",
                [body.p_id, body.p_version],
              )
            ).rows[0].value,
          ];
        if (name === "review_operator_application")
          return [
            (
              await tx.query(
                "select row_to_json(public.review_operator_application($1::uuid,$2::bigint,$3::text,$4::text)) as value",
                [body.p_id, body.p_version, body.p_decision, body.p_note],
              )
            ).rows[0].value,
          ];
        throw new Error("Unknown fixture RPC");
      }
      const table = url.pathname.split("/").at(-1);
      if (!tables.has(table)) throw new Error("Unknown fixture table");
      const params = [];
      const add = (value) => {
        params.push(value);
        return `$${params.length}`;
      };
      const clauses = [];
      for (const [key, value] of url.searchParams) {
        if (["select", "order", "offset", "limit", "on_conflict"].includes(key))
          continue;
        const column = identifier(key);
        if (value.startsWith("eq."))
          clauses.push(`${column}=${add(value.slice(3))}`);
        else if (value.startsWith("ilike."))
          clauses.push(`${column} ilike ${add(value.slice(6))}`);
        else if (value.startsWith("in.(") && value.endsWith(")"))
          clauses.push(
            `${column}::text=any(${add(value.slice(4, -1).split(","))}::text[])`,
          );
        else throw new Error("Unsupported fixture filter");
      }
      const where = clauses.length ? " where " + clauses.join(" and ") : "";
      let rows;
      if (req.method === "GET" || req.method === "HEAD") {
        const count = (
          await tx.query(
            `select count(*)::int as count from public.${identifier(table)}${where}`,
            params,
          )
        ).rows[0].count;
        res.setHeader("Content-Range", `0-${Math.max(0, count - 1)}/${count}`);
        let order = "";
        if (url.searchParams.get("order")) {
          order =
            " order by " +
            url.searchParams
              .get("order")
              .split(",")
              .map((value) => {
                const [column, direction] = value.split(".");
                return `${identifier(column)} ${direction === "desc" ? "desc" : "asc"}`;
              })
              .join(",");
        }
        const limit = Math.min(
          1000,
          Math.max(1, Number(url.searchParams.get("limit") ?? 1000)),
        );
        const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0));
        rows = (
          await tx.query(
            `select * from public.${identifier(table)}${where}${order} limit ${limit} offset ${offset}`,
            params,
          )
        ).rows;
      } else if (req.method === "POST") {
        const keys = Object.keys(body);
        const placeholders = keys.map((key) => add(body[key]));
        let conflict = "";
        if (
          table === "operator_document_requirements" &&
          String(req.headers.prefer).includes("resolution=merge-duplicates")
        )
          conflict = ` on conflict(code) do update set ${keys
            .filter((key) => key !== "code")
            .map((key) => `${identifier(key)}=excluded.${identifier(key)}`)
            .join(",")}`;
        rows = (
          await tx.query(
            `insert into public.${identifier(table)}(${keys.map(identifier).join(",")}) values(${placeholders.join(",")})${conflict} returning *`,
            params,
          )
        ).rows;
      } else if (req.method === "PATCH") {
        const updates = Object.keys(body)
          .map((key) => `${identifier(key)}=${add(body[key])}`)
          .join(",");
        rows = (
          await tx.query(
            `update public.${identifier(table)} set ${updates}${where} returning *`,
            params,
          )
        ).rows;
      } else if (req.method === "DELETE")
        rows = (
          await tx.query(
            `delete from public.${identifier(table)}${where} returning *`,
            params,
          )
        ).rows;
      else throw new Error("Unsupported fixture method");
      return String(req.headers.accept).includes(
        "application/vnd.pgrst.object+json",
      )
        ? (rows[0] ?? null)
        : rows;
    });
    send(200, data);
  } catch (error) {
    send(error.code === "42501" ? 403 : 400, {
      code: error.code ?? "fixture_error",
      message: error.message,
    });
  }
  return true;
}
