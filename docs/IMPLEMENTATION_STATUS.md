# Implementation status — Lemon Empire 0.1.0

This is an implementation candidate in Entsim, not a completed production release. `SPECIFICATION.md` remains the release target. The working tree's exact verification results are recorded below; a GitHub CI run may add independent PostgreSQL verification after this branch is pushed.

## Implemented behavior

| Requirement                                    | Implementation / evidence                                                                                        |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Three roles and twelve monthly rounds          | Engine and service; complete solo campaign test                                                                  |
| Solo, private 3–6 human rooms, six finite NPCs | Lobby, invites, adjacent roles, readiness; room/concurrency tests                                                |
| Public events and deterministic replay         | PCG32 stream, version fields, frozen settlement inputs and SHA-256 economic hashes                               |
| Opening working capital                        | Strict plans, accepted-contract budget and capacity validation                                                   |
| Farm/distribution markets                      | Uniform cent auctions, scarcity references, price priority, largest-remainder ties                               |
| Supply contracts                               | Offers, atomic acceptance, both plan revisions, delivered-only payment, shortage prorating                       |
| Inventory and reports                          | FIFO carrying cost, decay, cup expiration, depreciation, capex and insolvency                                    |
| Accounting invariants                          | Bigint posted money, Decimal ratios, paired transfer journals and profit/equity reconciliation                   |
| Persistent synchronized rooms                  | PostgreSQL row locks, actor/key locks, exact-success/error cache, settlement uniqueness and transactional outbox |
| Worker recovery                                | Durable LOCKED rounds and jobs; injected-crash rollback/retry test                                               |
| ChatGPT mentoring                              | Own-authorized facts, synthetic opponent scenarios and suggested questions; no AI API                            |
| MCP integration                                | Official SDK Streamable HTTP, MCP Apps resource and bridge; SDK client read/write/resource test                  |
| Authentication                                 | Signed JWT JWKS verification, issuer/audience/expiry/scope checks; no client actor selection                     |
| Privacy                                        | Own projections/export, confirmed anonymization, reflection removal, alias scrub and replay preservation         |
| UI                                             | Creation/join, lobby, decisions, forecasts, contracts, report, reflection and pause/next-round controls          |
| Future features                                | Funds, debt, equities and IPOs intentionally absent                                                              |

## Design decisions / deviations requiring product review

1. **Database shape:** rooms, members, current plans and contracts are stored together in a locked JSONB room aggregate. Settlements, cash journals, idempotency results, jobs and outbox are separate SQL tables. This is transactionally simpler for the initial small-room pilot than the fully normalized blueprint. Before analytics or larger rooms, migrate to the normalized spec schema with backfills and compatibility tests. No client writes state JSON directly.
2. **Forecast baseline:** other humans use synthetic starting balances plus only the requesting player's known contracts. Current private plans, cash and lots never affect the forecast. This is intentionally more conservative than using prior public settled human orders, which are not yet separately published. The UI discloses assumptions.
3. **Round transition:** the host explicitly starts the next month from REPORT, allowing time to read and pause. `lemon_next_round` is an additional idempotent command. RESOLVING is internal to the database transaction; externally readers see LOCKED until an atomic REPORT/COMPLETED snapshot appears. There is no public resolution command.
4. **Ledger:** the current journal represents paired cash transfers and opening cash/PPE capitalization. Noncash inventory, depreciation and accrued overhead are reconciled in business balances and reports; a complete chart-of-accounts general ledger is still required before claiming full ledger auditability.
5. **Privacy and replay:** economic hashes omit actor identifiers and business aliases. Account deletion anonymizes labels while numeric replay remains valid. Historical cached projections may be anonymized, a documented privacy exception to byte-identical idempotency responses. The final deletion receipt retains a hashed subject cache key for retry safety; a scheduled seven-day cache purge remains a deployment task.
6. **API surface:** `/v1/tools/:tool` provides an internal adapter for every MCP handler plus the specified snapshot route. The other named REST convenience routes, generated OpenAPI and explicit tool output schemas are not yet implemented. Inputs are strict Zod schemas. The export read and deletion writes use separate tools; account revisions and deletion jobs remain to be added for large account histories.
7. **Localization:** English game flows are implemented. Hebrew supports primary labels, navigation and RTL, but detailed forms, tutorials, reports and errors still need complete translation and native-language QA.
8. **Learning:** contextual lessons and reflections are present; five-question pre/post checks, consented metrics, badges and learning-score calculation remain unimplemented. No scores or pilot success numbers are fabricated.
9. **Budget reserve:** reserved cost is derived from each validated plan plus accepted contracts rather than persisted as separate reservation rows. Version/row locks protect allocation; explicit audited reservation records remain a normalization milestone.
10. **Deployment:** OAuth authorization and PKCE are delegated to a configured external identity provider, not implemented as a new authorization server. JWT bearer validation exists; opaque-token introspection is unsupported. Local PGlite is for a single process. Production requires external PostgreSQL and OAuth.

