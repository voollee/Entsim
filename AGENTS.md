# Entsim / Lemon Empire implementation rules

Read `docs/SPECIFICATION.md` and `docs/IMPLEMENTATION_STATUS.md` before changing game behavior. The English specification is authoritative; document a deviation before treating it as product policy.

- Posted money uses bigint cents serialized as strings. Quantities are whole kg/cups.
- The engine is pure and deterministic. Do not put LLM decisions, clocks, DB queries or network calls in settlement.
- Fix bugs with invariant or literal-fixture tests; do not bless changed results without reviewing the formula.
- All user actions share GameService handlers. Actor identity comes only from verified request context.
- Keep opponent plans, balances, inventories and unrelated contracts out of all model/UI projections and forecasts.
- Opening cash must reserve costs. Never fund current purchases from projected revenues.
- Preserve transaction boundaries, idempotency locks, one settlement per room/round, journals and replay.
- Account deletion may anonymize actor/alias fields. Economic replay hashes intentionally exclude those labels.
- Bump engine/config versions for released economic changes. Never migrate a running campaign silently.
- Do not enable funds, loans, stock exchange or IPO features in MVP1.
- Run `npm run typecheck`, `npm run build`, `npm test` and appropriate browser tests. Test real PostgreSQL with `TEST_DATABASE_URL` before claiming multi-process concurrency is verified.
- Never call the app production-ready until the target ChatGPT OAuth/read/write/widget smoke test passes.
- Do not commit `.env`, tokens, `.data`, node_modules or browser output.
