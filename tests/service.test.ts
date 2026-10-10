import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { openDatabase, migrate, type Database } from "../packages/db/index.ts";
import { GameService } from "../apps/server/service.ts";
import { defaultPlan, replayHash } from "../packages/engine/index.ts";
import { authenticator } from "../apps/server/auth.ts";
import type { ToolName } from "../apps/server/schemas.ts";
async function fixture() {
  process.env.DATA_DIR = "memory://";
  let db: Database;
  if (process.env.TEST_DATABASE_URL) {
    const admin = await openDatabase(process.env.TEST_DATABASE_URL),
      schema = "test_" + randomUUID().replaceAll("-", "");
    await admin.query("CREATE SCHEMA " + schema);
    const url = new URL(process.env.TEST_DATABASE_URL);
    url.searchParams.set("options", "-c search_path=" + schema);
    db = await openDatabase(url.toString());
    const close = db.close;
    db.close = async () => {
      await close();
      await admin.query("DROP SCHEMA " + schema + " CASCADE");
      await admin.close();
    };
  } else db = await openDatabase();
  await migrate(db);
  let now = new Date("2026-01-01T00:00:00Z");
  const service = new GameService(db, () => now);
  return { db, service, setNow: (date: Date) => (now = date) };
}
const create = (s: GameService, actor = "a", mode = "SOLO", role = "SELLER") =>
  s.execute(
    "lemon_create_room",
    {
      idempotencyKey: randomUUID(),
      payload: { mode, locale: "en", timing: "LIVE", alias: actor, role },
    },
    actor,
  );
const command = (
  s: GameService,
  snap: any,
  actor: string,
  tool: ToolName,
  payload: unknown = {},
  round = false,
  key = randomUUID(),
) =>
  s.execute(
    tool,
    {
      roomId: snap.roomId,
      expectedVersion: snap.snapshotVersion,
      idempotencyKey: key,
      ...(round ? { roundNo: snap.roundNo } : {}),
      payload,
    },
    actor,
  );
