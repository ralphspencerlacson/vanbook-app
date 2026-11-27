import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, beforeEach, afterEach, it, expect } from "vitest";
import {
  setupSystem,
  createSchema,
  seedUsers,
  actor,
  draft,
  IDS,
  submit,
} from "../fixtures/database";
let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await setupSystem(db);
  await createSchema(db);
  await seedUsers(db);
}, 30000);
afterAll(async () => {
  await db?.close();
});
beforeEach(async () => {
  await db.exec(
    "begin; update public.operator_document_requirements set active=false;",
  );
});
afterEach(async () => {
  await db.exec("rollback; reset role;");
});
const details = {
  business_name: "Updated operator business",
  registration_number: "REG-1",
  contact_name: "Juan",
  contact_email: "owner@example.test",
  contact_phone: "+639171234567",
  operating_base: "Manila",
  service_areas: ["Manila"],
  notes: "Updated information",
};
const vehicle = {
  title: "Toyota Hiace",
  make: "Toyota",
  model: "Hiace",
  model_year: 2024,
  seats: 15,
  plate_number: "ABC 1234",
  location: "Manila",
  description: "",
  amenities: ["Air conditioning"],
};
async function uploaded(
  application: string,
  category = "supporting_document",
  name = "original.pdf",
) {
  await db.exec("reset role;");
  const path = `${IDS.operator}/${application}/${name}`;
  await db.query(
    "insert into storage.objects(bucket_id,name) values('operator-documents',$1)",
    [path],
  );
  return {
    category,
    storage_path: path,
    file_name: name,
    content_type: "application/pdf",
    size_bytes: 100,
  };
}
async function document(application: string) {
  const file = await uploaded(application);
  return (
    await db.query<{ id: string }>(
      "insert into public.operator_documents(application_id,category,storage_path,file_name,content_type,size_bytes) values($1,$2,$3,$4,$5,$6) returning id",
      [
        application,
        file.category,
        file.storage_path,
        file.file_name,
        file.content_type,
        file.size_bytes,
      ],
    )
  ).rows[0].id;
}
async function version(id: string) {
  await db.exec("reset role;");
  return (
    await db.query<{ version: number }>(
      "select version from public.operator_applications where id=$1",
      [id],
    )
  ).rows[0].version;
}

