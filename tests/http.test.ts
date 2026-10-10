import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { openDatabase, migrate } from "../packages/db/index.ts";
import { GameService } from "../apps/server/service.ts";
import { createHttpApp } from "../apps/server/http.ts";
test("MCP SDK client initializes, discovers tools, reads widget and executes the same commands as REST", async () => {
  process.env.DATA_DIR = "memory://";
  const db = await openDatabase();
  await migrate(db);
  const service = new GameService(db);
  const server = createHttpApp(service, { mode: "development" }).listen(
    0,
    "127.0.0.1",
  );
  await once(server, "listening");
  const address = server.address() as { port: number };
  const url = "http://127.0.0.1:" + address.port;
  const client = new Client({ name: "test", version: "1.0.0" });
  try {
    await client.connect(
      new StreamableHTTPClientTransport(new URL(url + "/mcp"), {
        requestInit: { headers: { Authorization: "Bearer dev:alice" } },
      }),
    );
    const tools = await client.listTools();
    assert.ok(tools.tools.some((t) => t.name === "lemon_commit_plan"));
    assert.ok(!tools.tools.some((t) => t.name === "resolve_round"));
    const resource = await client.readResource({
      uri: "ui://lemon-empire/v1/game.html",
    });
    assert.equal(resource.contents[0].mimeType, "text/html;profile=mcp-app");
    assert.ok(
      "text" in resource.contents[0] &&
        resource.contents[0].text.includes("LEMON"),
    );
    const result = await client.callTool({
      name: "lemon_create_room",
      arguments: {
        idempotencyKey: randomUUID(),
        payload: {
          mode: "SOLO",
          locale: "en",
          timing: "LIVE",
          role: "SELLER",
          alias: "Alice",
        },
      },
    });
    const snapshot = result.structuredContent as any;
    assert.equal(snapshot.ownBusiness.alias, "Alice");
    const response = await fetch(
      url + "/v1/rooms/" + snapshot.roomId + "/snapshot",
      { headers: { Authorization: "Bearer dev:alice" } },
    );
    assert.deepEqual(await response.json(), snapshot);
    const denied = await fetch(
      url + "/v1/rooms/" + snapshot.roomId + "/snapshot",
    );
    assert.equal(denied.status, 401);
    assert.ok(
      denied.headers.get("www-authenticate")?.includes("resource_metadata"),
    );
    const attacker = await fetch(url + "/v1/tools/lemon_get_rules", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://attacker.example",
      },
      body: "{}",
    });
    assert.equal(attacker.status, 403);
  } finally {
    await client.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await db.close();
  }
});
