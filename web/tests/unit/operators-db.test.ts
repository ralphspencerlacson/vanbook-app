import { PGlite } from "@electric-sql/pglite";
import {
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  describe,
  it,
  expect,
} from "vitest";
import {
  setupSystem,
  createSchema,
  seedUsers,
  actor,
  draft,
  submit,
  approve,
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
  await db.exec("begin;");
  // These isolation/review cases use the original optional checklist. Dedicated
  // checklist tests exercise the six active product requirements separately.
  await db.exec("update public.operator_document_requirements set active=false where code <> 'supporting_document'");
});
afterEach(async () => {
  await db.exec("rollback; reset role;");
});
describe("VANBOOK roles, registration and document permissions", () => {
  it("keeps customer profile access private and blocks self-promotion", async () => {
    await actor(db, IDS.customer);
    expect((await db.query("select id from public.users")).rows).toEqual([
      { id: IDS.customer },
    ]);
    await expect(
      db.query("update public.users set role='super_admin' where id=$1", [
        IDS.customer,
      ]),
    ).rejects.toMatchObject({ code: "42501" });
  });
  it("does not expose user emails to anonymous callers", async () => {
    await actor(db, "", "anon");
    await expect(
      db.query("select email from public.users"),
    ).rejects.toMatchObject({ code: "42501" });
  });
  it("does not turn signup metadata into an administrator role", async () => {
    const id = "30000000-0000-4000-8000-000000000001";
    await db.query(
      'insert into auth.users(id,email,raw_user_meta_data) values($1,\'fake@example.test\',\'{"role":"super_admin","account_type":"admin"}\')',
      [id],
    );
    expect(
      (await db.query("select role from public.users where id=$1", [id])).rows,
    ).toEqual([{ role: "customer" }]);
  });
  it("synchronizes Auth profile changes without changing the protected role", async () => {
    await db.query(
      'update auth.users set email=\'new@example.test\',raw_user_meta_data=\'{"full_name":"New Name","account_type":"super_admin"}\' where id=$1',
      [IDS.customer],
    );
    expect(
      (
        await db.query(
          "select email,full_name,role from public.users where id=$1",
          [IDS.customer],
        )
      ).rows,
    ).toEqual([
      { email: "new@example.test", full_name: "New Name", role: "customer" },
    ]);
  });
  it("shows all users to administrators and no management permissions to reserved agents", async () => {
    await actor(db, IDS.root);
    expect((await db.query("select * from public.users")).rows).toHaveLength(4);
    await db.exec("reset role;");
    await db.query("update public.users set role='agent' where id=$1", [
      IDS.customer,
    ]);
    await actor(db, IDS.customer);
    expect((await db.query("select * from public.users")).rows).toHaveLength(1);
    await expect(
      db.query("select * from public.get_managed_vehicles()"),
    ).rejects.toMatchObject({ code: "42501" });
  });
  it("blocks pending operators from reading business and document data", async () => {
    const a = await draft(db);
    await submit(db, a.id);
    await actor(db, IDS.operator);
    expect(
      (await db.query("select * from public.operator_applications")).rows,
    ).toEqual([]);
    expect(
      (await db.query("select * from public.operator_documents")).rows,
    ).toEqual([]);
    expect(
      (
        await db.query<{ access: { approved: boolean } }>(
          "select public.account_access() as access",
        )
      ).rows[0].access.approved,
    ).toBe(false);
  });
  it("does not allow browser clients to create or approve applications", async () => {
    await actor(db, IDS.operator);
    await expect(
      db.query(
        "insert into public.operator_applications(owner_id) values($1)",
        [IDS.operator],
      ),
    ).rejects.toMatchObject({ code: "42501" });
  });
  it("validates required business fields during server-only submission", async () => {
    const a = await draft(db);
    await db.query(
      "update public.operator_applications set business_name='' where id=$1",
      [a.id],
    );
    await expect(
      db.query("select public.finalize_operator_registration($1)", [a.id]),
    ).rejects.toMatchObject({ message: "Complete required business fields" });
  });
  it("requires uploaded files to satisfy required document categories", async () => {
    const a = await draft(db);
    await db.exec(
      "update public.operator_document_requirements set required=true",
    );
    await expect(
      db.query("select public.finalize_operator_registration($1)", [a.id]),
    ).rejects.toMatchObject({ message: "Upload required documents" });
  });
  it("records submission and admin approval and exposes only the owner's approved business", async () => {
    const a = await draft(db);
    await approve(db, a.id);
    await actor(db, IDS.operator);
    expect(
      (await db.query("select id from public.operator_applications")).rows,
    ).toEqual([{ id: a.id }]);
    expect(
      (
        await db.query(
          "select to_status from public.operator_application_events order by created_at,to_status",
        )
      ).rows,
    ).toHaveLength(2);
    await actor(db, IDS.other);
    expect(
      (await db.query("select id from public.operator_applications")).rows,
    ).toEqual([]);
  });
  it("rejects stale administrator decisions", async () => {
    const a = await draft(db);
    await submit(db, a.id);
    await actor(db, IDS.root);
    await expect(
      db.query(
        "select public.review_operator_application($1,$2,'approved','')",
        [a.id, a.version],
      ),
    ).rejects.toMatchObject({ code: "40001" });
  });
  it("requires verified email before approval", async () => {
    const a = await draft(db);
    const sent = await submit(db, a.id);
    await db.query(
      "update auth.users set email_confirmed_at=null where id=$1",
      [IDS.operator],
    );
    await actor(db, IDS.root);
    await expect(
      db.query(
        "select public.review_operator_application($1,$2,'approved','')",
        [a.id, sent.version],
      ),
    ).rejects.toMatchObject({
      message: "Operator must verify their email before approval",
    });
  });
  it("keeps document files private across operators", async () => {
    const a = await draft(db);
    const path = IDS.operator + "/" + a.id + "/document.pdf";
    await db.query(
      "insert into storage.objects(bucket_id,name) values('operator-documents',$1)",
      [path],
    );
    await db.query(
      "insert into public.operator_documents(application_id,storage_path,category,file_name,content_type,size_bytes) values($1,$2,'supporting_document','document.pdf','application/pdf',100)",
      [a.id, path],
    );
    await approve(db, a.id);
    await actor(db, IDS.operator);
    expect((await db.query("select * from storage.objects")).rows).toHaveLength(
      1,
    );
    await actor(db, IDS.other);
    expect((await db.query("select * from storage.objects")).rows).toHaveLength(
      0,
    );
    expect(
      (await db.query("select * from public.operator_documents")).rows,
    ).toHaveLength(0);
    await actor(db, IDS.root);
    expect(
      (await db.query("select * from public.operator_documents")).rows,
    ).toHaveLength(1);
  });
  it("executes protected invitation functions and creates admin users only from trusted invitations", async () => {
    const id = "30000000-0000-4000-8000-000000000002";
    await db.query(
      "select public.reserve_admin_invitation('staff@example.test',$1)",
      [IDS.root],
    );
    await db.query(
      "select public.release_admin_invitation('staff@example.test',$1)",
      [IDS.root],
    );
    await db.query(
      "select public.reserve_admin_invitation('staff@example.test',$1)",
      [IDS.root],
    );
    await db.query(
      "insert into auth.users(id,email,invited_at) values($1,'staff@example.test',now())",
      [id],
    );
    expect(
      (await db.query("select role from public.users where id=$1", [id])).rows,
    ).toEqual([{ role: "admin" }]);
  });
  it("revokes anonymous and browser execution of server provisioning functions", async () => {
    const r = (
      await db.query(
        "select has_function_privilege('anon','public.finalize_operator_registration(uuid)','execute') as anon,has_function_privilege('authenticated','public.reserve_admin_invitation(text,uuid)','execute') as browser,has_function_privilege('service_role','public.finalize_operator_registration(uuid)','execute') as server",
      )
    ).rows[0];
    expect(r).toEqual({ anon: false, browser: false, server: true });
  });
  it("enforces a private bucket and file limits", async () => {
    const b = (
      await db.query<{ public: boolean; file_size_limit: number }>(
        "select * from storage.buckets where id='operator-documents'",
      )
    ).rows[0];
    expect(b.public).toBe(false);
    expect(Number(b.file_size_limit)).toBe(10485760);
  });
  it("keeps private vehicle details away from public catalog readers", async () => {
    const a = await draft(db);
    await approve(db, a.id);
    await actor(db, IDS.operator);
    const v = (
      await db.query<{ id: string; version: number }>(
        "insert into public.operator_vehicles(operator_id,title,make,model,model_year,seats,location,plate_number) values($1,'Group Van','Toyota','Hiace',2025,12,'Manila','PRIVATE-123') returning id,version",
        [IDS.operator],
      )
    ).rows[0];
    await actor(db, IDS.root);
    await db.query("select public.set_vehicle_status($1,$2,'published')", [
      v.id,
      v.version,
    ]);
    await actor(db, IDS.customer);
    expect(
      (await db.query("select title from public.vehicle_listings")).rows,
    ).toEqual([{ title: "Group Van" }]);
    await expect(
      db.query("select plate_number from public.operator_vehicles"),
    ).rejects.toMatchObject({ code: "42501" });
  });
  it("limits vehicle management to its owner and administrators", async () => {
    const a = await draft(db);
    await approve(db, a.id);
    await actor(db, IDS.operator);
    const v = (
      await db.query<{ id: string; version: number }>(
        "insert into public.operator_vehicles(operator_id,title,make,model,model_year,seats,location,plate_number) values($1,'Group Van','Toyota','Hiace',2025,12,'Manila','ABC123') returning id,version",
        [IDS.operator],
      )
    ).rows[0];
    expect(
      (await db.query("select * from public.get_managed_vehicles()")).rows,
    ).toHaveLength(1);
    await actor(db, IDS.customer);
    await expect(
      db.query("select public.set_vehicle_status($1,$2,'published')", [
        v.id,
        v.version,
      ]),
    ).rejects.toMatchObject({ code: "42501" });
  });
});