test("a complete solo campaign persists once per round and replays exact frozen hashes", async () => {
  const { db, service } = await fixture();
  try {
    let snap = await create(service);
    snap = await command(service, snap, "a", "lemon_start_campaign");
    for (let round = 1; round <= 12; round++) {
      snap = await command(
        service,
        snap,
        "a",
        "lemon_commit_plan",
        { planRevision: snap.ownBusiness.planRevision },
        true,
      );
      assert.equal(snap.phase, "LOCKED");
      await Promise.all([service.tick(), service.tick()]);
      snap = await service.execute(
        "lemon_get_snapshot",
        { roomId: snap.roomId },
        "a",
      );
      assert.equal(snap.report.roundNo, round);
      assert.equal(snap.phase, round === 12 ? "COMPLETED" : "REPORT");
      if (round < 12)
        snap = await command(service, snap, "a", "lemon_next_round");
    }
    assert.equal((await db.query("SELECT * FROM settlements")).rows.length, 12);
    assert.equal((await db.query("SELECT * FROM outbox")).rows.length, 12);
    assert.ok((await db.query("SELECT * FROM journal")).rows.length > 0);
    const cashAccount = snap.ownBusiness.id + ":cash";
    const entries = await db.query<any>(
      "SELECT from_account,to_account,cents FROM journal",
    );
    const balance = entries.rows.reduce(
      (total: bigint, p: any) =>
        total +
        (p.to_account === cashAccount ? BigInt(p.cents) : 0n) -
        (p.from_account === cashAccount ? BigInt(p.cents) : 0n),
      0n,
    );
    assert.equal(balance.toString(), snap.ownBusiness.cashCents);
    const saved = await db.query<any>(
      "SELECT input,output,input_hash,output_hash FROM settlements",
    );
    for (const r of saved.rows) {
      const { settle } = await import("../packages/engine/index.ts");
      assert.equal(settle(r.input).outputHash, r.output_hash);
      assert.equal(replayHash(r.input), r.input_hash);
    }
  } finally {
    await db.close();
  }
});
test("20 simultaneous duplicate creates return exactly one room; changed payload conflicts", async () => {
  const { db, service } = await fixture();
  try {
    const args = {
      idempotencyKey: randomUUID(),
      payload: {
        mode: "SOLO",
        locale: "en",
        timing: "LIVE",
        alias: "A",
        role: "SELLER",
      },
    };
    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        service.execute("lemon_create_room", args, "a"),
      ),
    );
    assert.equal(new Set(results.map((r) => r.roomId)).size, 1);
    assert.equal((await db.query("SELECT * FROM rooms")).rows.length, 1);
    await assert.rejects(
      service.execute(
        "lemon_create_room",
        { ...args, payload: { ...args.payload, alias: "B" } },
        "a",
      ),
      /different request/,
    );
  } finally {
    await db.close();
  }
});
test("deadline ignores uncommitted draft and surviving contracts are paid once", async () => {
  const { db, service, setNow } = await fixture();
  try {
    let snap = await create(service, "a", "SOLO", "GROWER");
    snap = await command(service, snap, "a", "lemon_start_campaign");
    snap = await command(
      service,
      snap,
      "a",
      "lemon_save_plan",
      { ...defaultPlan("GROWER"), plannedKg: 1000 },
      true,
    );
    setNow(new Date("2026-01-01T00:11:00Z"));
    await service.tick();
    snap = await service.execute(
      "lemon_get_snapshot",
      { roomId: snap.roomId },
      "a",
    );
    assert.equal(snap.report.production, 0);
    assert.equal(snap.report.timedOut, true);
    assert.equal(snap.ownBusiness.cashCents, "950000");
    await service.tick();
    assert.equal((await db.query("SELECT * FROM settlements")).rows.length, 1);
  } finally {
    await db.close();
  }
});
async function multiplayer(service: GameService) {
  let snap = await create(service, "a", "MULTIPLAYER", "GROWER");
  const invite = await command(service, snap, "a", "lemon_create_invite");
  for (const [actor, role] of [
    ["b", "DISTRIBUTOR"],
    ["c", "SELLER"],
  ])
    await service.execute(
      "lemon_join_room",
      {
        idempotencyKey: randomUUID(),
        inviteToken: invite.inviteToken,
        payload: { alias: actor, role },
      },
      actor,
    );
  snap = await service.execute(
    "lemon_get_snapshot",
    { roomId: snap.roomId },
    "a",
  );
  return command(service, snap, "a", "lemon_start_campaign");
}
test("multiplayer private projections, membership authorization, stale versions and stable preview", async () => {
  const { db, service } = await fixture();
  try {
    const a = await multiplayer(service);
    assert.equal(a.members.filter((m: any) => !m.npc).length, 3);
    assert.ok(
      a.members.every(
        (m: any) =>
          m.cashCents === undefined &&
          m.plan === undefined &&
          m.actor === undefined,
      ),
    );
    await assert.rejects(
      service.execute("lemon_get_snapshot", { roomId: a.roomId }, "outsider"),
      /not a member/,
    );
    const b = await service.execute(
      "lemon_get_snapshot",
      { roomId: a.roomId },
      "b",
    );
    const before = await service.execute(
      "lemon_preview_plan",
      { roomId: a.roomId, roundNo: 1, proposedPlan: a.ownBusiness.plan },
      "a",
    );
    const saved = await command(
      service,
      b,
      "b",
      "lemon_save_plan",
      { ...b.ownBusiness.plan, targetInputKg: 333 },
      true,
    );
    assert.ok(saved.ok);
    const after = await service.execute(
      "lemon_preview_plan",
      { roomId: a.roomId, roundNo: 1, proposedPlan: a.ownBusiness.plan },
      "a",
    );
    assert.deepEqual(before, after);
    const stale = await command(
      service,
      a,
      "a",
      "lemon_save_plan",
      a.ownBusiness.plan,
      true,
    );
    assert.equal(stale.error.code, "VERSION_CONFLICT");
    const exporting = await service.execute("lemon_export_account", {}, "a");
    assert.equal(exporting.export.length, 1);
    assert.ok(
      exporting.export[0].snapshot.members.every(
        (m: any) => m.cashCents === undefined,
      ),
    );
  } finally {
    await db.close();
  }
});
test("simultaneous multiplayer commits require refresh and settle exactly once", async () => {
  const { db, service } = await fixture();
  try {
    const a = await multiplayer(service);
    const initial = await Promise.all(
      ["a", "b", "c"].map((actor) =>
        service.execute("lemon_get_snapshot", { roomId: a.roomId }, actor),
      ),
    );
    const raced = await Promise.all(
      initial.map((s, i) =>
        command(
          service,
          s,
          ["a", "b", "c"][i],
          "lemon_commit_plan",
          { planRevision: s.ownBusiness.planRevision },
          true,
        ),
      ),
    );
    assert.equal(raced.filter((r) => r.ok).length, 1);
    for (const actor of ["a", "b", "c"]) {
      const s = await service.execute(
        "lemon_get_snapshot",
        { roomId: a.roomId },
        actor,
      );
      if (!s.ownBusiness.committed)
        await command(
          service,
          s,
          actor,
          "lemon_commit_plan",
          { planRevision: s.ownBusiness.planRevision },
          true,
        );
    }
    await Promise.all(Array.from({ length: 20 }, () => service.tick()));
    assert.equal((await db.query("SELECT * FROM settlements")).rows.length, 1);
    assert.equal(
      (await db.query("SELECT * FROM resolution_jobs WHERE status='DONE'")).rows
        .length,
      1,
    );
  } finally {
    await db.close();
  }
});
test("contract acceptance reserves both plans and duplicate acceptance is replay-safe", async () => {
  const { db, service } = await fixture();
  try {
    let a = await multiplayer(service);
    const buyer = a.members.find((m: any) => m.alias === "b");
    a = await command(
      service,
      a,
      "a",
      "lemon_offer_contract",
      {
        buyerBusinessId: buyer.id,
        kg: 100,
        unitPriceCents: "300",
        expiry: a.deadline,
      },
      true,
    );
    let b = await service.execute(
      "lemon_get_snapshot",
      { roomId: a.roomId },
      "b",
    );
    const offer = b.contracts[0],
      key = randomUUID();
    const [first, again] = await Promise.all([
      command(
        service,
        b,
        "b",
        "lemon_respond_contract",
        {
          offerId: offer.id,
          offerRevision: offer.revision,
          response: "ACCEPT",
        },
        true,
        key,
      ),
      command(
        service,
        b,
        "b",
        "lemon_respond_contract",
        {
          offerId: offer.id,
          offerRevision: offer.revision,
          response: "ACCEPT",
        },
        true,
        key,
      ),
    ]);
    assert.deepEqual(first, again);
    assert.equal(first.contracts[0].status, "ACCEPTED");
    assert.equal(first.ownBusiness.plan.targetInputKg, 100);
    a = await service.execute("lemon_get_snapshot", { roomId: a.roomId }, "a");
    assert.ok(a.ownBusiness.plan.plannedKg >= 100);
    assert.equal(first.contracts.length, 1);
  } finally {
    await db.close();
  }
});
test("host cannot start a small multiplayer room or pause planning; expiry blocks late actions", async () => {
  const { db, service, setNow } = await fixture();
  try {
    let snap = await create(service, "a", "MULTIPLAYER");
    const rejected = await command(service, snap, "a", "lemon_start_campaign");
    assert.equal(rejected.error.code, "NOT_ENOUGH_PLAYERS");
    snap = await create(service, "solo");
    snap = await command(service, snap, "solo", "lemon_start_campaign");
    assert.equal(
      (
        await command(service, snap, "solo", "lemon_pause_resume", {
          desiredState: "PAUSED",
        })
      ).error.code,
      "WRONG_PHASE",
    );
    setNow(new Date("2026-01-01T00:11:00Z"));
    assert.equal(
      (
        await command(
          service,
          snap,
          "solo",
          "lemon_save_plan",
          snap.ownBusiness.plan,
          true,
        )
      ).error.code,
      "DEADLINE_PASSED",
    );
  } finally {
    await db.close();
  }
});
test("strict schemas reject actor spoofing; production rejects development auth", async () => {
  const { db, service } = await fixture();
  try {
    await assert.rejects(
      service.execute(
        "lemon_create_room",
        {
          idempotencyKey: randomUUID(),
          playerId: "someone",
          payload: {
            mode: "SOLO",
            locale: "en",
            timing: "LIVE",
            alias: "A",
            role: "SELLER",
          },
        },
        "a",
      ),
      /strict/,
    );
    const saved = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    assert.throws(() => authenticator({ mode: "development" }), /forbidden/);
    process.env.NODE_ENV = saved;
    const auth = authenticator({ mode: "development" });
    assert.equal(await auth("Bearer dev:alice"), "dev:alice");
    assert.equal(await auth(undefined), null);
    await assert.rejects(auth("Bearer alice"), /Invalid/);
  } finally {
    await db.close();
  }
});

test("three missed rounds enable conservative control and the player can reclaim the next planning round", async () => {
  const { db, service, setNow } = await fixture();
  try {
    let s = await create(service, "idle", "SOLO", "GROWER");
    s = await command(service, s, "idle", "lemon_start_campaign");
    for (let round = 1; round <= 3; round++) {
      setNow(new Date(Date.parse(s.deadline) + 1000));
      await service.tick();
      s = await service.execute(
        "lemon_get_snapshot",
        { roomId: s.roomId },
        "idle",
      );
      assert.equal(s.report.timedOut, true);
      s = await command(service, s, "idle", "lemon_next_round");
    }
    assert.equal(s.ownBusiness.missedRounds, 3);
    assert.equal(s.ownBusiness.committed, true);
    s = await command(service, s, "idle", "lemon_reclaim_control", {}, true);
    assert.equal(s.ownBusiness.committed, false);
    assert.equal(s.ownBusiness.missedRounds, 0);
  } finally {
    await db.close();
  }
});
