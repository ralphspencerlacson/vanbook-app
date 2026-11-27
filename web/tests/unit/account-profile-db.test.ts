import { PGlite } from "@electric-sql/pglite";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from "vitest";
import { setupSystem, createSchema, seedUsers, actor, draft, approve, IDS } from "../fixtures/database";

let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await setupSystem(db);
  await createSchema(db);
  await seedUsers(db);
}, 30000);
afterAll(async () => { await db?.close(); });
beforeEach(async () => { await db.exec("begin; update public.operator_document_requirements set active=false;"); });
afterEach(async () => { await db.exec("rollback; reset role;"); });

it("updates only the current operator's contacts, user name and immutable audit event", async () => {
  const own = await draft(db);
  const other = await draft(db, IDS.other);
  await actor(db, IDS.operator);
  const result = await db.query<{ version: number }>(
    "select public.update_operator_contact_profile($1,$2,$3,$4) as version",
    [own.version, "  Updated Operator  ", "+639181234567", "new.contact@example.test"],
  );
  expect(result.rows[0].version).toBe(own.version + 1);
  const contact = (await db.query<{ contact_name: string; contact_phone: string; contact_email: string; operator_updated_at: string | null; status: string }>("select contact_name,contact_phone,contact_email,operator_updated_at,status from public.operator_applications where id=$1", [own.id])).rows[0];
  expect(contact).toMatchObject({ contact_name: "Updated Operator", contact_phone: "+639181234567", contact_email: "new.contact@example.test", status: "draft" });
  expect(contact.operator_updated_at).toBeTruthy();
  expect((await db.query("select full_name,email,role from public.users where id=$1", [IDS.operator])).rows[0]).toMatchObject({ full_name: "Updated Operator", email: "operator@example.test", role: "operator" });
  expect((await db.query("select note from public.operator_application_events where application_id=$1", [own.id])).rows).toContainEqual({ note: "Operator updated account contact details" });
  await db.exec("reset role;");
  expect((await db.query<{ contact_name: string }>("select contact_name from public.operator_applications where id=$1", [other.id])).rows[0].contact_name).toBe("Test Operator");
  await db.query("update auth.users set raw_user_meta_data=raw_user_meta_data || '{\"full_name\":\"Old metadata name\"}'::jsonb where id=$1", [IDS.operator]);
  expect((await db.query<{ full_name: string }>("select full_name from public.users where id=$1", [IDS.operator])).rows[0].full_name).toBe("Updated Operator");
});

it("keeps approved businesses approved and does not invalidate document reviews", async () => {
  const own = await draft(db);
  await approve(db, own.id);
  const version = (await db.query<{ version: number }>("select version from public.operator_applications where id=$1", [own.id])).rows[0].version;
  await actor(db, IDS.operator);
  await db.query("select public.update_operator_contact_profile($1,$2,$3,$4)", [version, "Updated Operator", "+639181234567", "new@example.test"]);
  expect((await db.query("select status,reviewed_at,reviewed_by from public.operator_applications where id=$1", [own.id])).rows[0]).toMatchObject({ status: "approved", reviewed_by: IDS.root });
});

it.each([IDS.customer, IDS.root])("rejects contact writes from a non-operator %s", async (id) => {
  await draft(db);
  await actor(db, id);
  await expect(db.query("select public.update_operator_contact_profile(1,'Other','+639171234567','other@example.test')")).rejects.toMatchObject({ code: "42501" });
});
it("rejects unconfirmed operators", async () => {
  await draft(db);
  await db.query("update auth.users set email_confirmed_at=null where id=$1", [IDS.operator]);
  await actor(db, IDS.operator);
  await expect(db.query("select public.update_operator_contact_profile(1,'Other','+639171234567','other@example.test')")).rejects.toMatchObject({ code: "42501" });
});
it.each([0, null])("rejects stale or missing versions %s", async (version) => {
  await draft(db);
  await actor(db, IDS.operator);
  await expect(db.query("select public.update_operator_contact_profile($1,'Other','+639171234567','other@example.test')", [version])).rejects.toMatchObject({ code: "40001" });
});
it("validates contact input in SQL", async () => {
  await draft(db);
  await actor(db, IDS.operator);
  await expect(db.query("select public.update_operator_contact_profile(1,'','letters','invalid')")).rejects.toMatchObject({ code: "22023" });
});
it("does not grant anonymous execution or direct browser profile updates", async () => {
  const privileges = (await db.query("select has_function_privilege('anon','public.update_operator_contact_profile(integer,text,text,text)','EXECUTE') as anonymous,has_column_privilege('authenticated','public.users','role','UPDATE') as roles,has_column_privilege('authenticated','public.operator_applications','contact_email','UPDATE') as contacts")).rows[0];
  expect(privileges).toEqual({ anonymous: false, roles: false, contacts: false });
});
