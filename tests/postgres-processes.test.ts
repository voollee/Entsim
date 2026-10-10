import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { openDatabase, migrate } from "../packages/db/index.ts";
import { GameService } from "../apps/server/service.ts";

test(
  "independent PostgreSQL workers race cold-start migrations and settle a locked round once",
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    const admin = await openDatabase(process.env.TEST_DATABASE_URL);
    const schema = "process_" + randomUUID().replaceAll("-", "");
    await admin.query("CREATE SCHEMA " + schema);
    const url = new URL(process.env.TEST_DATABASE_URL!);
    url.searchParams.set("options", "-c search_path=" + schema);
    const db = await openDatabase(url.toString());
    const run = promisify(execFile);
    const child = `import { openDatabase, migrate } from './packages/db/index.ts';
import { GameService } from './apps/server/service.ts';
const db = await openDatabase(process.env.TEST_DATABASE_URL);
try { await migrate(db); await new GameService(db).tick(); } finally { await db.close(); }`;
    const workers = () =>
      Promise.all(
        [0, 1].map(() =>
          run(
            process.execPath,
            ["--import", "tsx", "--input-type=module", "-e", child],
            {
              env: { ...process.env, TEST_DATABASE_URL: url.toString() },
              timeout: 30000,
            },
          ),
        ),
      );
    try {
      await workers(); // Fresh-schema concurrent DDL, in separate Node processes.
      await migrate(db);
      const service = new GameService(db);
      let snap = await service.execute(
        "lemon_create_room",
        {
          idempotencyKey: randomUUID(),
          payload: {
            mode: "SOLO",
            locale: "en",
            timing: "LIVE",
            role: "SELLER",
            alias: "Race",
          },
        },
        "process-test",
      );
      const command = async (
        name: "lemon_start_campaign" | "lemon_commit_plan",
        payload: unknown,
        round = false,
      ) =>
        service.execute(
          name,
          {
            roomId: snap.roomId,
            expectedVersion: snap.snapshotVersion,
            idempotencyKey: randomUUID(),
            ...(round ? { roundNo: snap.roundNo } : {}),
            payload,
          },
          "process-test",
        );
      snap = await command("lemon_start_campaign", {});
      snap = await command(
        "lemon_commit_plan",
        { planRevision: snap.ownBusiness.planRevision },
        true,
      );
      assert.equal(snap.phase, "LOCKED");
      await workers();
      assert.equal(
        (await db.query("SELECT * FROM settlements")).rows.length,
        1,
      );
      assert.equal((await db.query("SELECT * FROM outbox")).rows.length, 1);
      assert.equal(
        (await db.query<any>("SELECT state FROM rooms")).rows[0].state.phase,
        "REPORT",
      );
    } finally {
      await db.close();
      await admin.query("DROP SCHEMA " + schema + " CASCADE");
      await admin.close();
    }
  },
);
