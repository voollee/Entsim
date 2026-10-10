# Entsim — Lemon Empire

An educational lemon economy built as a ChatGPT MCP app. This branch implements a playable MVP candidate: three supply-chain roles, private rooms, finite NPC competitors, twelve rounds, contracts, deterministic markets, reports and mentoring context.

**Status:** local backend, economic and MCP protocol checks pass. This is not a deployed or host-verified ChatGPT app. See [implementation status](docs/IMPLEMENTATION_STATUS.md) for remaining release gates and deliberate specification deviations.

## Run locally

Requires Node.js 22+ and npm. No AI API key is needed.

```sh
npm ci
npm run build
npm run dev
```

Open `http://127.0.0.1:3000`. Development identities are available only in development mode. Each identity has separate campaigns. Switch identities to exercise multiplayer in separate browser tabs. The local database persists in `.data/postgres`; set `DATA_DIR=memory://` for disposable experiments. A server-side worker checks deadlines every second.

```sh
npm run typecheck
npm test
npx playwright install chromium
npm run test:ui
```

Build the widget before running tests: the MCP resource test reads `dist/index.html`.

## PostgreSQL / production

Copy `.env.example` to `.env`, fill the required deployment values, and load them using your deployment's environment configuration. The application does **not** automatically read `.env`. With Node.js:

```sh
node --env-file=.env --import tsx apps/server/index.ts
```

Use PostgreSQL for shared/multiple processes. Development PGlite is an embedded PostgreSQL instance for one server process, not a multiplayer deployment topology. `NODE_ENV=production` rejects development authentication and requires `DATABASE_URL`. Production OAuth verifies signed JWTs against the configured provider's JWKS, issuer, audience, expiry and `lemon:play` scope. Opaque tokens require a future introspection adapter. Your external OAuth provider must supply authorization-code + PKCE S256, registration and the exact ChatGPT redirect allowlist.

Set `PUBLIC_URL` to the externally reachable HTTPS origin. Connect ChatGPT to `PUBLIC_URL/mcp` after OAuth and target-host smoke checks. The UI resource uses MCP Apps `App` and the official TypeScript MCP SDK. Do not expose the development server to the internet.

```sh
TEST_DATABASE_URL=postgres://lemon:lemon@localhost:5432/lemon npm test
DATABASE_URL=postgres://lemon:lemon@localhost:5432/lemon npm run worker
```

The test adapter creates a separate schema for each service test. The separate worker is optional; it shares the production database and competes safely with the in-server worker under row locks. Serve behind TLS and configure `HOST=0.0.0.0` for container deployment.

## Repository

For the Vercel adapter, native Neon/Descope configuration, deadline scheduling limits and deployment checks, see [docs/VERCEL.md](docs/VERCEL.md).

- `apps/server`: authenticated REST and MCP adapters over common commands.
- `apps/worker`: durable deadline/resolution loop.
- `apps/widget`: React UI, MCP Apps bridge, English/Hebrew shell and mobile layout.
- `packages/engine`: pure settlement, PCG32 events, uniform auctions, FIFO inventory and reconciliation.
- `packages/contracts`: strict Zod inputs and business errors.
- `packages/config`: versioned coefficients and feature boundary.
- `packages/db`: PostgreSQL/PGlite adapters and schema.
- `tests`: literal fixture, properties, concurrency, privacy, fault injection and browser flows.
- `docs/SPECIFICATION.md`: authoritative English PRD and technical specification.
- `docs/IMPLEMENTATION_STATUS.md`: requirements mapping and release gates.

Investment funds, loans, shares and IPOs remain outside MVP1. No public resolve-round or mint-money tool exists. Neither REST nor MCP accepts a client-selected actor. The mentor uses ChatGPT's conversation and cannot bypass command validation.
