import { timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createRuntime } from "./runtime.ts";

type Runtime = Awaited<ReturnType<typeof createRuntime>>;
type Dependencies = {
  runtime: () => Promise<Runtime>;
  waitUntil: (work: Promise<unknown>) => void;
  cronSecret: () => string | undefined;
};

function authorizedWorker(header: string | undefined, secret?: string) {
  if (!secret || !header) return false;
  const expected = Buffer.from("Bearer " + secret);
  const supplied = Buffer.from(header);
  return (
    expected.length === supplied.length && timingSafeEqual(expected, supplied)
  );
}

export function serverlessHandler(dependencies: Dependencies) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
    res.setHeader("Cache-Control", "no-store");
    if (pathname === "/internal/worker") {
      if (req.method !== "GET" && req.method !== "POST") {
        res.writeHead(405, { Allow: "GET, POST" }).end();
        return;
      }
      if (
        !authorizedWorker(req.headers.authorization, dependencies.cronSecret())
      ) {
        res.writeHead(401).end();
        return;
      }
    }
    let runtime: Runtime;
    try {
      runtime = await dependencies.runtime();
    } catch {
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          ok: false,
          error: {
            code: "SETUP_REQUIRED",
            message: "Database and OAuth configuration is required.",
          },
        }),
      );
      return;
    }
    try {
      if (["/healthz", "/readyz"].includes(pathname)) {
        await runtime.db.query("SELECT 1");
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            ok: true,
            service: "lemon-empire",
            authMode: runtime.config.auth.mode,
          }),
        );
        return;
      }
      if (pathname === "/internal/worker") {
        await runtime.service.tick();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
        return;
      }
      // Recover overdue/locked rounds before returning a fresh snapshot.
      await runtime.service.tick();
      // Serverless instances have no permanent timer. Keep post-commit work
      // alive through Vercel's supported request-lifetime mechanism.
      res.once("finish", () => {
        dependencies.waitUntil(
          runtime.service.tick().catch(() => {
            console.error("Lemon Empire resolution retained for retry");
          }),
        );
      });
      runtime.app(req, res);
    } catch {
      if (!res.headersSent) {
        res.writeHead(503, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            ok: false,
            error: {
              code: "SERVICE_UNAVAILABLE",
              message: "Retry the request; no partial round is published.",
            },
          }),
        );
      }
    }
  };
}
