import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { openDatabase, migrate, type Database } from "../packages/db/index.ts";
import { GameService } from "../apps/server/service.ts";
import { settle } from "../packages/engine/index.ts";
test("crash before outbox insertion rolls back settlement and worker recovers exactly once", async () => {
  process.env.DATA_DIR = "memory://";
  const db = await openDatabase();
  await migrate(db);
  let fail = false;
  const faulty: Database = {
    query: db.query,
    close: db.close,
    transaction: (fn) =>
      db.transaction((sql) =>
        fn({
          query: async <T>(query: string, args?: unknown[]) => {
            if (fail && query.startsWith("INSERT INTO outbox")) {
              fail = false;
              throw new Error("Injected crash");
            }
            return sql.query<T>(query, args);
          },
        }),
      ),
  };
  const service = new GameService(faulty);
  try {
    let s = await service.execute(
      "lemon_create_room",
      {
        idempotencyKey: randomUUID(),
        payload: {
          mode: "SOLO",
          locale: "en",
          timing: "LIVE",
          role: "SELLER",
          alias: "A",
        },
      },
      "a",
    );
    for (const tool of ["lemon_start_campaign", "lemon_commit_plan"] as const)
      s = await service.execute(
        tool,
        {
          roomId: s.roomId,
          expectedVersion: s.snapshotVersion,
          idempotencyKey: randomUUID(),
          ...(tool === "lemon_commit_plan" ? { roundNo: 1 } : {}),
          payload:
            tool === "lemon_commit_plan"
              ? { planRevision: s.ownBusiness.planRevision }
              : {},
        },
        "a",
      );
    fail = true;
    await assert.rejects(service.tick(), /Injected crash/);
    assert.equal((await db.query("SELECT * FROM settlements")).rows.length, 0);
    assert.equal(
      (await service.execute("lemon_get_snapshot", { roomId: s.roomId }, "a"))
        .phase,
      "LOCKED",
    );
    await service.tick();
    await service.tick();
    assert.equal((await db.query("SELECT * FROM settlements")).rows.length, 1);
    assert.equal((await db.query("SELECT * FROM outbox")).rows.length, 1);
  } finally {
    await db.close();
  }
});
test("confirmed deletion removes identity, reflections and cached aliases while economic replay remains valid", async () => {
  process.env.DATA_DIR = "memory://";
  const db = await openDatabase();
  await migrate(db);
  const service = new GameService(db);
  try {
    let s = await service.execute(
      "lemon_create_room",
      {
        idempotencyKey: randomUUID(),
        payload: {
          mode: "SOLO",
          locale: "en",
          timing: "LIVE",
          role: "GROWER",
          alias: "Private Alias",
        },
      },
      "subject:private",
    );
    for (const tool of ["lemon_start_campaign", "lemon_commit_plan"] as const)
      s = await service.execute(
        tool,
        {
          roomId: s.roomId,
          expectedVersion: s.snapshotVersion,
          idempotencyKey: randomUUID(),
          ...(tool === "lemon_commit_plan" ? { roundNo: 1 } : {}),
          payload:
            tool === "lemon_commit_plan"
              ? { planRevision: s.ownBusiness.planRevision }
              : {},
        },
        "subject:private",
      );
    await service.tick();
    const bad = await service.execute(
      "lemon_export_delete_account",
      {
        idempotencyKey: randomUUID(),
        action: "DELETE",
        confirmationToken: "x".repeat(32),
      },
      "subject:private",
    );
    assert.equal(bad.error.code, "INVALID_CONFIRMATION");
    const proof = await service.execute(
      "lemon_export_delete_account",
      { idempotencyKey: randomUUID(), action: "PREPARE_DELETE" },
      "subject:private",
    );
    assert.equal(
      (
        await service.execute(
          "lemon_export_delete_account",
          {
            idempotencyKey: randomUUID(),
            action: "DELETE",
            confirmationToken: proof.confirmationToken,
          },
          "subject:private",
        )
      ).deleted,
      true,
    );
    await assert.rejects(
      service.execute(
        "lemon_get_snapshot",
        { roomId: s.roomId },
        "subject:private",
      ),
      /not a member/,
    );
    for (const table of ["rooms", "settlements", "command_results"]) {
      const rows = await db.query("SELECT * FROM " + table);
      assert.ok(!JSON.stringify(rows).includes("subject:private"));
      assert.ok(!JSON.stringify(rows).includes("Private Alias"));
    }
    const history = await db.query<any>(
      "SELECT input,output_hash FROM settlements",
    );
    assert.equal(
      settle(history.rows[0].input).outputHash,
      history.rows[0].output_hash,
    );
  } finally {
    await db.close();
  }
});
