import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { describe, it, expect } from "vitest";
import {
  setupSystem,
  createSchema,
  seedUsers,
  IDS,
} from "../fixtures/database";

describe("initial VANBOOK schema migration", () => {
  it("creates protected application tables without obsolete role tables", async () => {
    const db = new PGlite();
    try {
      await setupSystem(db);
      await createSchema(db);
      const tables = (
        await db.query<{ tablename: string; rowsecurity: boolean }>(
          "select tablename,rowsecurity from pg_tables where schemaname='public' order by tablename",
        )
      ).rows;
      expect(tables.map((t) => t.tablename)).toEqual([
        "operator_application_events",
        "operator_applications",
        "operator_document_requirements",
        "operator_documents",
        "operator_vehicle_photos",
        "operator_vehicles",
        "users",
      ]);
      expect(tables.every((t) => t.rowsecurity)).toBe(true);
      expect((await db.query("select * from public.users")).rows).toEqual([]);
      const id = "30000000-0000-4000-8000-000000000003";
      await db.query(
        "insert into auth.users(id,email) values($1,'new-user@example.test')",
        [id],
      );
      expect(
        (await db.query("select id,role from public.users where id=$1", [id]))
          .rows,
      ).toEqual([{ id, role: "customer" }]);
    } finally {
      await db.close();
    }
  }, 30000);

  it("preserves existing Auth accounts and files, backfills profiles, and supports super-admin bootstrap", async () => {
    const db = new PGlite();
    try {
      await setupSystem(db);
      await db.query(
        "insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,'admin@vanbook.ph',now(),'{}'),($2,'operator@example.test',now(),'{\"account_type\":\"operator\",\"full_name\":\"Existing Operator\"}')",
        [IDS.root, IDS.operator],
      );
      await db.query(
        "insert into storage.objects(bucket_id,name) values('operator-documents','existing-file.pdf')",
      );
      await createSchema(db);
      expect(
        (await db.query("select id,role from public.users order by id")).rows,
      ).toEqual([
        { id: IDS.operator, role: "operator" },
        { id: IDS.root, role: "customer" },
      ]);
      expect((await db.query("select name from storage.objects")).rows).toEqual(
        [{ name: "existing-file.pdf" }],
      );
      // Ownership stays with Auth; the migration only requires TRIGGER access.
      expect(
        (
          await db.query<{ owner: string }>(
            "select tableowner as owner from pg_tables where schemaname='auth' and tablename='users'",
          )
        ).rows[0].owner,
      ).toBe("auth_owner");
      await db.exec(
        await readFile(
          new URL("../../../supabase/bootstrap-admin.sql", import.meta.url),
          "utf8",
        ),
      );
      expect(
        (
          await db.query("select role from public.users where id=$1", [
            IDS.root,
          ])
        ).rows,
      ).toEqual([{ role: "super_admin" }]);
      await db.exec(
        await readFile(
          new URL("../../../supabase/verify-onboarding.sql", import.meta.url),
          "utf8",
        ),
      );
    } finally {
      await db.close();
    }
  }, 30000);

  it("fails on accidental replay without deleting existing accounts or business data", async () => {
    const db = new PGlite();
    try {
      await setupSystem(db);
      await createSchema(db);
      await seedUsers(db);
      await db.query(
        "insert into public.operator_applications(owner_id,business_name) values($1,'Keep this business')",
        [IDS.operator],
      );
      await expect(createSchema(db)).rejects.toMatchObject({ code: "42P07" });
      expect(
        (
          await db.query(
            "select business_name from public.operator_applications",
          )
        ).rows,
      ).toEqual([{ business_name: "Keep this business" }]);
      expect(
        (
          await db.query("select role from public.users where id=$1", [
            IDS.root,
          ])
        ).rows,
      ).toEqual([{ role: "super_admin" }]);
      expect((await db.query("select id from auth.users")).rows).toHaveLength(
        4,
      );
    } finally {
      await db.close();
    }
  }, 30000);
});
