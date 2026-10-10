import { createRuntime } from "./runtime.ts";
const { db, service, app } = await createRuntime();
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