## Validation record

- TypeScript check and single-file production widget build pass.
- All 23 backend tests pass, covering engine, concurrency, cash-journal reconciliation, crash recovery, privacy, OAuth signatures, inactivity recovery and MCP.
- Literal retail fixture matches 2,083 cups sold, 6,249 LE revenue, −1,351 LE profit and 8,749 LE closing cash.
- 10,000 randomized auction cases validate matched volume, limit prices and arrival-independent allocation.
- 1,000 seeded twelve-month campaigns exercise 12,000 full settlements with profit/equity and inventory invariants.
- Integration tests use embedded PostgreSQL locally. Service tests also support isolated real-PostgreSQL schemas through `TEST_DATABASE_URL`; CI provisions PostgreSQL 17. Real multi-process PostgreSQL behavior has not been verified locally.
- Two Playwright browser checks pass: solo preview/commit/report/next-round and 360px Hebrew RTL overflow. Target ChatGPT host rendering is a separate uncompleted gate.
- Docker/compose files and GitHub workflow are supplied; no deployment or public release has been performed.

## Release gates in order

1. Run `npm ci`, build and all tests against PostgreSQL 17. Add multi-process stress tests, deadlock/retry handling, fault-injection boundaries and cash-journal reconciliation.
2. Configure the external OAuth client: HTTPS issuer/JWKS, `lemon:play`, resource audience, authorization-code + PKCE S256, exact redirect allowlist, and token lifetime. Validate invalid/expired/replayed authorization flows in the real host.
3. Deploy a private HTTPS staging endpoint. In the intended ChatGPT workspace, connect `/mcp`, authenticate, read rules/profile, write a draft, render the widget, commit, refresh after resolution and verify another user cannot read it. The SDK client test does not substitute for this host smoke test.
4. Complete Hebrew translations, mobile/dark-mode/keyboard and screen-reader audit, pending/error/reconnect flows and nonpersistent interactive tutorial.
5. Complete learning assessments, consented metrics, seven-day idempotency/confirmation cleanup, request IDs, structured redacted logging, monitoring, bounded worker retry/backoff, pagination and operational export/deletion jobs.
6. Normalize financial/reservation records, implement full noncash ledger postings, strict output schemas and generated OpenAPI; broaden economic balance and adversarial contract tests.
7. Run complete solo campaigns in each human role and a real-host multiplayer campaign, then pilot learning and balance. Only after all MVP acceptance criteria pass should this become MVP1. V1.1 investments remain disabled.

## Operational notes

- Back up PostgreSQL before migrations; only migration 001 exists and is idempotent for fresh schemas. Provision schema before starting many replicas concurrently.
- A crashed worker rolls back and LOCKED rounds remain eligible for replay. Repeated failures are logged, not presented as a successful report. Alert on stale LOCKED rooms. Current worker retries once per second without a persisted error/backoff policy.
- Application rate caps are 120 requests/minute per actor/IP **per server process**. Use a shared edge limit for deployments with multiple replicas. No claim of distributed rate limiting.
- Account deletion retains anonymized numeric campaign history so counterparties' accounting remains valid. Backups require an explicit retention and deletion policy before production.
- No secrets, source conversation, ChatGPT transcript, real financial data or payment functionality belong in this repository.

## Playful draft widgets

The planning screen now includes a 12-month journey, role-specific clickable orchard / warehouse / lemonade-stand tiles, synchronized range and numeric controls, capacity progress, weather-adjusted grower output, seller lemon requirements, and a live opening-cash reservation breakdown. English and Hebrew widget copy, RTL, dark mode, keyboard access and reduced motion are supported. These controls edit the local draft only: they never save, commit or advance a round automatically. Server validation remains authoritative, including over-budget rejection. The exact budget module is shared with the engine; financial rules and engine/config versions are unchanged. No synthetic XP, revenue promises or opponent-private data are added.
