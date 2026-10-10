import { attachDatabasePool, waitUntil } from "@vercel/functions";
import { createRuntime } from "../apps/server/runtime.ts";
import { serverlessHandler } from "../apps/server/serverless.ts";

let runtime: ReturnType<typeof createRuntime> | undefined;
export default serverlessHandler({
  runtime: () => {
    runtime ??= createRuntime(process.env, attachDatabasePool).catch(
      (error) => {
        runtime = undefined;
        throw error;
      },
    );
    return runtime;
  },
  waitUntil,
  cronSecret: () => process.env.CRON_SECRET,
});
