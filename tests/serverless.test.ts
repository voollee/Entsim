import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import {
  createRuntime,
  runtimeConfiguration,
  resolveAuthConfiguration,
} from "../apps/server/runtime.ts";
import { serverlessHandler } from "../apps/server/serverless.ts";

test("production fails closed and discovery validates the configured issuer and HTTPS JWKS", async () => {
  const env = {
    NODE_ENV: "production",
    DATABASE_URL: "postgres://example",
    PUBLIC_URL: "https://game.example",
    AUTH_MODE: "oauth",
    DESCOPE_ISSUER: "https://issuer.example",
    DESCOPE_DISCOVERY_URL: "https://issuer.example/discovery",
    OAUTH_AUDIENCE: "https://game.example/mcp",
  };
  for (const key of [
    "DATABASE_URL",
    "PUBLIC_URL",
    "AUTH_MODE",
    "DESCOPE_ISSUER",
    "OAUTH_AUDIENCE",
  ])
    assert.throws(() => runtimeConfiguration({ ...env, [key]: undefined }));
  const config = runtimeConfiguration(env);
  const metadata = (issuer: string, jwks: string) =>
    (async () => Response.json({ issuer, jwks_uri: jwks })) as typeof fetch;
  const resolved = await resolveAuthConfiguration(
    config,
    metadata(env.DESCOPE_ISSUER, "https://issuer.example/keys"),
  );
  assert.equal(resolved.jwksUrl, "https://issuer.example/keys");
  await assert.rejects(
    resolveAuthConfiguration(
      config,
      metadata("https://attacker.example", "https://attacker.example/keys"),
    ),
  );
  await assert.rejects(
    resolveAuthConfiguration(
      config,
      metadata(env.DESCOPE_ISSUER, "http://issuer.example/keys"),
    ),
  );
});

test("serverless requests settle committed rounds after response, survive retry, and protect the worker", async () => {
  process.env.DATA_DIR = "memory://";
  const runtime = await createRuntime({});
  const work: Promise<unknown>[] = [];
  let initializations = 0;
  const handler = serverlessHandler({
    runtime: async () => {
      initializations++;
      return runtime;
    },
    waitUntil: (p) => {
      work.push(p);
    },
    cronSecret: () => "test-secret",
  });
  const server = createServer((req, res) => {
    void handler(req, res);
  }).listen(0, "127.0.0.1");
  await once(server, "listening");
  const base =
    "http://127.0.0.1:" + (server.address() as { port: number }).port;
  const command = async (name: string, args: unknown) => {
    const response = await fetch(base + "/v1/tools/" + name, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer dev:serverless",
      },
      body: JSON.stringify(args),
    });
    assert.equal(response.status, 200);
    const snapshot = await response.json();
    await Promise.all(work.splice(0));
    return snapshot;
  };
  try {
    assert.equal((await fetch(base + "/internal/worker")).status, 401);
    assert.equal(initializations, 0);
    assert.equal(
      (
        await fetch(base + "/internal/worker", {
          headers: { Authorization: "Bearer wrong" },
        })
      ).status,
      401,
    );
    const ready = await fetch(base + "/readyz");
    assert.equal(ready.status, 200);
    assert.equal((await ready.json()).authMode, "development");
    let snap = await command("lemon_create_room", {
      idempotencyKey: randomUUID(),
      payload: {
        mode: "SOLO",
        locale: "en",
        timing: "LIVE",
        role: "SELLER",
        alias: "Serverless",
      },
    });
    snap = await command("lemon_start_campaign", {
      roomId: snap.roomId,
      expectedVersion: snap.snapshotVersion,
      idempotencyKey: randomUUID(),
      payload: {},
    });
    const commit = {
      roomId: snap.roomId,
      roundNo: snap.roundNo,
      expectedVersion: snap.snapshotVersion,
      idempotencyKey: randomUUID(),
      payload: { planRevision: snap.ownBusiness.planRevision },
    };
    const committed = await command("lemon_commit_plan", commit);
    assert.equal(committed.phase, "LOCKED");
    assert.deepEqual(await command("lemon_commit_plan", commit), committed);
    snap = await command("lemon_get_snapshot", { roomId: snap.roomId });
    assert.equal(snap.phase, "REPORT");
    assert.equal(
      (await runtime.db.query("SELECT * FROM settlements")).rows.length,
      1,
    );
    assert.equal(
      (await runtime.db.query("SELECT * FROM outbox")).rows.length,
      1,
    );
    assert.equal(
      (
        await fetch(base + "/internal/worker", {
          headers: { Authorization: "Bearer test-secret" },
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await fetch(base + "/internal/worker", {
          method: "DELETE",
          headers: { Authorization: "Bearer test-secret" },
        })
      ).status,
      405,
    );
  } finally {
    await Promise.all(work);
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await runtime.db.close();
  }
});

test("runtime setup failures return a redacted retryable response", async () => {
  const handler = serverlessHandler({
    runtime: async () => {
      throw new Error("secret connection details");
    },
    waitUntil: () => {},
    cronSecret: () => undefined,
  });
  const server = createServer((req, res) => {
    void handler(req, res);
  }).listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const response = await fetch(
      "http://127.0.0.1:" +
        (server.address() as { port: number }).port +
        "/readyz",
    );
    assert.equal(response.status, 503);
    const body = await response.text();
    assert.ok(body.includes("SETUP_REQUIRED"));
    assert.ok(!body.includes("secret"));
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
