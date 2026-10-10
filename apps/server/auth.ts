import { createRemoteJWKSet, jwtVerify } from "jose";
import { GameError } from "../../packages/contracts/index.ts";
export interface AuthConfig {
  mode: "development" | "oauth";
  issuer?: string;
  audience?: string;
  jwksUrl?: string;
  scope?: string;
}
export function authenticator(config: AuthConfig) {
  if (config.mode === "development" && process.env.NODE_ENV === "production")
    throw new Error("Development authentication is forbidden in production");
  if (
    config.mode === "oauth" &&
    (!config.issuer || !config.audience || !config.jwksUrl)
  )
    throw new Error("OAuth requires issuer, audience and JWKS URL");
  const jwks = config.jwksUrl
    ? createRemoteJWKSet(new URL(config.jwksUrl))
    : null;
  return async (header: string | undefined): Promise<string | null> => {
    if (!header) return null;
    if (config.mode === "development") {
      if (!/^Bearer dev:[a-zA-Z0-9_-]{1,40}$/.test(header))
        throw new GameError(
          "UNAUTHENTICATED",
          "Invalid development identity",
          401,
        );
      return "dev:" + header.slice(11);
    }
    if (!header.startsWith("Bearer "))
      throw new GameError("UNAUTHENTICATED", "Bearer token required", 401);
    try {
      const { payload } = await jwtVerify(header.slice(7), jwks!, {
        issuer: config.issuer,
        audience: config.audience,
        algorithms: ["RS256", "ES256"],
      });
      if (!payload.sub || !payload.exp)
        throw new Error("Missing subject or expiry");
      const scopes =
        typeof payload.scope === "string" ? payload.scope.split(" ") : [];
      if (!scopes.includes(config.scope ?? "lemon:play"))
        throw new Error("Missing scope");
      return `${payload.iss}|${payload.sub}`;
    } catch {
      throw new GameError(
        "UNAUTHENTICATED",
        "Token is invalid, expired, or lacks the required scope",
        401,
      );
    }
  };
}
