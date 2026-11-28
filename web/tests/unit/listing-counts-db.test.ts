import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, expect, it } from "vitest";
import {
  actor,
  createSchema,
  draft,
  IDS,
  seedUsers,
  setupSystem,
} from "../fixtures/database";

let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await setupSystem(db);
  await createSchema(db);
  await seedUsers(db);
  await draft(db);
  await draft(db, IDS.other);
  await db.query(
    "insert into public.operator_vehicles(operator_id,title,make,model,model_year,seats,location,plate_number) select $1,'Van '||n,'Toyota','Hiace',2025,15,'Manila','PLATE-'||n from generate_series(1,205) n",
    [IDS.operator],
  );
  await db.query(
    "insert into public.operator_vehicles(operator_id,title,make,model,model_year,seats,location,plate_number) values($1,'Other van','Nissan','Urvan',2025,15,'Manila','OTHER')",
    [IDS.other],
  );
}, 30000);
afterAll(async () => {
  await db?.close();
});

it("sorts verification by complete van counts beyond the management RPC limit", async () => {
  await actor(db, IDS.root);
  const result = await db.query(
    "select owner_id,vehicle_count from public.operator_verification_queue order by vehicle_count desc,id",
  );
  expect(result.rows).toEqual([
    { owner_id: IDS.operator, vehicle_count: 205 },
    { owner_id: IDS.other, vehicle_count: 1 },
  ]);
});
it("shows owners only their own queue entry and prevents count disclosure across accounts", async () => {
  await actor(db, IDS.operator);
  expect(
    (
      await db.query(
        "select vehicle_count from public.operator_verification_queue",
      )
    ).rows,
  ).toEqual([{ vehicle_count: 205 }]);
  expect(
    (
      await db.query("select private.operator_van_count($1) as count", [
        IDS.other,
      ])
    ).rows,
  ).toEqual([{ count: 0 }]);
  await actor(db, IDS.other);
  expect(
    (
      await db.query(
        "select vehicle_count from public.operator_verification_queue",
      )
    ).rows,
  ).toEqual([{ vehicle_count: 1 }]);
});
it("blocks anonymous access to the private count helper and verification view", async () => {
  await actor(db, "", "anon");
  await expect(
    db.query("select * from public.operator_verification_queue"),
  ).rejects.toMatchObject({ code: "42501" });
});
