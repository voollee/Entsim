import { openDatabase, migrate } from "../../packages/db/index.ts";
import { GameService } from "../server/service.ts";
if (!process.env.DATABASE_URL)
  throw new Error("Separate worker requires shared DATABASE_URL");
const db = await openDatabase(process.env.DATABASE_URL);
await migrate(db);
const service = new GameService(db);
let stopped = false;
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => (stopped = true));
while (!stopped) {
  try {
    await service.tick();
  } catch (error) {
    console.error("Worker retry pending", error);
  }
  await new Promise((r) => setTimeout(r, 1000));
}
await db.close();
