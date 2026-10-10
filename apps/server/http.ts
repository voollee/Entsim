import express from "express";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { GameError } from "../../packages/contracts/index.ts";
import { GameService } from "./service.ts";
import { schemas, READS, type ToolName } from "./schemas.ts";
import { authenticator, type AuthConfig } from "./auth.ts";
const URI = "ui://lemon-empire/v1/game.html";
export function createHttpApp(
  service: GameService,
  config: AuthConfig,
  publicUrl = "http://localhost:3000",
) {
  const app = express(),
    authenticate = authenticator(config);
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    const host = req.get("host")?.split(":")[0],
      origin = req.get("origin");
    const allowed = new URL(publicUrl);
    if (
      config.mode === "development" &&
      host &&
      !["localhost", "127.0.0.1", "[::1]"].includes(host)
    ) {
      res.status(403).json({ error: "Invalid host" });
      return;
    }
    const loopbackOrigin =
      origin &&
      config.mode === "development" &&
      (() => {
        try {
          const u = new URL(origin);
          return (
            ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname) &&
            u.protocol === allowed.protocol &&
            u.port === allowed.port
          );
        } catch {
          return false;
        }
      })();
    if (origin && origin !== allowed.origin && !loopbackOrigin) {
      res.status(403).json({ error: "Origin rejected" });
      return;
    }
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    next();
  });
  app.use(express.json({ limit: "64kb" }));
  const buckets = new Map<string, { start: number; count: number }>();
  app.use(["/v1", "/mcp"], async (req, res, next) => {
    try {
      const actor = await authenticate(req.get("authorization"));
      res.locals.actor = actor;
      const key = actor ?? req.ip ?? "unknown",
        now = Date.now();
      if (buckets.size > 10000)
        for (const [k, v] of buckets)
          if (now - v.start > 60000) buckets.delete(k);
      let b = buckets.get(key);
      if (!b || now - b.start >= 60000) {
        b = { start: now, count: 0 };
        buckets.set(key, b);
      }
      if (++b.count > 120) {
        res.setHeader("Retry-After", "60");
        throw new GameError("RATE_LIMIT", "Too many requests", 429);
      }
      next();
    } catch (e) {
      next(e);
    }
  });
  app.get("/health", (_req, res) =>
    res.json({ ok: true, service: "lemon-empire", authMode: config.mode }),
  );
  app.get("/.well-known/oauth-protected-resource", (_req, res) =>
    res.json({
      resource: publicUrl + "/mcp",
      authorization_servers: config.issuer ? [config.issuer] : [],
      scopes_supported: [config.scope ?? "lemon:play"],
      bearer_methods_supported: ["header"],
    }),
  );
  const run = async (tool: ToolName, args: unknown, actor: string | null) =>
    service.execute(tool, args, actor);
  app.post("/v1/tools/:tool", async (req, res, next) => {
    try {
      const result = await run(
        req.params.tool as ToolName,
        req.body,
        res.locals.actor,
      );
      res.status(result.ok === false ? result.error.status : 200).json(result);
    } catch (e) {
      next(e);
    }
  });
  app.get("/v1/rooms/:id/snapshot", async (req, res, next) => {
    try {
      res.json(
        await run(
          "lemon_get_snapshot",
          { roomId: req.params.id },
          res.locals.actor,
        ),
      );
    } catch (e) {
      next(e);
    }
  });
  app.post("/mcp", async (req, res, next) => {
    const server = new McpServer({ name: "lemon-empire", version: "0.1.0" });
    const actor = res.locals.actor as string | null;
    for (const [tool, schema] of Object.entries(schemas)) {
      const name = tool as ToolName,
        readOnly = READS.has(name);
      server.registerTool(
        name,
        {
          title: name.replace("lemon_", "").replaceAll("_", " "),
          description: readOnly
            ? "Read authorized Lemon Empire facts."
            : name === "lemon_export_delete_account"
              ? "Prepare or explicitly confirm irreversible account deletion. Never delete without the user approving the returned warning."
              : "Perform a validated fictional game action. Commit only after the user explicitly chooses to lock their decision.",
          inputSchema: schema.shape,
          annotations: {
            readOnlyHint: readOnly,
            destructiveHint: name === "lemon_export_delete_account",
            idempotentHint: !readOnly,
            openWorldHint: false,
          },
          _meta: {
            ui: { resourceUri: URI },
            securitySchemes:
              name === "lemon_get_rules"
                ? [{ type: "noauth" }]
                : [{ type: "oauth2", scopes: [config.scope ?? "lemon:play"] }],
          },
        },
        async (args: unknown) => {
          try {
            const result = await run(name, args, actor);
            return {
              content: [
                {
                  type: "text" as const,
                  text:
                    result.ok === false
                      ? result.error.message
                      : "Lemon Empire state updated.",
                },
              ],
              structuredContent: result,
              isError: result.ok === false,
            };
          } catch (e) {
            if (e instanceof GameError)
              return {
                content: [{ type: "text" as const, text: e.message }],
                isError: true,
                structuredContent: {
                  ok: false,
                  error: { code: e.code, message: e.message },
                },
                ...(e.status === 401
                  ? {
                      _meta: {
                        "mcp/www_authenticate": [
                          `Bearer resource_metadata="${publicUrl}/.well-known/oauth-protected-resource"`,
                        ],
                      },
                    }
                  : {}),
              };
            throw e;
          }
        },
      );
    }
    server.registerResource(
      "lemon-game",
      URI,
      { mimeType: "text/html;profile=mcp-app" },
      async () => ({
        contents: [
          {
            uri: URI,
            mimeType: "text/html;profile=mcp-app",
            text: await readFile(resolve("dist/index.html"), "utf8"),
            _meta: {
              ui: {
                prefersBorder: true,
                csp: { connectDomains: [], resourceDomains: [] },
              },
            },
          },
        ],
      }),
    );
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (e) {
      next(e);
    }
  });
  app.all("/mcp", (_req, res) => res.status(405).set("Allow", "POST").end());
  app.get("/dev-config", (_req, res) =>
    res.json({ development: config.mode === "development" }),
  );
  app.use(express.static(resolve("dist"), { index: "index.html" }));
  app.use(
    (
      error: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      const e =
        error instanceof GameError
          ? error
          : new GameError("INTERNAL_ERROR", "Request failed", 500);
      if (e.status === 500) console.error(error);
      if (e.status === 401)
        res.setHeader(
          "WWW-Authenticate",
          `Bearer resource_metadata="${publicUrl}/.well-known/oauth-protected-resource"`,
        );
      res.status(e.status).json({
        ok: false,
        error: {
          code: e.code,
          message: e.message,
          currentVersion: e.currentVersion,
        },
      });
    },
  );
  return app;
}
