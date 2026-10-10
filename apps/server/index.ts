import { openDatabase, migrate } from "../../packages/db/index.ts";
import { GameService } from "./service.ts";
import { createHttpApp } from "./http.ts";
if (
  process.env.NODE_ENV === "production" &&
  (!process.env.PUBLIC_URL ||
    new URL(process.env.PUBLIC_URL).protocol !== "https:")
)
  throw new Error("Production requires an HTTPS PUBLIC_URL");
const db = await openDatabase(process.env.DATABASE_URL);
await migrate(db);
const service = new GameService(db);
const mode = process.env.AUTH_MODE === "oauth" ? "oauth" : "development";
const app = createHttpApp(
  service,
  {
    mode,
    issuer: process.env.OAUTH_ISSUER,
    audience: process.env.OAUTH_AUDIENCE,
    jwksUrl: process.env.OAUTH_JWKS_URL,
  },
  process.env.PUBLIC_URL ?? "http://localhost:3000",
);
const server = app.listen(
  Number(process.env.PORT ?? 3000),
  process.env.HOST ?? "127.0.0.1",
  () =>
    console.log("Lemon Empire listening on port " + (process.env.PORT ?? 3000)),
);
let busy = false;
const timer = setInterval(async () => {
  if (busy) return;
  busy = true;
  try {
    await service.tick();
  } catch (e) {
    console.error("Resolution failed; retained for retry", e);
  } finally {
    busy = false;
  }
}, 1000);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    clearInterval(timer);
    server.close(() => {
      void db.close().then(() => process.exit(0));
    });
  });
