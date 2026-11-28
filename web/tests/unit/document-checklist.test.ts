import { PGlite } from "@electric-sql/pglite";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import {
  actor,
  createSchema,
  draft,
  IDS,
  migration,
  seedUsers,
  setupSystem,
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
  await db.exec("begin;");
});
afterEach(async () => {
  await db.exec("rollback; reset role;");
});

describe("dynamic document checklist", () => {
  it("starts with the six reference documents, with BIR optional and five required", async () => {
    const rows = (
      await db.query<{ code: string; required: boolean; sort_order: number }>(
        "select code,required,sort_order from public.operator_document_requirements where sort_order>0 order by sort_order",
      )
    ).rows;
    expect(rows.map((row) => row.code)).toEqual([
      "ltfrb_franchise",
      "vehicle_or_cr",
      "insurance",
      "driver_license",
      "business_permit",
      "bir_form_2303",
    ]);
    expect(rows.filter((row) => row.required)).toHaveLength(5);
    expect(rows.at(-1)?.required).toBe(false);
  });
  it("allows administrators to add and change checklist fields", async () => {
    await actor(db, IDS.root);
    await db.query(
      "insert into public.operator_document_requirements(code,label,description,required,active,sort_order) values('additional_certificate','Additional certificate','Upload a readable copy.',false,true,15)",
    );
    await db.query(
      "update public.operator_document_requirements set required=true,active=false,sort_order=5 where code='additional_certificate'",
    );
    expect(
      (
        await db.query(
          "select description,required,active,sort_order from public.operator_document_requirements where code='additional_certificate'",
        )
      ).rows,
    ).toEqual([
      {
        description: "Upload a readable copy.",
        required: true,
        active: false,
        sort_order: 5,
      },
    ]);
  });
  it("prevents customers from changing the checklist", async () => {
    await actor(db, IDS.customer);
    await expect(
      db.query(
        "insert into public.operator_document_requirements(code,label) values('forbidden','Forbidden')",
      ),
    ).rejects.toMatchObject({ code: "42501" });
  });
  it("enforces active required items, while inactive required items and optional items may be skipped", async () => {
    const application = await draft(db);
    await db.query(
      "update public.operator_document_requirements set required=false",
    );
    await db.query(
      "update public.operator_document_requirements set required=true,scope='user' where code='insurance'",
    );
    await db.exec("savepoint missing_document;");
    await expect(
      db.query("select public.finalize_operator_registration($1)", [
        application.id,
      ]),
    ).rejects.toMatchObject({ message: "Upload required documents" });
    await db.exec("rollback to savepoint missing_document;");
    await db.query(
      "update public.operator_document_requirements set active=false where code='insurance'",
    );
    await db.query("select public.finalize_operator_registration($1)", [
      application.id,
    ]);
    expect(
      (
        await db.query(
          "select status from public.operator_applications where id=$1",
          [application.id],
        )
      ).rows,
    ).toEqual([{ status: "submitted" }]);
  });
  it("rejects invalid display order at the database boundary", async () => {
    await expect(
      db.query(
        "update public.operator_document_requirements set sort_order=-1 where code='insurance'",
      ),
    ).rejects.toMatchObject({ code: "23514" });
  });
});

it("upgrades an existing checklist without replacing settings or deleting submitted files", async () => {
  const existing = new PGlite();
  try {
    await setupSystem(existing);
    await existing.exec("set role migration_runner;");
    await existing.exec(await migration("20261127000100_create_schema.sql"));
    await existing.exec("reset role;");
    await seedUsers(existing);
    const application = await draft(existing);
    await existing.query(
      "insert into public.operator_document_requirements(code,label,required,active) values('insurance','Existing insurance label',false,false)",
    );
    await existing.query(
      "insert into public.operator_documents(application_id,storage_path,category,file_name,content_type,size_bytes) values($1,'existing-file.pdf','insurance','existing-file.pdf','application/pdf',100)",
      [application.id],
    );
    await existing.exec("set role migration_runner;");
    await existing.exec(
      await migration("20261127000200_document_checklist.sql"),
    );
    // SQL Editor application can precede CLI migration tracking. Replay is safe.
    await existing.exec(
      await migration("20261127000200_document_checklist.sql"),
    );
    await existing.exec("reset role;");
    expect(
      (
        await existing.query(
          "select label,required,active,description,sort_order from public.operator_document_requirements where code='insurance'",
        )
      ).rows,
    ).toEqual([
      {
        label: "Existing insurance label",
        required: false,
        active: false,
        description: "",
        sort_order: 0,
      },
    ]);
    expect(
      (await existing.query("select file_name from public.operator_documents"))
        .rows,
    ).toEqual([{ file_name: "existing-file.pdf" }]);
  } finally {
    await existing.close();
  }
}, 30000);
