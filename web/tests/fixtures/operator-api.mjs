// Test-only HTTP adapter around in-memory PostgreSQL. No Docker, disk database,
// hosted credentials, or application auth bypass is involved.
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";

export const OPERATOR_ID = "f28c2830-2944-4ec0-a7b8-1557c6309c08";
export const ADMIN_ID = "10000000-0000-4000-8000-000000000003";
const db = new PGlite();
let verificationDelay = 0;
export function setVerificationDelay(value) {
  verificationDelay = value;
}
await db.exec(`
  create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create schema storage;
  create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}',invited_at timestamptz);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
  create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,metadata jsonb,unique(bucket_id,name));
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1] $$;
  grant usage on schema public,auth,storage to anon,authenticated,service_role;
  grant select,insert,delete on storage.objects to authenticated,service_role;
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
await db.exec(
  await readFile(
    new URL(
      "../../../supabase/migrations/20261127000200_document_checklist.sql",
      import.meta.url,
    ),
    "utf8",
  ),
);
await db.exec(
  await readFile(
    new URL(
      "../../../supabase/migrations/20261127000300_operator_portal.sql",
      import.meta.url,
    ),
    "utf8",
  ),
);
await db.exec(await readFile(new URL(
  "../../../supabase/migrations/20261128000100_account_profile.sql", import.meta.url,
), "utf8"));
await db.exec(await readFile(new URL(
  "../../../supabase/migrations/20261128000200_scoped_operator_documents.sql", import.meta.url,
), "utf8"));
export async function saveFixtureAuthUser(value) {
  await db.query(
    "insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,$3,$4::jsonb) on conflict(id) do update set email=excluded.email,email_confirmed_at=excluded.email_confirmed_at,raw_user_meta_data=excluded.raw_user_meta_data",
    [
      value.id,
      value.email,
      value.email_confirmed_at,
      JSON.stringify(value.user_metadata ?? {}),
    ],
  );
}
export async function removeFixtureAuthUser(id) {
  await db.query("delete from auth.users where id=$1", [id]);
}

export async function seedDocumentChecklist() {
  // Replay only the reference data, after the additive schema is already applied.
  const sql = await readFile(
    new URL(
      "../../../supabase/migrations/20261127000200_document_checklist.sql",
      import.meta.url,
    ),
    "utf8",
  );
  await db.exec(
    sql.slice(
      sql.indexOf("insert into public.operator_document_requirements"),
      sql.indexOf("commit;"),
    ),
  );
  await db.exec("update public.operator_document_requirements set scope='van' where code in ('vehicle_or_cr','insurance')");
}

export async function seedUserDirectory() {
  const roles = ["customer", "operator", "admin", "agent", "customer"];
  for (let index = 0; index < 30; index++) {
    const id = `50000000-0000-4000-9000-${String(index + 1).padStart(12, "0")}`;
    await db.query(
      "insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,$3,$4::jsonb)",
      [
        id,
        `directory${String(index + 1).padStart(2, "0")}@example.test`,
        index % 2 ? null : "2026-01-01T00:00:00Z",
        JSON.stringify({
          full_name: `Directory Person ${String(index + 1).padStart(2, "0")}`,
        }),
      ],
    );
    await db.query(
      "update public.users set role=$2,created_at='2026-01-01'::timestamptz + ($3::int * interval '1 day') where id=$1",
      [id, roles[index % roles.length], index],
    );
  }
}

export async function resetOperatorData() {
  verificationDelay = 0;
  await db.exec(
    `truncate public.operator_applications cascade; truncate storage.objects; delete from auth.users where id::text like '50000000-%' or id::text like '60000000-%'; update public.users set role='customer'; update public.users set role='super_admin' where id='${ADMIN_ID}'; truncate public.operator_document_requirements; insert into public.operator_document_requirements(code,label) values('supporting_document','Supporting document');`,
  );
}
export async function seedVerificationData() {
  await db.exec(
    "truncate public.operator_applications cascade; truncate storage.objects; truncate public.operator_document_requirements;",
  );
  const checklist = [
    ["ltfrb_franchise", "LTFRB franchise (CPC)"],
    ["or_cr", "Vehicle OR/CR"],
    ["seat_capacity", "Seats vs OR/CR"],
    ["insurance", "Insurance"],
    ["driver_license", "Driver’s license"],
    ["business_permit", "Business permit"],
  ];
  for (const [code, label] of checklist)
    await db.query(
      "insert into public.operator_document_requirements(code,label,required) values($1,$2,true)",
      [code, label],
    );
  const businesses = [
    ["Lakbay Luzon Travel", "Rizal", "submitted", 2],
    ["Bayanihan Transport", "Metro Manila", "submitted", 5],
    ["Southbound Tours", "Laguna", "changes_requested", 24],
    ["Island Road Van Rental", "Cavite", "submitted", 50],
    ["Northstar Travel Co.", "Bulacan", "approved", 72],
  ];
  for (let index = 0; index < businesses.length; index++) {
    const [name, area, status, hours] = businesses[index];
    const owner = `50000000-0000-4000-8000-00000000000${index + 1}`;
    await db.query(
      'insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,now(),\'{"account_type":"operator"}\') on conflict(id) do nothing',
      [owner, `operator${index + 1}@example.test`],
    );
    await db.query("update public.users set role='operator' where id=$1", [
      owner,
    ]);
    const app = (
      await db.query(
        "insert into public.operator_applications(owner_id,business_name,registration_number,contact_name,contact_email,contact_phone,operating_base,service_areas,status,submitted_at,updated_at) values($1,$2,$3,'Test Contact',$4,'+639171234567',$5,array[$5],$6,now()-($7::text||' hours')::interval,now()-($7::text||' hours')::interval) returning id",
        [
          owner,
          name,
          `CPC-2026-000${index + 1}`,
          `operator${index + 1}@example.test`,
          area,
          status,
          hours,
        ],
      )
    ).rows[0];
    await db.query(
      "insert into public.operator_application_events(application_id,actor_id,from_status,to_status,note) values($1,$2,'draft','submitted','Application received')",
      [app.id, owner],
    );
    if (index === 0)
      for (const [category] of checklist) {
        const path = `${owner}/${app.id}/${category}.pdf`;
        await db.query(
          "insert into storage.objects(bucket_id,name) values('operator-documents',$1)",
          [path],
        );
        await db.query(
          "insert into public.operator_documents(application_id,storage_path,category,file_name,content_type,size_bytes) values($1,$2,$3,$4,'application/pdf',2048)",
          [app.id, path, category, category + ".pdf"],
        );
      }
  }
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
    await db.query("with van as (insert into public.operator_vehicles(operator_id,title,make,model,model_year,seats,location,plate_number) select $1,'First van','Toyota','Hiace',2025,12,'Manila','FIRST-123' where not exists(select 1 from public.operator_vehicles where operator_id=$1) returning id) insert into public.operator_vehicle_photos(vehicle_id,storage_path,position,file_name,content_type,size_bytes) select id,id::text||'/front.png','front','front.png','image/png',100 from van", [OPERATOR_ID]);
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
  "operator_verification_queue",
  "operator_documents",
  "operator_application_events",
  "operator_document_requirements",
  "operator_vehicles",
  "operator_vehicle_photos",
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
    if (verificationDelay && url.pathname === "/rest/v1/operator_applications")
      await new Promise((resolve) => setTimeout(resolve, verificationDelay));
    const data = await db.transaction(async (tx) => {
      await tx.exec(
        actor.service_role
          ? "set local role service_role;"
          : "set local role authenticated;",
      );
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
        if (name === "update_operator_contact_profile")
          return (await tx.query(
            "select public.update_operator_contact_profile($1,$2,$3,$4) as value",
            [body.p_version, body.p_name, body.p_phone, body.p_contact_email],
          )).rows[0].value;
        if (name === "check_registration_limit")
          return (
            await tx.query(
              "select public.check_registration_limit($1) as value",
              [body.p_key],
            )
          ).rows[0].value;
        if (name === "finalize_operator_registration") {
          await tx.query("select public.finalize_operator_registration($1)", [
            body.p_id,
          ]);
          return null;
        }
        if (name === "operator_resubmit_application") {
          await tx.query(
            "select public.operator_resubmit_application($1,$2,$3::jsonb,$4::jsonb)",
            [
              body.p_id,
              body.p_version,
              JSON.stringify(body.p_details),
              JSON.stringify(body.p_documents),
            ],
          );
          return null;
        }
        if (name === "review_operator_document") {
          await tx.query(
            "select public.review_operator_document($1,$2,$3,$4)",
            [body.p_id, body.p_version, body.p_status, body.p_note],
          );
          return null;
        }
        if (name === "save_operator_vehicle")
          return (
            await tx.query(
              "select public.save_operator_vehicle($1,$2,$3::jsonb,$4::jsonb,$5::jsonb) as value",
              [
                body.p_id,
                body.p_version,
                JSON.stringify(body.p_details),
                JSON.stringify(body.p_photos),
                JSON.stringify(body.p_documents ?? []),
              ],
            )
          ).rows[0].value;
        if (name === "set_vehicle_availability") {
          await tx.query("select public.set_vehicle_availability($1,$2,$3)", [
            body.p_id,
            body.p_version,
            body.p_available,
          ]);
          return null;
        }
        if (name === "set_vehicle_status") {
          await tx.query("select public.set_vehicle_status($1,$2,$3)", [
            body.p_id,
            body.p_version,
            body.p_status,
          ]);
          return null;
        }
        if (name === "get_operator_review_vehicles")
          return (
            await tx.query(
              "select * from public.get_operator_review_vehicles($1)",
              [body.p_owner],
            )
          ).rows;
        if (name === "get_managed_vehicles")
          return (
            await tx.query(
              "select * from public.get_managed_vehicles($1::uuid)",
              [body.p_id ?? null],
            )
          ).rows;
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
        if (key === "or") {
          if (value === "(status.eq.submitted,and(status.eq.approved,pending_vehicle_count.gt.0))") {
            clauses.push("(status='submitted' or (status='approved' and pending_vehicle_count>0))"); continue;
          }
          const match = value.match(
            /^\(([a-z_]+)\.ilike\.("(?:\\.|[^"\\])*"),([a-z_]+)\.ilike\.("(?:\\.|[^"\\])*")\)$/,
          );
          if (!match) throw new Error("Unsupported fixture search");
          const allowed =
            table === "users"
              ? ["email", "full_name"]
              : ["business_name", "registration_number"];
          if (!allowed.includes(match[1]) || !allowed.includes(match[3]))
            throw new Error("Unsupported fixture search columns");
          clauses.push(
            `(${identifier(match[1])} ilike ${add(JSON.parse(match[2]))} or ${identifier(match[3])} ilike ${add(JSON.parse(match[4]))})`,
          );
          continue;
        }
        const column = identifier(key);
        if (value === "is.null") clauses.push(`${column} is null`);
        else if (value === "not.is.null") clauses.push(`${column} is not null`);
        else if (value.startsWith("eq."))
          clauses.push(`${column}=${add(value.slice(3))}`);
        else if (value.startsWith("ilike."))
          clauses.push(`${column} ilike ${add(value.slice(6))}`);
        else if (value.startsWith("lt."))
          clauses.push(`${column}<${add(value.slice(3))}`);
        else if (value.startsWith("gte."))
          clauses.push(`${column}>=${add(value.slice(4))}`);
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