it("keeps pending applications, documents and files visible only to their owner and admins", async () => {
  const app = await draft(db);
  await document(app.id);
  await submit(db, app.id);
  await actor(db, IDS.operator);
  expect(
    (await db.query("select id from public.operator_applications")).rows,
  ).toHaveLength(1);
  expect(
    (await db.query("select id from public.operator_documents")).rows,
  ).toHaveLength(1);
  expect((await db.query("select id from storage.objects")).rows).toHaveLength(
    1,
  );
  await actor(db, IDS.other);
  expect(
    (await db.query("select id from public.operator_documents")).rows,
  ).toHaveLength(0);
  expect((await db.query("select id from storage.objects")).rows).toHaveLength(
    0,
  );
});
it("requires email confirmation for pending operator access", async () => {
  await draft(db);
  await db.query("update auth.users set email_confirmed_at=null where id=$1", [
    IDS.operator,
  ]);
  await actor(db, IDS.operator);
  expect(
    (await db.query("select id from public.operator_applications")).rows,
  ).toHaveLength(0);
  await expect(
    db.query("select * from public.get_managed_vehicles()"),
  ).rejects.toMatchObject({ code: "42501" });
});
it("records document replacement requests and resets replacement review on resubmission", async () => {
  const app = await draft(db);
  const doc = await document(app.id);
  const sent = await submit(db, app.id);
  await actor(db, IDS.root);
  await db.query(
    "select public.review_operator_document($1,$2,'changes_requested','Upload a current certificate')",
    [doc, sent.version],
  );
  expect(
    (
      await db.query(
        "select review_status from public.operator_documents where id=$1",
        [doc],
      )
    ).rows,
  ).toEqual([{ review_status: "changes_requested" }]);
  const nextVersion = await version(app.id);
  const replacement = await uploaded(
    app.id,
    "supporting_document",
    "replacement.pdf",
  );
  await db.query(
    "update public.operator_document_requirements set active=true where code='supporting_document'",
  );
  await actor(db, IDS.operator);
  await db.query(
    "select public.operator_resubmit_application($1,$2,$3::jsonb,$4::jsonb)",
    [
      app.id,
      nextVersion,
      JSON.stringify(details),
      JSON.stringify([replacement]),
    ],
  );
  expect(
    (
      await db.query(
        "select review_status,file_name from public.operator_documents where application_id=$1",
        [app.id],
      )
    ).rows,
  ).toEqual([{ review_status: "pending", file_name: "replacement.pdf" }]);
  const changed = (
    await db.query<{
      status: string;
      operator_updated_at: string | null;
      resubmitted_at: string | null;
      business_name: string;
    }>(
      "select status,operator_updated_at,resubmitted_at,business_name from public.operator_applications where id=$1",
      [app.id],
    )
  ).rows[0];
  expect(changed.status).toBe("submitted");
  expect(changed.business_name).toBe(details.business_name);
  expect(changed.operator_updated_at).toBeTruthy();
  expect(changed.resubmitted_at).toBeTruthy();
  expect(
    (
      await db.query(
        "select note from public.operator_application_events where application_id=$1 order by created_at",
        [app.id],
      )
    ).rows,
  ).toContainEqual({
    note: "Operator updated and resubmitted their application",
  });
});
it("does not allow another operator to resubmit someone else's application", async () => {
  const app = await draft(db);
  const v = await version(app.id);
  await actor(db, IDS.other);
  await expect(
    db.query(
      "select public.operator_resubmit_application($1,$2,$3::jsonb,'[]')",
      [app.id, v, JSON.stringify(details)],
    ),
  ).rejects.toMatchObject({ code: "42501" });
});
it("rejects stale application edits", async () => {
  const app = await draft(db);
  await submit(db, app.id);
  await actor(db, IDS.operator);
  await expect(
    db.query(
      "select public.operator_resubmit_application($1,$2,$3::jsonb,'[]')",
      [app.id, app.version, JSON.stringify(details)],
    ),
  ).rejects.toMatchObject({ code: "40001" });
});
it("does not accept a missing concurrency version for application edits", async () => {
  const app = await draft(db);
  await actor(db, IDS.operator);
  await expect(
    db.query(
      "select public.operator_resubmit_application($1,null,$2::jsonb,'[]')",
      [app.id, JSON.stringify(details)],
    ),
  ).rejects.toMatchObject({ code: "40001" });
});
it("prevents owners from self-approving documents", async () => {
  const app = await draft(db);
  const doc = await document(app.id);
  const v = await version(app.id);
  await actor(db, IDS.operator);
  await expect(
    db.query("select public.review_operator_document($1,$2,'approved','')", [
      doc,
      v,
    ]),
  ).rejects.toMatchObject({ code: "42501" });
});
it("requires admin approval of mandatory documents before business approval", async () => {
  const app = await draft(db);
  const doc = await document(app.id);
  await db.query(
    "update public.operator_document_requirements set active=true,required=true where code='supporting_document'",
  );
  const sent = await submit(db, app.id);
  await actor(db, IDS.root);
  await db.exec("savepoint pending_docs");
  await expect(
    db.query("select public.review_operator_application($1,$2,'approved','')", [
      app.id,
      sent.version,
    ]),
  ).rejects.toThrow("Approve each required document");
  await db.exec("rollback to savepoint pending_docs");
  await db.query(
    "select public.review_operator_document($1,$2,'approved','Valid')",
    [doc, sent.version],
  );
  const v = await version(app.id);
  await actor(db, IDS.root);
  await db.query(
    "select public.review_operator_application($1,$2,'approved','Reviewed')",
    [app.id, v],
  );
  expect(
    (
      await db.query(
        "select status from public.operator_applications where id=$1",
        [app.id],
      )
    ).rows,
  ).toEqual([{ status: "approved" }]);
});
it("saves pending-owner vans and private photos but blocks publishing and availability", async () => {
  const app = await draft(db);
  const file = await uploaded(app.id, "", "front.png");
  const photo = { ...file, position: "front", content_type: "image/png" };
  await actor(db, IDS.operator);
  const id = (
    await db.query<{ id: string }>(
      "select public.save_operator_vehicle(null,0,$1::jsonb,$2::jsonb) as id",
      [JSON.stringify(vehicle), JSON.stringify([photo])],
    )
  ).rows[0].id;
  expect(
    (await db.query("select * from public.get_managed_vehicles()")).rows,
  ).toHaveLength(1);
  expect(
    (
      await db.query(
        "select id from public.operator_vehicle_photos where vehicle_id=$1",
        [id],
      )
    ).rows,
  ).toHaveLength(1);
  await db.exec("savepoint availability");
  await expect(
    db.query("select public.set_vehicle_availability($1,1,true)", [id]),
  ).rejects.toThrow("Approval is required");
  await db.exec("rollback to savepoint availability");
  await actor(db, IDS.other);
  expect(
    (
      await db.query(
        "select id from public.operator_vehicle_photos where vehicle_id=$1",
        [id],
      )
    ).rows,
  ).toHaveLength(0);
  expect(
    (await db.query("select * from public.get_managed_vehicles()")).rows,
  ).toHaveLength(0);
});
it("allows vehicle edits with existing photos and prevents cross-owner updates", async () => {
  const app = await draft(db);
  const file = await uploaded(app.id, "", "front.png");
  await actor(db, IDS.operator);
  const id = (
    await db.query<{ id: string }>(
      "select public.save_operator_vehicle(null,0,$1::jsonb,$2::jsonb) as id",
      [
        JSON.stringify(vehicle),
        JSON.stringify([
          { ...file, position: "front", content_type: "image/png" },
        ]),
      ],
    )
  ).rows[0].id;
  await db.query("select public.save_operator_vehicle($1,1,$2::jsonb,'[]')", [
    id,
    JSON.stringify({
      ...vehicle,
      model: "Hiace Premium",
      title: "Toyota Hiace Premium",
    }),
  ]);
  const rows = (
    await db.query<{ title: string; version: number }>(
      "select * from public.get_managed_vehicles($1)",
      [id],
    )
  ).rows;
  expect(rows[0].title).toBe("Toyota Hiace Premium");
  expect(rows[0].version).toBe(2);
  await draft(db, IDS.other);
  await actor(db, IDS.other);
  await expect(
    db.query("select public.save_operator_vehicle($1,2,$2::jsonb,'[]')", [
      id,
      JSON.stringify(vehicle),
    ]),
  ).rejects.toMatchObject({ code: "42501" });
});
