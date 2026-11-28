import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, beforeEach, afterEach, it, expect } from "vitest";
import {
  setupSystem,
  createSchema,
  seedUsers,
  draft,
  firstVan,
  actor,
  IDS,
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
    "begin; update public.operator_document_requirements set active=code in ('driver_license','vehicle_or_cr');",
  );
});
afterEach(async () => {
  await db.exec("rollback; reset role;");
});
async function version(table: string, id: string) {
  return (
    await db.query<{ version: number }>(
      `select version from public.${table} where id=$1`,
      [id],
    )
  ).rows[0].version;
}
async function upload(application: string) {
  const path = `${IDS.operator}/${application}/${randomUUID()}.pdf`;
  await db.exec("reset role;");
  await db.query(
    "insert into storage.objects(bucket_id,name) values('operator-documents',$1)",
    [path],
  );
  return {
    storage_path: path,
    file_name: "document.pdf",
    content_type: "application/pdf",
    size_bytes: 100,
  };
}
async function document(
  application: string,
  category: string,
  vehicle: string | null = null,
) {
  const file = await upload(application);
  return (
    await db.query<{ id: string }>(
      "insert into public.operator_documents(application_id,vehicle_id,category,storage_path,file_name,content_type,size_bytes) values($1,$2,$3,$4,$5,$6,$7) returning id",
      [
        application,
        vehicle,
        category,
        file.storage_path,
        file.file_name,
        file.content_type,
        file.size_bytes,
      ],
    )
  ).rows[0].id;
}
async function review(
  id: string,
  parent: string,
  table: string,
  status = "approved",
) {
  await actor(db, IDS.root);
  await db.query(
    "select public.review_operator_document($1,$2,$3,'Reviewed')",
    [id, await version(table, parent), status],
  );
}
async function initial() {
  const app = await draft(db);
  const van = await firstVan(db, app.id);
  const shared = await document(app.id, "driver_license");
  const perVan = await document(app.id, "vehicle_or_cr", van);
  await db.query("select public.finalize_operator_registration($1)", [app.id]);
  await review(shared, app.id, "operator_applications");
  await review(perVan, van, "operator_vehicles");
  await db.query(
    "select public.review_operator_application($1,$2,'approved','Initial verification')",
    [app.id, await version("operator_applications", app.id)],
  );
  return { app, van };
}
it("defines configurable user/van scope and rejects invalid scopes", async () => {
  await actor(db, IDS.root);
  expect(
    (
      await db.query(
        "select scope from public.operator_document_requirements where code='vehicle_or_cr'",
      )
    ).rows[0],
  ).toEqual({ scope: "van" });
  await db.query(
    "update public.operator_document_requirements set scope='van' where code='ltfrb_franchise'",
  );
  await expect(
    db.query(
      "update public.operator_document_requirements set scope='invalid'",
    ),
  ).rejects.toMatchObject({ code: "23514" });
});
it("requires a separate document for each van and refuses a shared upload for a van requirement", async () => {
  const app = await draft(db);
  const first = await firstVan(db, app.id);
  await firstVan(db, app.id);
  await document(app.id, "driver_license");
  await document(app.id, "vehicle_or_cr", first);
  await db.exec("savepoint missing_second;");
  await expect(
    db.query("select public.finalize_operator_registration($1)", [app.id]),
  ).rejects.toThrow("Upload required documents");
  await db.exec("rollback to savepoint missing_second;");
  await expect(document(app.id, "vehicle_or_cr")).rejects.toThrow(
    "Document scope does not match",
  );
});
it("approves the operator and first van atomically only after both document checklists pass", async () => {
  const app = await draft(db);
  const van = await firstVan(db, app.id);
  const shared = await document(app.id, "driver_license");
  await document(app.id, "vehicle_or_cr", van);
  await db.query("select public.finalize_operator_registration($1)", [app.id]);
  await review(shared, app.id, "operator_applications");
  await db.exec("savepoint incomplete;");
  await expect(
    db.query("select public.review_operator_application($1,$2,'approved','')", [
      app.id,
      await version("operator_applications", app.id),
    ]),
  ).rejects.toThrow("first-van documents");
  await db.exec("rollback to savepoint incomplete;");
  expect(
    (
      await db.query(
        "select status from public.operator_applications where id=$1",
        [app.id],
      )
    ).rows[0],
  ).toEqual({ status: "submitted" });
  expect(
    (
      await db.query(
        "select status from public.operator_vehicles where id=$1",
        [van],
      )
    ).rows[0],
  ).toEqual({ status: "draft" });
});
it("keeps additional vans hidden and shared approval intact through document correction and publication", async () => {
  const { app, van } = await initial();
  await db.exec("reset role;");
  const second = await firstVan(db, app.id);
  const doc = await document(app.id, "vehicle_or_cr", second);
  await review(doc, second, "operator_vehicles", "changes_requested");
  expect(
    (
      await db.query(
        "select status from public.operator_applications where id=$1",
        [app.id],
      )
    ).rows[0],
  ).toEqual({ status: "approved" });
  expect(
    (
      await db.query(
        "select status from public.operator_vehicles where id=$1",
        [van],
      )
    ).rows[0],
  ).toEqual({ status: "published" });
  await db.exec("savepoint unapproved;");
  await expect(
    db.query("select public.set_vehicle_status($1,$2,'published')", [
      second,
      await version("operator_vehicles", second),
    ]),
  ).rejects.toThrow("Approve required van documents");
  await db.exec("rollback to savepoint unapproved;");
  await review(doc, second, "operator_vehicles");
  await db.query("select public.set_vehicle_status($1,$2,'published')", [
    second,
    await version("operator_vehicles", second),
  ]);
  await actor(db, "", "anon");
  expect(
    (await db.query("select id from public.vehicle_listings")).rows,
  ).toHaveLength(2);
});
it("uses vehicle versions for van reviews and isolates documents across operators", async () => {
  const { app } = await initial();
  await db.exec("reset role;");
  const second = await firstVan(db, app.id);
  const doc = await document(app.id, "vehicle_or_cr", second);
  await actor(db, IDS.other);
  expect(
    (await db.query("select id from public.operator_documents")).rows,
  ).toHaveLength(0);
  await actor(db, IDS.root);
  await expect(
    db.query("select public.review_operator_document($1,999,'approved','')", [
      doc,
    ]),
  ).rejects.toMatchObject({ code: "40001" });
});
it("puts approved operators with pending additional vans into the verification queue", async () => {
  const { app } = await initial();
  expect(
    (
      await db.query(
        "select pending_vehicle_count from public.operator_verification_queue where id=$1",
        [app.id],
      )
    ).rows[0],
  ).toEqual({ pending_vehicle_count: 0 });
  await firstVan(db, app.id);
  await actor(db, IDS.root);
  expect(
    (
      await db.query(
        "select status,pending_vehicle_count from public.operator_verification_queue where id=$1",
        [app.id],
      )
    ).rows[0],
  ).toEqual({ status: "approved", pending_vehicle_count: 1 });
});
it("saves additional vans with their own uploads, rolls back incomplete submissions, and resets replacements to pending", async () => {
  const { app } = await initial();
  const front = {
    ...(await upload(app.id)),
    content_type: "image/png",
    position: "front",
  };
  const details = {
    title: "Nissan Urvan",
    make: "Nissan",
    model: "Urvan",
    model_year: 2025,
    seats: 15,
    location: "Manila",
    plate_number: "SECOND-123",
    amenities: [],
  };
  await actor(db, IDS.operator);
  await db.exec("savepoint missing_documents");
  await expect(
    db.query("select public.save_operator_vehicle(null,0,$1,$2,'[]')", [
      JSON.stringify(details),
      JSON.stringify([front]),
    ]),
  ).rejects.toThrow("Upload required van documents");
  await db.exec("rollback to savepoint missing_documents");
  expect(
    (await db.query("select * from public.get_managed_vehicles()")).rows,
  ).toHaveLength(1);
  const file = { ...(await upload(app.id)), category: "vehicle_or_cr" };
  await actor(db, IDS.operator);
  const second = (
    await db.query<{ id: string }>(
      "select public.save_operator_vehicle(null,0,$1,$2,$3) as id",
      [
        JSON.stringify(details),
        JSON.stringify([front]),
        JSON.stringify([file]),
      ],
    )
  ).rows[0].id;
  const doc = (
    await db.query<{ id: string }>(
      "select id from public.operator_documents where vehicle_id=$1",
      [second],
    )
  ).rows[0].id;
  await review(doc, second, "operator_vehicles");
  await db.query("select public.set_vehicle_status($1,$2,'published')", [
    second,
    await version("operator_vehicles", second),
  ]);
  const replacement = { ...(await upload(app.id)), category: "vehicle_or_cr" };
  await actor(db, IDS.operator);
  await db.query("select public.save_operator_vehicle($1,$2,$3,'[]',$4)", [
    second,
    await version("operator_vehicles", second),
    JSON.stringify(details),
    JSON.stringify([replacement]),
  ]);
  expect(
    (
      await db.query(
        "select review_status from public.operator_documents where vehicle_id=$1",
        [second],
      )
    ).rows,
  ).toEqual([{ review_status: "pending" }]);
  expect(
    (
      await db.query(
        "select id from public.operator_documents where vehicle_id is null and category='driver_license'",
      )
    ).rows,
  ).toHaveLength(1);
  expect(
    (
      await db.query(
        "select status from public.operator_applications where id=$1",
        [app.id],
      )
    ).rows[0],
  ).toEqual({ status: "approved" });
  await actor(db, "", "anon");
  expect(
    (await db.query("select id from public.vehicle_listings")).rows,
  ).toHaveLength(1);
});
it("rejects attaching a document to another operator’s van", async () => {
  const app = await draft(db);
  const otherApp = await draft(db, IDS.other);
  const van = await firstVan(db, otherApp.id);
  await expect(document(app.id, "vehicle_or_cr", van)).rejects.toMatchObject({
    code: "42501",
  });
});
