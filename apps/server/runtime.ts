import type pg from "pg";
import { openDatabase, migrate } from "../../packages/db/index.ts";
import { GameService } from "./service.ts";
import { createHttpApp } from "./http.ts";
import type { AuthConfig } from "./auth.ts";

export function runtimeConfiguration(env: NodeJS.ProcessEnv = process.env) {
  const production = env.NODE_ENV === "production" || env.VERCEL === "1";
  const publicUrl = env.PUBLIC_URL ?? "http://localhost:3000";
  const auth: AuthConfig = {
    mode: env.AUTH_MODE === "oauth" ? "oauth" : "development",
    issuer: env.OAUTH_ISSUER ?? env.DESCOPE_ISSUER,
    audience: env.OAUTH_AUDIENCE,
    jwksUrl: env.OAUTH_JWKS_URL,
    scope: env.OAUTH_SCOPE ?? "lemon:play",
  };
  const discoveryUrl = env.OAUTH_DISCOVERY_URL ?? env.DESCOPE_DISCOVERY_URL;
  if (production) {
    if (!env.DATABASE_URL) throw new Error("Production requires DATABASE_URL");
    if (!env.PUBLIC_URL || new URL(publicUrl).protocol !== "https:")
      throw new Error("Production requires an HTTPS PUBLIC_URL");
    if (auth.mode !== "oauth")
      throw new Error("Development authentication is forbidden in production");
    if (!auth.issuer || !auth.audience || (!auth.jwksUrl && !discoveryUrl))
      throw new Error(
        "OAuth requires issuer, audience and JWKS or discovery URL",
      );
    if (
      new URL(auth.issuer).protocol !== "https:" ||
      (auth.jwksUrl && new URL(auth.jwksUrl).protocol !== "https:") ||
      (discoveryUrl && new URL(discoveryUrl).protocol !== "https:")
    )
      throw new Error("Production OAuth endpoints must use HTTPS");
  }
  return {
    production,
    publicUrl,
    auth,
    discoveryUrl,
    databaseUrl: env.DATABASE_URL,
  };
}

export async function resolveAuthConfiguration(
  config: ReturnType<typeof runtimeConfiguration>,
  request: typeof fetch = fetch,
) {
  if (config.auth.mode !== "oauth" || config.auth.jwksUrl) return config.auth;
  if (!config.discoveryUrl) throw new Error("OAuth discovery URL is required");
  const response = await request(config.discoveryUrl, {
    signal: AbortSignal.timeout(10000),
    redirect: "error",
  });
  if (!response.ok) throw new Error("OAuth discovery is unavailable");
  const metadata = await response.json();
  if (
    metadata.issuer !== config.auth.issuer ||
    typeof metadata.jwks_uri !== "string"
  )
    throw new Error("OAuth discovery issuer or JWKS is invalid");
  if (config.production && new URL(metadata.jwks_uri).protocol !== "https:")
    throw new Error("OAuth JWKS must use HTTPS");
  return { ...config.auth, jwksUrl: metadata.jwks_uri };
}

export async function createRuntime(
  env: NodeJS.ProcessEnv = process.env,
  onPool?: (pool: pg.Pool) => void,
) {
  const config = runtimeConfiguration(env);
  config.auth = await resolveAuthConfiguration(config);
  const db = await openDatabase(config.databaseUrl, onPool);
  try {
    await migrate(db);
    const service = new GameService(db);
    const app = createHttpApp(service, config.auth, config.publicUrl);
    return { db, service, app, config };
  } catch (error) {
    await db.close();
    throw error;
  }
}
