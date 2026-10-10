import { readFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";
export interface SQL {
  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[] }>;
}
export interface Database extends SQL {
  transaction<T>(fn: (sql: SQL) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
export async function openDatabase(
  url?: string,
  onPool?: (pool: pg.Pool) => void,
): Promise<Database> {
  if (url) {
    const pool = new pg.Pool({
      connectionString: url,
      max: 5,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 10000,
    });
    onPool?.(pool);
    return {
      query: async <T>(sql: string, params?: unknown[]) => ({
        rows: (await pool.query(sql, params)).rows as T[],
      }),
      transaction: async (fn) => {
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          const result = await fn({
            query: async <T>(sql: string, params?: unknown[]) => ({
              rows: (await client.query(sql, params)).rows as T[],
            }),
          });
          await client.query("COMMIT");
          return result;
        } catch (e) {
          await client.query("ROLLBACK");
          throw e;
        } finally {
          client.release();
        }
      },
      close: () => pool.end(),
    };
  }
  if (process.env.NODE_ENV === "production")
    throw new Error("Production requires DATABASE_URL");
  const dataDir = process.env.DATA_DIR ?? ".data/postgres";
  if (!dataDir.startsWith("memory:"))
    await mkdir(dirname(dataDir), { recursive: true });
  const db = new PGlite(dataDir);
  let tail = Promise.resolve();
  // Embedded PostgreSQL has one connection. Serialize reads and transactions so no read observes uncommitted state.
  async function exclusive<T>(fn: () => Promise<T>) {
    const before = tail;
    let release!: () => void;
    tail = new Promise<void>((r) => (release = r));
    await before;
    try {
      return await fn();
    } finally {
      release();
    }
  }
  return {
    query: <T>(sql: string, params?: unknown[]) =>
      exclusive(() => db.query<T>(sql, params)),
    transaction: (fn) =>
      exclusive(() =>
        db.transaction((tx) =>
          fn({
            query: <T>(sql: string, params?: unknown[]) =>
              tx.query<T>(sql, params),
          }),
        ),
      ),
    close: () => exclusive(() => db.close()),
  };
}
export async function migrate(db: Database) {
  const source = await readFile(
    new URL("./migrations/001_initial.sql", import.meta.url),
    "utf8",
  );
  await db.transaction(async (sql) => {
    // Cold starts may migrate concurrently. Serialize DDL across processes.
    await sql.query("SELECT pg_advisory_xact_lock(6124701)");
    for (const statement of source
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean))
      await sql.query(statement);
  });
}
