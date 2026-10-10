# Lemon Empire on Vercel

The TypeScript Lemon Empire server and single-file MCP Apps widget deploy together. `api/game.ts` shares the existing `GameService`; financial rules and engine/config versions are unchanged. PostgreSQL stores campaigns outside ephemeral functions. Cold starts serialize migrations with a PostgreSQL advisory transaction lock. The pool is bounded and attached to Vercel's lifecycle.

## Configuration

Use Node 24, `npm ci`, and `npm run build`. `vercel.json` includes the built widget and SQL migration in the function bundle and excludes local credentials/data. Production requires:

- `DATABASE_URL`: PostgreSQL with verified TLS, injected by Neon when connected to Production.
- `PUBLIC_URL`: the externally reachable HTTPS origin.
- `AUTH_MODE=oauth`.
- `OAUTH_ISSUER`, or native `DESCOPE_ISSUER`.
- `OAUTH_JWKS_URL`, or `OAUTH_DISCOVERY_URL` / native `DESCOPE_DISCOVERY_URL`. Discovery must match the configured issuer and supply HTTPS JWKS.
- `OAUTH_AUDIENCE`: the exact audience issued by the configured OAuth application; do not infer it from the project ID or skip validation.
- `OAUTH_SCOPE=lemon:play`: the provider must actually issue this scope.
- `CRON_SECRET`: a securely generated random secret. Vercel sends it as a bearer token to the recovery job. Never commit it.

Missing configuration returns a redacted 503. `/readyz` and `/healthz` check the database. The development identity adapter is forbidden in production. `/internal/worker` requires the cron secret before opening a database connection.

Configure the identity provider for authorization-code + PKCE S256, the intended resource/audience, `lemon:play`, suitable token expiry and the exact callback URL shown by ChatGPT. Use the provider's dynamic registration or a configured client. Do not accept wildcard callback URLs or reuse development identities.

## Deadline scheduling deviation

Vercel functions have no permanent timer. The adapter recovers overdue/locked rounds before requests and uses `waitUntil` for work following the response. Transactions, unique settlements and outbox constraints protect retries and concurrent workers.

The free Hobby plan supports only a **daily** cron job; `vercel.json` schedules recovery at 00:00 UTC. Active users trigger recovery through their requests, but unattended LIVE/ASYNC rooms can settle late. This is a deployment limitation relative to the always-running worker in the specification. For punctual unattended deadlines, run `npm run worker` against the same PostgreSQL database on an always-running service, or configure an authenticated frequent scheduler. No paid plan upgrade is implicit in this deployment.

## Current infrastructure and validation (2026-10-10)

The existing Vercel project is `shimi-azarias-projects/entsim`. Native Marketplace resources `lemon-empire-db` (Neon Free, Frankfurt) and `lemon-empire-auth` (Descope Free) were provisioned after terms acceptance and connected to Production. Preserve them; do not create duplicates merely to redeploy.

The Descope discovery document verifies HTTPS issuer/JWKS, authorization-code flow, PKCE S256 and dynamic client registration. Its initial advertised scopes are `full-access` and `offline_access`; **`lemon:play` is not configured yet**. Administrative provider configuration and a real authenticated ChatGPT smoke test remain release gates. Resource provisioning alone does not establish a working login or the token audience.

Local verification: TypeScript/build/format checks, 29 backend tests with real PostgreSQL 17 (zero skipped), and four Chromium browser checks passed. Separate Node processes race fresh-schema migrations and resolution and produce one settlement/outbox. The serverless HTTP test covers commit, post-response settlement, identical retry receipts and worker authentication.

Deploy a candidate with `vercel deploy --prod --skip-domain --yes`, inspect `/readyz`, OAuth metadata, MCP tools/rules/widget and rejection of unauthenticated writes. Promote only after provider configuration and target ChatGPT authentication/read/write/widget checks. Deployment protection must allow the intended ChatGPT endpoint while application OAuth remains enabled.

## Preserving the previous Entsim pilot

The old Python workspace was archived at `/workspace/entsim-backups/entsim-before-lemon-20261010.tar.gz` before replacing the checkout with GitHub Lemon Empire main. Its Turso `entsim-games` resource and records remain intact. Lemon uses a separate Neon database; no old game data was migrated or deleted. Keep the archive private because it includes local configuration and data. Do not upload it or include it in deployments.
