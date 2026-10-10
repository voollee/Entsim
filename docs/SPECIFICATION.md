# Lemon Empire Product and Technical Specification

Version 1.0 | 10 October 2026 | Implementation handoff for Codex and Claude Code

## 1. Implementation mandate and authority

Build an educational economic simulation delivered inside ChatGPT by an authenticated MCP server and an embedded MCP Apps UI. Preserve the agreed concept: lemon growers, distributors and lemonade sellers share one economy; decisions change other businesses' outcomes; solo players face rule-based NPC businesses; multiplayer rooms support 3–6 humans; a campaign has 12 synchronized monthly rounds. Teach entrepreneurship, business management, investment literacy, and effective use of ChatGPT through decisions and reflection.

This specification makes design decisions where previous discussion did not settle implementation details. These are proposed product defaults, not assertions about already implemented software. Both the DOCX and Markdown requirements are in English. The DOCX provides a formatted reading version; this Markdown is authoritative for algorithms, field names, transaction ordering and acceptance tests. Any discrepancy must be recorded and reconciled before implementation; do not silently choose a different formula.

Deliver MVP1 only initially. Keep feature flags off for investment instruments and loans. Do not implement IPOs, an independent AI inference backend, public matchmaking, payments, real financial assets or free-form player chat in MVP1. A player-requested action in natural language must use exactly the same command handlers and validation as a UI action.

### Release boundary

| Release | Included                                                                                                                                                                                                      | Exit condition                                                                                     |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| MVP1    | All three roles; solo or private 3–6 human rooms; 12 rounds; spot markets and one-round supply contracts; events; basic upgrades; reports; ChatGPT mentoring; deterministic engine; OAuth; Hebrew and English | Every MVP acceptance test passes and a complete solo and multiplayer campaign works inside ChatGPT |
| V1.1    | Sector funds and total-return indices; diversification lessons; bounded loans                                                                                                                                 | Fund NAV, cash flow and debt tests pass; balanced 12-round economy                                 |
| V2      | Player shares, primary issuance/IPO, secondary auctions, dividends and dilution                                                                                                                               | Cap-table, auction, anti-manipulation and investor-visibility tests pass                           |
| V3      | Multi-round contracts, M&A, classroom dashboards, larger rooms, richer NPCs, additional industries                                                                                                            | Separate product and balance review; no change to running campaigns                                |

MVP excludes investments deliberately: first validate the shared supply chain and learning loop. The data model anticipates extensions without forcing inactive instruments into the initial UI.

## 2. Audience, learning and success measures

Initial pilot: adults and age-eligible teenagers using their own permitted ChatGPT accounts. Classroom access, guardian workflows and access for younger children are separate releases and require host eligibility and privacy review. No assumption that an MCP connection removes ChatGPT's account restrictions. Users need no prior accounting knowledge.

Learning outcomes: distinguish cash from profit; calculate unit margin and break-even; plan working capital; understand demand elasticity and supply constraints; negotiate tradeoffs; diversify rather than chase returns; distinguish equity from debt and dilution; ask ChatGPT precise questions, check assumptions and compare scenarios.

Targets are pilot goals, not measured facts: 75% finish onboarding in under 5 minutes; 60% of started campaigns reach round 6; 40% finish round 12; a paired 5-question knowledge check improves by at least 20 percentage points among completers. Report sample size and non-completer bias. Mentor use is optional and is never a requirement for economic success.

Track onboarding_completed, campaign_started, plan_previewed, decision_committed, mentor_context_requested, round_report_viewed, reflection_answered, campaign_completed and knowledge_check_submitted. Do not treat mentor-context retrieval as proof that a model response was read. Store consented structured event data, not the user's ChatGPT transcript.

## 3. Journey, screens and accessibility

1. Open Lemon Empire in ChatGPT, see fictional-currency notice and choose Hebrew/English. Authenticate when saving or joining a campaign. A public tool can show rules without account data.
2. Select solo or create/join a room; choose beginner/standard tutorial depth. These change explanation density, not engine coefficients within a competitive room.
3. Choose grower/distributor/lemonade seller; compare decision count, cash needs and risks. Name business with a 32-character plain-text alias.
4. Play a non-persistent tutorial example using forecast, decision and results; explicitly distinguish estimate from settled outcome. Then start the real campaign.
5. Each round: review market bulletin and own finances, optionally ask mentor, negotiate contracts, draft plan, preview, commit, wait for room, read report, reflect, continue.
6. Round 12: settle, show wealth and learning separately, explain main decisions and offer a new campaign with a different role. Never reset an existing campaign silently.

| Screen           | Required content and actions                                        | Empty/error behavior                                         |
| ---------------- | ------------------------------------------------------------------- | ------------------------------------------------------------ |
| Home             | Resume campaigns, create, join, rules                               | Reauthorize without losing progress                          |
| Onboarding       | Language, notice, role comparison, tutorial                         | Back keeps input; no accidental real round                   |
| Room lobby       | Aliases, roles, seats, host, invite code, timing                    | Full/expired/started invite explains failure                 |
| Dashboard        | Round, cash, inventory, capital, profit trend, event, ready status  | Snapshot version and refresh control                         |
| Decisions        | Role fields, capacity/budget checks, upgrade choice                 | Inline field errors, preserve valid draft                    |
| Market/contracts | Previous prices, public bulletin, own orders, received offers       | Rejected/expired offers remain in history                    |
| Preview          | Baseline and ±20% demand scenarios, cash at risk                    | Mark estimate and assumptions; no opponent drafts            |
| Round report     | Sales, input costs, overhead, cash bridge, spoilage, counterparties | Failed resolution displays retry status, never half a report |
| Mentor           | Suggested questions that continue in ChatGPT                        | Rules and explanations still available without inference     |
| Learning/final   | Concepts, reflections, rankings, replay own history                 | No fabricated knowledge scores                               |
| Investment tabs  | V1.1 indices/portfolio; V2 shares/IPO                               | Hidden rather than unusable MVP buttons                      |

Design for 360px width and keyboard access, dark/light host themes, WCAG 2.2 AA as a product target, visible focus, labels independent of colors, reduced motion, and direction-aware Hebrew RTL. Render formulas, numeric fields and identifiers LTR. Tables require a compact mobile list alternative. Never force an oversized iframe or assume fullscreen support.

## 4. Rules and round state machine

Currency LE is fictional; 1 LE = 100 integer cents. Units: whole kilograms of lemons and whole cups. One kilogram makes four cups. All businesses start with 10,000 LE cash, 5,000 LE PPE book value, no debt, zero inventory and reputation 50/100. Equal initial accounting equity is 15,000 LE; role-specific assets are teaching abstractions, not real industry valuations. Initial capacities: grower 1,000kg/month, distributor 1,000kg incoming/month, seller 4,000 cups/month. Fixed overhead per round is 500 LE, 400 LE, 500 LE respectively. No taxes, wages by employee, geography or exchange rates in MVP; overhead abstracts labor/rent.

Grower decisions: planned harvest kg [0,capacity], ask price 1–6 LE/kg, upgrade none/capacity. Distributor: target procurement kg [0,capacity], maximum purchase price 1–6, resale ask 2–10, sales quantity cap [0,capacity], upgrade. Seller: target procurement kg [0,capacity/4], maximum purchase price 2–10, planned cups [0,capacity], retail price 1–8 LE/cup, marketing 0–1,000 LE, upgrade. Plans include one-round contractual commitments automatically; they must not contradict them. Zero production is legal and still incurs fixed overhead.

`LOBBY -> PLANNING -> LOCKED -> RESOLVING -> REPORT -> PLANNING` (next month), with `REPORT -> COMPLETED` after month 12. `PAUSED` is permitted between settled rounds only, with previous state recorded. Cancellation in lobby is reversible; a started campaign is archived, not erased by the host.

Each month shares the same publicly known event for every business. Human plans are private until settlement. Users can save drafts; commit locks their plan and accepted contracts. Commitment cannot be withdrawn. A contract counterpart cannot revise/accept offers touching an already committed business. Locking occurs on all human commits or deadline. Solo commits trigger locking immediately.

Room timing: live 10-minute planning window or async 24-hour window, chosen in lobby and immutable after start. At deadline a draft is NOT committed automatically. Uncommitted businesses receive the conservative default: no upgrade or marketing; honor accepted contracts; production/procurement needed for those contracts only; otherwise zero discretionary activity. Idle overhead still applies. Server marks `timed_out`. Three consecutive missed rounds switches to the same default for the remainder, with user able to reclaim control at the next planning round; no new participant may take their business.

Host can start with 3–6 distinct humans, pause after a report, resume, or transfer host to a member. Host cannot resolve early, edit another plan, mint money or inspect another mentor context. Every human chooses any role; missing supply-chain roles are supplied by finite NPCs. Solo has one human plus two NPCs per role. Multiplayer has two NPCs per role as price/quantity anchors, regardless of chosen roles. NPC profit is excluded from rankings.

Progressive explanation: rounds 1–2 cash, sales and margin; 3–4 inventory and contracts; 5–6 capacity and elasticity; 7–9 market events and opportunity cost; 10–12 strategy and reflection. All essential role actions remain available from round 1. Badges reward exploration and explanation, not borrowing or maximum spending.

Final competitive measure: economic equity = cash + FIFO inventory carrying value + PPE net book value (+ fund/share marks in future) - debt. Rank within each human role; mixed-role room gives separate role winners rather than one misleading cross-role winner. Learning score is a separate 0–100 score from structured quizzes/reflections and never modifies prices or cash. No unsupported claim of equal difficulty between roles.

## 5. Numeric conventions and versioning

Use bigint cents for posted money, integer quantities, and an arbitrary-precision decimal library for ratios/powers. Serialize bigint as decimal strings. Decimal precision 28; ROUND_HALF_UP when posting each atomic monetary transfer. Engine prices first round to cents; cash transfer = integer quantity × rounded unit price. Never use JS Number for posted balances. When splitting integer quantities use largest remainder, ties by immutable business ordinal assigned at creation; order arrival does not give priority. Each debit has an equal credit to an account including NPC/external sinks. Starting capital is a tagged external transfer, not unaccounted cash.

Persist `engine_version`, `config_version`, seed and public-event draws with the room. Canonically sort all inputs before hashing; preserve every input snapshot and output hash for replay. Randomness uses a fixed documented PRNG implementation (PCG32) and independent streams derived from seed, round and purpose. For production MVP randomness is only a round-level event draw. No LLM output is an engine input. Version changes affect newly created campaigns only.

### Configuration version 1

| Parameter                                           | Default                                                                      |
| --------------------------------------------------- | ---------------------------------------------------------------------------- |
| farm reference price / distribution reference price | 3 LE/kg / 5 LE/kg                                                            |
| reference retail price                              | 3 LE/cup                                                                     |
| farm/distribution price bounds                      | [1,6] / [2,10] LE/kg                                                         |
| scarcity exponent beta                              | 0.35                                                                         |
| blended reference update                            | 0.70 previous + 0.30 scarcity target                                         |
| grower variable cost                                | 1 LE per planned kg harvested                                                |
| distributor handling                                | 0.50 LE per kg acquired                                                      |
| seller non-lemon conversion cost                    | 0.50 LE per cup actually produced                                            |
| inventory decay                                     | grower 15%, distributor 10%, seller raw lemons 10%; finished cups 100%       |
| retail price elasticity / marketing coefficient     | 1.20 / 0.25                                                                  |
| NPC opening cash                                    | 100,000 LE each, no replenishment during campaign                            |
| PPE depreciation                                    | 100 LE/month while book value is at least 100; floor zero                    |
| capacity upgrade                                    | 2,000 LE, adds 250kg grower/distributor or 1,000 cups seller from next round |

Constants must live in checked-in JSON with schema validation, not duplicated across UI and engine.

## 6. Economic engine

### 6.1 Supply, events and ordering

At round opening, choose one event from weights: normal 50%, drought 15%, heatwave 15%, festival 10%, input-cost shock 10%. Normal: yield=1, demand=1, cost=1. Drought: yield=.70, demand=1, cost=1. Heatwave: yield=.90, demand=1.25, cost=1. Festival: yield=1, demand=1.30, cost=1. Input shock: yield=1, demand=1, cost=1.20. Draw is public before plans; there are no hidden random changes after commit in MVP. Multiply grower variable cost, distributor handling and seller conversion cost by the cost factor; fixed overhead is unchanged.

Grower new harvest `H = floor(plannedKg * yieldFactor)`; available supply = opening surviving stock + H. Charge grower production cost on plannedKg (effort is spent even if yield fails). Distributor may buy from growers only; lemonade seller may buy from distributors only. No raw grower-to-retailer shortcut in MVP.

Settlement phases, in this exact order: validate/lock inputs; reserve overhead and discretionary budgets; harvest and production cost; settle farm contracts; clear farm spot market; charge distributor handling; settle distribution contracts; clear distribution spot market; produce lemonade; allocate consumer demand and charge sales; spoil unsold inventory/cups; pay overhead; update reputation; depreciate PPE; execute prepaid upgrades and enable them next round; mark future instruments/debt (when enabled); create reports and ledger; commit atomically; open report state. Contract delivery to sellers is possible from a distributor's newly acquired farm lemons within this same round.

Capacity bounds limit new harvesting, distributor incoming volume and seller cup production, not merely closing inventory. Opening distributor inventory may be resold without using incoming capacity again.

### 6.2 Working capital and reservations

Do not rely on projected sales to fund a plan. Validate against opening available cash. Grower reserve = overhead + upgrade + plannedKg × variableCost. Distributor reserve = overhead + upgrade + contracted input payments + spot input cap × bidLimit + total targetIncomingKg × handlingCost. Seller reserve = overhead + upgrade + marketing + contracted input payments + spot input cap × bidLimit + plannedCups × conversionCost. All terms use current event factors. Existing contract escrow is included once, not counted twice. Target input includes contracted quantities; spot cap = max(0,targetInput - contractedInput). Reject targets smaller than contracted input and production/sale caps smaller than contractual output commitments (using announced yield and opening stock for growers).

Contract output is constrained by physically expected availability, not cash received in the future. Reserve overhead first. Available means cash minus contract escrow and other reservations. Unused variable-cost reserves return after settlement; actual production spending and executed purchases debit cash. Reservations are separate balance fields, not expenses. Sum of active reservations may never exceed cash. If a business cannot reserve overhead at opening, mark distressed; it sells existing stock if feasible, makes no discretionary purchases/production, pays min(cash after sales,overhead), and records remaining overhead as payable. Two rounds with unpaid overhead, or negative equity, triggers insolvency. Liquidate inventory at 50% of reference input price and PPE at 50% book value to the external liquidation account, pay payables in order of creation, and remove business from active trading. Cash floor zero; unpaid liabilities remain for final equity. User continues as observer/learner. No compulsory new loan or automatic reset.

### 6.3 One-round contracts

A seller creates a firm supply offer to a named room business in the adjacent role: kg, price cents, current round, expiry before deadline. Counterparty accepts using current snapshot and idempotency key. Seller capacity and buyer cash are reserved atomically. If either party has committed or offer expired, reject. A business cannot accept more contracts than available capacity/inventory or input target permits; acceptance includes explicit updated minimum procurement/production commitments. MVP provides fixed quantity, fixed price, delivery this round; no forward futures, credit, guarantees or multi-round penalties.

Offers are nonbinding until accepted. Once accepted they cannot be cancelled; concurrent accepts cannot reuse capacity or money. At settlement contracts are first in line. If realized supply is insufficient, prorate across accepted output contracts by promised kg with largest remainder. Charge delivered kg only; release escrow for undelivered kg. Do not pay for undelivered goods and do not invent lemons. Record fill rate and reputation effect. Distributor reserves capacity to acquire contract output but farm-market shortage can still cause distribution shortfall. This teaches supply risk; no cash penalty beyond lost sales and reputation in MVP.

### 6.4 Spot market and scarcity price

After contract allocation each upstream seller posts at most one residual ask; downstream buyer posts at most one residual bid. Contracted quantities are removed from both. Quantity is bounded by residual supply/incoming capacity and reserved budget.

For each farm/distribution venue: let S=sum residual asks including NPC and D=sum residual bids including NPC. If S=0 and D=0, hold previous reference. Otherwise `target=clamp(P0 * ((D+1)/(S+1))^0.35, venueMin, venueMax)` and `reference=roundCents(clamp(0.70*previousReference+0.30*target,min,max))`. This reference is educational and seeds future rounds; actual trades follow order prices and the clearing algorithm below.

Uniform call auction: evaluate every whole-cent candidate p within the venue bounds. `S(p)=sum ask quantities where ask<=p`, `D(p)=sum bid quantities where bid>=p`, `V(p)=min(S(p),D(p))`. Select p with greatest V; then least absolute S-D; then closest to updated reference; then lowest p. If max V=0, execute no spot trades and publish reference plus `noTrades=true`, not a fabricated sale price. Fill asks from lowest ask upward and bids from highest bid downward. At the marginal equal-price tier, prorate quantity by order size with largest remainder. Pair the allocated fills using business ordinals and transfer at the common p. No entity may trade with itself. Adjacent role constraints eliminate self-trades in MVP.

Price/quantity behavior is endogenous: changing an order can alter V and the clearing price. Unit cost and cash remain consistent even when the informational reference differs from the executed price. Fees are zero in MVP.

### 6.5 Finite NPC market

At room creation instantiate two NPC businesses for each role. They have the same accounting and capacities as humans, except 100,000 LE starting cash. Farm NPC plan: harvest 1,000kg each, ask at max(farmMin,previous farm reference×.90). Distributor NPC target=1,000kg, bid previous farm reference×1.10 bounded, resale ask previous distribution reference×.90 bounded, sales cap=1,000kg. Seller NPC target=1,000kg, bid previous distribution reference×1.10 bounded, plan=4,000 cups, retail=3 LE, marketing=0. Clamp plans down to available cash after overhead. NPCs do not negotiate contracts or upgrade in MVP. They have finite inventory and cash, incur spoilage and cannot buy or sell unlimited volume. They compete in exactly the same auctions and retail allocation. This prevents isolation when a role is missing without eliminating player influence.

### 6.6 Retail demand and production

At room creation set base consumer demand `D0 = 2,500 * initialActiveSellerCount` cups (humans + two seller NPCs), fixed for the campaign. Total demand this round = floor(D0 × demandFactor). This normalization makes one seller's game similar in scale when the number of sellers changes; more growers/distributors can still create excess supply.

Seller production `Q_i = min(plannedCups_i,capacityCups_i,4*availableLemonKg_i)`. Consume `ceil(Q_i/4)` kg FIFO; unused fraction of the last kilogram is counted as conversion waste. Deduct conversion cost on Q_i, and spend full committed marketing. Weight `w_i=(retailPrice_i/3)^(-1.20) * (0.5 + openingReputation_i/100) * (1 + .25*ln(1+marketingLE_i/100))`. Outside option weight `w_out=0.20*initialActiveSellerCount`. The outside option represents consumers choosing something else.

Allocate integer total demand across active sellers and outside option proportionally to weights by largest remainder. Sales_i = min(Q_i,allocatedDemand_i). No reallocation of unfulfilled demand in MVP: consumers attached to a sold-out business leave. Report these lost sales so players understand the model. Outside option cannot earn money for players. Low price boosts share but can reduce profit; low total supply produces unmet demand.

Retail revenue = sales × retail price; external consumer account funds it and is explicitly outside the competitive money supply. Finished unsold cups expire at round end. Reputation becomes clamp(opening reputation + roundHalfUp(5*(fillRate-.80)),0,100); fillRate=delivered/promised for an upstream business with promises, or sales/allocatedDemand for a seller with allocated demand. With no promises/demand the change is zero. Apply opening reputation to current demand; changes affect next round.

### 6.7 Inventory, accounting and learning metrics

Track FIFO inventory lots in whole kg with acquisition/production cost cents. Grower cost per realized kg is total crop production cost / H (if H=0, expense all production cost as crop loss). Allocate cost cents to lots/units by largest remainder; no balance-changing floating rounding. Distributor adds handling to acquisition cost of incoming lemons; seller inventory maintains acquisition cost. Output conversion uses raw costs plus conversion expense; finished cups are all sold or written off in the round, so total ingredient and conversion cost is recognized that round, split between sold and unsold output for the report.

Closing raw inventory loses `floor(remainingKg*decayRate)` kg; consume decay FIFO as spoilage expense. Remaining stock survives to next opening at carrying cost (no upward marking to market). Selling inventory recognizes its FIFO carrying cost as COGS; purchases themselves are cash outflow and asset creation. Upgrades are capex, not operating expense; depreciate existing PPE before capitalizing this round's upgrade. Grower, distributor and seller depreciation defaults are all 100 LE/round, floored at remaining book value. Liquidation liabilities cannot disappear.

`Revenue = sum sales`; `GrossProfit = Revenue - COGS`; `OperatingProfit = GrossProfit - overhead - marketing - spoilage/writeoff - depreciation` (crop loss is writeoff; do not count it twice). Future net profit also subtracts interest. `CashClose = CashOpen + received sales - executed purchases - production/handling/conversion payments - overheadPaid - marketing - capex (+ future financing/trades/dividends)`. `Equity = cash + inventory + PPE - payables (- future debt)`. Net equity movement reconciles profit excluding future owner capital flows.

Unit contribution = sell price - variable sold-unit cost; break-even quantity = ceil((fixed overhead + marketing + depreciation)/positive contribution). If contribution<=0 display 'no finite break-even at this price'. For sellers explain ingredient/conversion waste; use estimate before settlement and realized costs after. Return ratio = change in equity / opening equity when positive; do not label undefined denominators zero. Show cash runway only if estimated net cash burn is positive and clearly forecast-based.

### 6.8 Worked deterministic fixture

Isolated retail calculation, with no NPCs or auction (unit fixture, not a full campaign): one seller, D0=2,500, no event, reputation 50, no marketing, price 3, raw purchase 1,000kg at 5, plan/produce 4,000 cups. w=1, outside=.2. Largest remainder allocates 2,083 cups to seller and 417 outside. Revenue=6,249 LE. Raw ingredient cost=5,000; conversion cost=2,000. Sold cost=3,645.25 LE and unsold finished writeoff=3,354.75, using allocation rounding. Overhead=500 and depreciation=100. Operating profit=-1,351 LE. Starting cash 10,000 -> closing cash 8,749; PPE 5,000 ->4,900; equity 15,000 ->13,649. Total cost was 7,000 despite partial sales. This fixture teaches why revenue is not profit and production volume alone does not create demand.

## 7. Multiplayer and concurrency

Lobby joins require authenticated identity plus a cryptographically random 128-bit invite token, encoded URL-safe, stored hashed. Display a shareable URL and code; users share manually. Do not send email invitations in MVP. Tokens expire after 7 days or at campaign start, have 6-use room bound, and can be revoked by host. Joining the same identity twice returns existing membership. A room can contain 3,4,5 or 6 humans; one user has one business. Joining after start is forbidden.

Snapshot contains `snapshotVersion`, round phase, deadline, public event/prices, member readiness, own business/private draft, permitted contracts and reports. Redact other players' current plans, reservations, inventory lots, cash and private mentor data; public settled aggregate market information is visible. In V2 listed-company financial statements become public by explicit listing policy.

Use optimistic version checks for plan/offer edits and per-entity revisions. Joining and creating invitations increments lobby version. Accepted contracts touch both businesses and their plan revisions. The client gets a fresh snapshot after a conflict; never auto-apply a stale plan. All reads come from committed snapshots; no partial resolution data.

Commit and deadline paths race through a PostgreSQL room lock and a conditional round phase update. Unique `(room_id,round_no)` resolution ensures one outcome. Worker uses the frozen inputs, writes outputs in one transaction, updates state with CAS, and writes an outbox entry. On crash rollback and replay; on serialization failure retry with bounded exponential backoff. Persist job status so restart scans LOCKED rounds without relying on transient queues. A report may be polled from the UI; the app does not require shared ChatGPT conversations or simultaneous model sessions.

Synchronization MVP: UI requests own authorized snapshot via host-mediated MCP calls, manual refresh and 10-second polling only while visible when the host supports it. Stop polling when hidden, cap one request in flight, backoff to 30s after errors. If background tool calls are disallowed, use refresh; correctness is identical. No WebSocket dependency. V2 may add approved direct event transport; host lifecycle is feature-detected. Backend deadline worker is independent of an open iframe.

## 8. V1.1 sector indices and loans

These rules are future behavior, not MVP tools. Each role has a simulated sector index. Use a fixed initial constituent basket of two NPC companies plus all humans of that role; failed companies remain at residual equity (floor zero), so bankruptcy is not removed to inflate returns. Initial index level=100. `E_s,t=sum max(0,operatingEquity_i,t)`; exclude each business's investment holdings and debt-financing inflows from operating performance; reconcile external primary capital flows. In V1.1 no IPO capital exists. `R_s,t=clamp((E_s,t-E_s,t-1)/max(E_s,t-1,1 LE),-1,1)`; `I_s,t=I_s,t-1*(1+R_s,t)`. Clamp makes the index an explicitly simplified teaching model, not a real return estimate. At zero constituent equity the index goes to zero and closes; no resurrection at the old price.

Index-fund units, not the index itself, are tradable. A simulation fund publishes total-return NAV=100 LE initially and evolves by the same R. External fund counterparty credits/debits gain/loss and carries the opposite ledger entries. Supply/redemption is backed by fund-counterparty accounting; no player-to-player gift occurs. Orders entered this month execute at the next round opening NAV after settlement; reserved subscriptions do not receive the just-completed return. Redemptions are reserved units. Transaction fee=.1% of gross cents, minimum 1 cent, paid to external fee account. No dividends in V1.1 because NAV already includes total return; adding dividends later must remove them from the return component to prevent double counting.

Only funds of roles other than the player's own are eligible. Aggregate subscription spend cap=min(25% of opening cash, cash left after committed operating reserves). No shorting, margin or leverage for investments. Portfolio: units, average cost, NAV, realized/unrealized gain, fee, diversification lesson. Funds carry gain and loss, never guaranteed yield. Whole 0.0001 units; price bigint cents and decimal unit accounting. Zero-NAV holdings cannot be redeemed for money.

Loans: enable after month 4 and positive equity; one outstanding loan, principal cap 30% of positive operating equity; interest=1% outstanding principal per simulated month; maturity=min(3 rounds, rounds remaining); reserve debt service before discretionary action; no loan-financed fund subscriptions (subscription cap uses pre-loan cash). Debit interest monthly and repay principal at maturity. Publish total cost before acceptance. If cash inadequate liquidate fund units first, then use insolvency rules; no automatic rollover. Add debt/interest flows to reports and winner equity. These are fictional gameplay terms.

## 9. V2 shares and IPO

Only profitable, solvent human companies can list: at least 6 settled rounds, positive cumulative operating profit, no overdue payable, and at least 3 completed commitments. Founder holds 10,000 initial shares. An IPO can issue at most 2,500 new primary shares; at full issuance public ownership is 20%. Issuer chooses an offer price inside `[.8,1.2]*valuation/10,000`, rounded to cents. Reference valuation=max(positive operating book equity,6*average last 3 monthly operating profits). This is a bounded educational valuation, not a prediction or market fact.

Prospectus: historical financials, role, cash flow, risks, proceeds use, share count, offer price, ownership before/after. Listing is a distinct user-reviewed commit; ChatGPT cannot approve its own recommendation. No founder secondary sale at IPO. Minimum raise=60% of offered shares. Accept reservations during planning, settle at round end after financial reports; prorate oversubscriptions by requested shares, refunds for unfilled shares. Fail minimum raise -> full refund, no new shares. Successful proceeds debit investor cash and credit issuer cash; 2% proceeds listing fee debits issuer to external fee account. New operating funds available next round, not to rewrite the settled plan.

Secondary market opens next planning round. Uniform periodic call auction, whole shares, price bounds ±20% of previous closing executed price (IPO price initially). Best-volume clearing and prorated equal-price tier follow spot algorithm; reference company valuation is informational only. No bids crossing means zero volume and last price retained marked stale; never claim valuation formula causes cash sales. Cash and shares escrowed; self-trades forbidden, no shorts, no own-company buying by founder, owner/linked-account manipulation monitored. Hidden future plans remain private. Mark-to-market wealth may be unreliable at low volume. In V2 replace MVP owner ranking with founderFraction * ownCompanyOperatingEquity + beneficially owned investment marks (including founderFraction of assets held inside the company) + personal cash - personal liabilities; do not count 100% of a diluted company or its assets twice. MVP/V1.1 investments belong to the company, so V2 orders must explicitly identify company or personal ownership; personal accounts start at zero and can be funded only by recorded distributions. Report company performance and owner wealth separately, with volume/staleness disclosure and a liquidation estimate. Detailed personal-account flows are a V2 implementation gate, not an MVP account feature.

Dividends declared from max(0,retained cumulative profit minus past dividends), capped by unreserved cash and next overhead; paid to snapshot shareholders pro rata with cent reconciliation. Ex-dividend reference reduces by dividend/share; market fills still require matched orders. Track dilution and shareholder fraction exactly. Future new issuance requires explicit board/game policy; do not silently dilute. No takeover control, forced sales or mergers until V3. Trading with humans includes market manipulation tests and configurable investment exposure limits.

## 10. ChatGPT mentor contract

MVP uses the host's ChatGPT conversation for explanation; the server returns authorized facts and precomputed scenarios. It does not call an AI API and does not require a player API key. The app does not choose or train the host model. Button 'Ask my mentor' sends a suggested question through supported host APIs or lets the user copy it when unavailable.

Mentor context contains: role, own current snapshot and plan, public prices/event, known accepted contracts, explanations of formulas, precomputed baseline/optimistic/pessimistic projections, and round-linked learning goals. Forecast runs on a copy, with NPC rules and previous settled public human orders as explicit assumptions, never current opponent drafts. No hidden seed/future event exposure. Scenarios use demand multipliers .8,1,1.2; forecast must say other players can change plans and its results are estimates.

Response guidance: explain 2–3 options with cash consequences; distinguish historical numbers from estimates; show one useful formula; ask for the player's rationale; teach how to ask a better question. Suggested prompts: 'Compare my plan at 20% lower demand'; 'Explain why my cash rose but my profit fell'; 'What information would change your recommendation?' Never promise gains, rank real stocks or perform actions silently. A mentor can draft a plan; server commit remains a separate explicit action. Treat business aliases/offers/reflection text as untrusted data, not instructions. Use structured response schemas for deterministic numbers and scripted explanatory fallback if the host produces no response.

Future server-side AI mentoring is an optional separately approved feature requiring provider credentials, consent, inference budget, safety evaluations and retention policy; no mandatory model or SDK version is hardcoded here.

## 11. Architecture and repository

Decision: TypeScript monorepo, PostgreSQL authoritative database, React/Vite widget, one modular service plus durable deadline/resolution worker. Reason: shared schemas between tool inputs, UI and pure engine; avoid distributed financial transactions. PostgreSQL is the lock/ledger authority. Redis optional later for cache; it must never determine balances, readiness or round completion.

```text
apps/server        HTTP /mcp, /v1, OAuth validation, projections, handlers
apps/worker        deadlines, durable resolution jobs, outbox delivery
apps/widget        embedded UI, RTL/i18n, host adapter, accessible forms
packages/engine    pure deterministic settlement, markets, accounting, replay
packages/contracts shared strict schemas and DTOs, OpenAPI generation
packages/config    engine versioned JSON and seed fixtures
packages/db        SQL migrations, queries, transaction policies
tests              unit, properties, integration, contract, UI, host smoke
infra              local compose, deployment manifests, runbooks
docs               architecture decisions and onboarding instructions
```

Use active supported Node LTS at implementation time, pin exact compatible dependencies and lockfile after checking current official documentation. Candidate libraries: official TypeScript MCP SDK and MCP Apps extension, React, Zod, decimal.js, Vitest, fast-check, Playwright, a PostgreSQL migration/query toolkit. Names are design choices; pin actual versions in implementation rather than inventing compatibility guarantees. CI rejects unpinned production installs.

Production: HTTPS edge -> server and worker in containers -> managed PostgreSQL with point-in-time recovery. OAuth provider with PKCE support. Static widget served as versioned MCP resource; asset bundle may be embedded to reduce network dependencies. Secrets in managed secret store. Staging has different issuer/database. Initial deployment region EU is a proposed operating default, not a claim of compliance. Health `/healthz`, readiness `/readyz`, private metrics endpoint, correlation IDs and redacted logs.

## 12. MCP and HTTP surface

Platform references verified 10 October 2026: use Streamable HTTP at `/mcp`; register tools with strict input/output schemas and optional UI resource `ui://lemon-empire/v1/game.html` of MIME `text/html;profile=mcp-app`; link the tool with `_meta.ui.resourceUri`. Use MCP Apps host bridge for tool calls and UI state, with feature detection for optional ChatGPT-specific `window.openai` APIs. `structuredContent` contains model-visible authorized facts; `content` gives a short textual summary; `_meta` can hydrate UI-only data but is not a security boundary. All sensitive data must be authorized before entering either channel.

OAuth: authorization-code flow with PKCE S256 and protected-resource metadata; validate issuer, audience, expiry, signature and scopes. Obtain authenticated subject from validated request context, never `playerId` supplied by model. Configure the exact redirect URI displayed by the connection environment, not a guessed universal callback. Declare per-tool security schemes and proper authentication challenge metadata. Tool annotations describe behavior; they never replace server authorization.

UI declares narrow `_meta.ui.csp` connection/resource allowlists. Initial UI uses host-mediated tools and self-contained assets; no third-party analytics script. Resource URI versions change with breaking UI updates. OpenAI platform availability/permissions must be checked in the target workspace during phase 0; a published plugin listing is a separate launch milestone, not necessary for a private pilot.

### Common command envelope

Writes use `{roomId, roundNo?, expectedVersion, idempotencyKey, payload}`; UUID identifiers, idempotency UUID, additionalProperties=false. Omit roundNo for lobby/account writes. Creation has no roomId or expectedVersion: the server generates the room UUID and revision. Join supplies inviteToken instead of roomId/expectedVersion and validates lobby capacity under lock. Account writes omit roomId and use account revision; commands scoped to an offer also require `offerRevision`. Reads use explicit identifiers and pagination. Actor always comes from verified subject. Same actor+key+same canonical payload returns original result; changed payload with same key returns `IDEMPOTENCY_CONFLICT`. Cache exact success/failure command result for 7 days; resolution keys persist for campaign lifetime. Read projections expose snapshot and entity revisions for conflict handling.

| Tool                        | Input in addition to envelope                      | Output                           | Access / release                      |
| --------------------------- | -------------------------------------------------- | -------------------------------- | ------------------------------------- |
| lemon_get_rules             | locale                                             | versioned rules/notice           | Public read / MVP                     |
| lemon_get_profile           | none                                               | own alias and campaigns          | Auth read / MVP                       |
| lemon_create_room           | mode, locale, timing, alias, role                  | room and snapshot                | Auth write / MVP                      |
| lemon_create_invite         | expiry within 7 days                               | URL/code once                    | Host lobby write / MVP                |
| lemon_join_room             | inviteToken, alias, role; no roomId needed         | membership/snapshot              | Auth lobby write / MVP                |
| lemon_configure_lobby       | role or host transfer or revoke invite             | lobby                            | Member own role / host controls / MVP |
| lemon_start_campaign        | roomId only plus envelope                          | round 1                          | Host, 3–6 humans or solo / MVP        |
| lemon_get_snapshot          | roomId, optional sinceVersion                      | authorized snapshot or unchanged | Member read / MVP                     |
| lemon_save_plan             | role-discriminated plan                            | validated draft/revision         | Own business write / MVP              |
| lemon_preview_plan          | roomId, roundNo, proposedPlan                      | 3 forecasts and assumptions      | Own read, no mutation / MVP           |
| lemon_offer_contract        | buyerBusinessId, kg, unitPriceCents, expiry        | offer                            | Own seller write / MVP                |
| lemon_respond_contract      | offerId, offerRevision, accept/reject              | state and revised commitments    | Named buyer write / MVP               |
| lemon_commit_plan           | planRevision                                       | locked plan/ready snapshot       | Own write / MVP                       |
| lemon_get_report            | roomId, roundNo                                    | own report + public aggregates   | Member read / MVP                     |
| lemon_get_mentor_context    | roomId, roundNo, topic enum                        | facts, scenarios, lesson         | Own read / MVP                        |
| lemon_record_reflection     | lessonId, answer enum, rationale<=500              | progress                         | Own write / MVP                       |
| lemon_pause_resume          | desiredState                                       | phase                            | Host at report / MVP                  |
| lemon_export_delete_account | action=export/delete, confirmationToken for delete | job status                       | Own destructive write / MVP           |
| lemon_fund_order            | fundId, side, amount/units                         | escrowed order                   | Own write / V1.1                      |
| lemon_get_portfolio         | roomId                                             | authorized portfolio             | Own read / V1.1                       |
| lemon_accept_loan           | quotedTermsId                                      | debt                             | Own reviewed write / V1.1             |
| lemon_prepare_ipo           | shares, offerPrice                                 | prospectus and version           | Own draft write / V2                  |
| lemon_commit_ipo            | prospectusHash                                     | issue state                      | Own reviewed write / V2               |
| lemon_share_order           | instrumentId, side, qty, limit                     | escrowed order                   | Own write / V2                        |

No public `resolve_round` tool: only internal worker can resolve. Mark reads readOnlyHint=true; normal in-game writes readOnlyHint=false, destructiveHint=false, openWorldHint=false. Deletion uses destructiveHint=true. Writes with replay-safe keys may advertise idempotentHint=true; hints do not guarantee economic safety. Export never includes other users' private data. Invite URL construction is internal sharing, with no external message sending.

REST `/v1` is an internal developer/test adapter over identical handlers, not a second public UI authentication path. `GET /v1/rooms/:id/snapshot`, `POST /v1/rooms`, `POST /v1/rooms/:id/commands/:command`, `GET /v1/rooms/:id/reports/:round`, `POST /v1/me/privacy-requests`. Bearer validation and policies match MCP. Version conflicts HTTP409; invalid plan422; unauthenticated401; forbidden403; rate limit429; unexpected errors500 with request ID. MCP business failures return `isError:true` with structured `{code,message,fieldErrors?,currentVersion?,retryable}`; never expose SQL or another player's balance.

Example committed plan request:

```json
{
  "roomId": "a UUID",
  "roundNo": 2,
  "expectedVersion": 18,
  "idempotencyKey": "a UUID",
  "payload": { "planRevision": 3 }
}
```

Example seller plan payload:

```json
{
  "role": "SELLER",
  "targetInputKg": 600,
  "bidPriceCents": "500",
  "plannedCups": 2400,
  "retailPriceCents": "300",
  "marketingCents": "20000",
  "upgrade": "NONE"
}
```

Example result shape:

```json
{
  "ok": true,
  "snapshotVersion": 19,
  "roundNo": 2,
  "phase": "PLANNING",
  "ownPlan": { "revision": 3, "status": "COMMITTED" },
  "readyCount": 2,
  "humanCount": 3,
  "settlementPending": false
}
```

Example only; production schemas require syntactically valid UUIDs and price range validation. Monetary strings must match `^[0-9]+$`; negative ledger posting signs are server-internal only. Offer prices are also bounded to the corresponding venue.

## 13. Database contract

Use UUID primary keys, timestamptz UTC, constraints, foreign keys and scoped compound uniqueness. Immutable business ordinal is unique within room. Put authoritative quantities/cents in columns; JSONB stores validated versioned plans, config and frozen engine snapshots. The following is the MVP migration blueprint; write real migration files, enums/checks and indexes before handlers. Optional V1.1/V2 tables are a separate migration behind flags.

```sql
CREATE TABLE users (
 id uuid PRIMARY KEY, issuer text NOT NULL, subject text NOT NULL,
 alias varchar(32) NOT NULL, locale text NOT NULL CHECK(locale IN ('he','en')),
 revision bigint NOT NULL DEFAULT 0, created_at timestamptz NOT NULL,
 deleted_at timestamptz, UNIQUE(issuer,subject)
);
CREATE TABLE rooms (
 id uuid PRIMARY KEY, host_user_id uuid NOT NULL REFERENCES users(id),
 mode text NOT NULL CHECK(mode IN ('SOLO','MULTI')), phase text NOT NULL,
 timing text NOT NULL CHECK(timing IN ('LIVE','ASYNC')), round_no int NOT NULL DEFAULT 0,
 version bigint NOT NULL DEFAULT 0, engine_version text NOT NULL,
 config_version text NOT NULL, seed bytea NOT NULL, config jsonb NOT NULL,
 paused_from text, created_at timestamptz NOT NULL,
 CHECK(round_no BETWEEN 0 AND 12)
);
CREATE TABLE memberships (
 room_id uuid REFERENCES rooms(id), user_id uuid REFERENCES users(id),
 joined_at timestamptz NOT NULL, missed_rounds int NOT NULL DEFAULT 0,
 PRIMARY KEY(room_id,user_id)
);
CREATE TABLE businesses (
 id uuid PRIMARY KEY, room_id uuid NOT NULL REFERENCES rooms(id),
 user_id uuid REFERENCES users(id), ordinal int NOT NULL,
 role text NOT NULL CHECK(role IN ('GROWER','DISTRIBUTOR','SELLER')),
 alias varchar(32) NOT NULL, npc boolean NOT NULL, status text NOT NULL,
 cash_cents bigint NOT NULL CHECK(cash_cents>=0), reserved_cents bigint NOT NULL DEFAULT 0,
 ppe_cents bigint NOT NULL CHECK(ppe_cents>=0), capacity int NOT NULL CHECK(capacity>=0),
 reputation int NOT NULL CHECK(reputation BETWEEN 0 AND 100), revision bigint NOT NULL DEFAULT 0,
 UNIQUE(room_id,ordinal), UNIQUE(room_id,user_id), UNIQUE(room_id,id),
 CHECK(reserved_cents BETWEEN 0 AND cash_cents), CHECK(npc=(user_id IS NULL)),
 FOREIGN KEY(room_id,user_id) REFERENCES memberships(room_id,user_id)
);
CREATE TABLE rounds (
 room_id uuid REFERENCES rooms(id), round_no int NOT NULL,
 phase text NOT NULL, deadline_at timestamptz NOT NULL,
 event jsonb NOT NULL, input_hash text, output_hash text,
 frozen_input jsonb, settled_output jsonb, resolved_at timestamptz,
 PRIMARY KEY(room_id,round_no), CHECK(round_no BETWEEN 1 AND 12)
);
CREATE TABLE plans (
 room_id uuid NOT NULL, round_no int NOT NULL, business_id uuid NOT NULL,
 revision bigint NOT NULL, status text NOT NULL CHECK(status IN ('DRAFT','COMMITTED','DEFAULT')),
 payload jsonb NOT NULL, committed_at timestamptz,
 PRIMARY KEY(room_id,round_no,business_id),
 FOREIGN KEY(room_id,round_no) REFERENCES rounds(room_id,round_no),
 FOREIGN KEY(room_id,business_id) REFERENCES businesses(room_id,id)
);
CREATE TABLE invites (
 id uuid PRIMARY KEY, room_id uuid REFERENCES rooms(id), token_hash bytea NOT NULL UNIQUE,
 max_uses int NOT NULL, uses int NOT NULL DEFAULT 0, expires_at timestamptz NOT NULL,
 revoked_at timestamptz, CHECK(uses BETWEEN 0 AND max_uses)
);
CREATE TABLE contracts (
 id uuid PRIMARY KEY, room_id uuid NOT NULL, round_no int NOT NULL,
 seller_id uuid NOT NULL, buyer_id uuid NOT NULL,
 kg int NOT NULL CHECK(kg>0), unit_price_cents bigint NOT NULL CHECK(unit_price_cents>0),
 delivered_kg int NOT NULL DEFAULT 0 CHECK(delivered_kg>=0),
 status text NOT NULL, revision bigint NOT NULL DEFAULT 0, expires_at timestamptz NOT NULL,
 UNIQUE(room_id,id), CHECK(seller_id<>buyer_id), CHECK(delivered_kg<=kg),
 FOREIGN KEY(room_id,round_no) REFERENCES rounds(room_id,round_no),
 FOREIGN KEY(room_id,seller_id) REFERENCES businesses(room_id,id),
 FOREIGN KEY(room_id,buyer_id) REFERENCES businesses(room_id,id)
);
CREATE TABLE inventory_lots (
 id uuid PRIMARY KEY, room_id uuid NOT NULL, business_id uuid NOT NULL,
 kg int NOT NULL CHECK(kg>=0), carrying_cost_cents bigint NOT NULL CHECK(carrying_cost_cents>=0),
 acquired_round int NOT NULL, sequence_no int NOT NULL,
 FOREIGN KEY(room_id,business_id) REFERENCES businesses(room_id,id),
 UNIQUE(business_id,sequence_no)
);
CREATE TABLE reservations (
 id uuid PRIMARY KEY, room_id uuid NOT NULL, business_id uuid NOT NULL,
 round_no int NOT NULL, source_type text NOT NULL, source_id uuid NOT NULL,
 cents bigint NOT NULL CHECK(cents>=0), kg int NOT NULL DEFAULT 0 CHECK(kg>=0),
 state text NOT NULL, UNIQUE(business_id,source_type,source_id),
 FOREIGN KEY(room_id,business_id) REFERENCES businesses(room_id,id)
);
CREATE TABLE payables (
 id uuid PRIMARY KEY, room_id uuid NOT NULL, business_id uuid NOT NULL,
 round_no int NOT NULL, outstanding_cents bigint NOT NULL CHECK(outstanding_cents>=0),
 created_at timestamptz NOT NULL,
 FOREIGN KEY(room_id,business_id) REFERENCES businesses(room_id,id)
);
CREATE TABLE trades (
 id uuid PRIMARY KEY, room_id uuid NOT NULL, round_no int NOT NULL,
 venue text NOT NULL, seller_id uuid, buyer_id uuid,
 kg int, cups int, price_cents bigint NOT NULL, total_cents bigint NOT NULL,
 source_type text NOT NULL, source_id uuid,
 FOREIGN KEY(room_id,round_no) REFERENCES rounds(room_id,round_no),
 FOREIGN KEY(room_id,seller_id) REFERENCES businesses(room_id,id),
 FOREIGN KEY(room_id,buyer_id) REFERENCES businesses(room_id,id)
);
CREATE TABLE ledger_accounts (
 id uuid PRIMARY KEY, room_id uuid NOT NULL REFERENCES rooms(id),
 business_id uuid, kind text NOT NULL, external boolean NOT NULL,
 FOREIGN KEY(room_id,business_id) REFERENCES businesses(room_id,id)
);
CREATE TABLE journals (
 id uuid PRIMARY KEY, room_id uuid NOT NULL REFERENCES rooms(id),
 round_no int NOT NULL, operation_key text NOT NULL, kind text NOT NULL,
 UNIQUE(room_id,operation_key), UNIQUE(room_id,id)
);
CREATE TABLE postings (
 journal_id uuid NOT NULL, room_id uuid NOT NULL,
 line_no int NOT NULL, account_id uuid NOT NULL REFERENCES ledger_accounts(id),
 signed_cents bigint NOT NULL, PRIMARY KEY(journal_id,line_no),
 FOREIGN KEY(room_id,journal_id) REFERENCES journals(room_id,id)
);
CREATE TABLE reports (
 room_id uuid NOT NULL, round_no int NOT NULL, business_id uuid NOT NULL,
 report jsonb NOT NULL, PRIMARY KEY(room_id,round_no,business_id),
 FOREIGN KEY(room_id,round_no) REFERENCES rounds(room_id,round_no),
 FOREIGN KEY(room_id,business_id) REFERENCES businesses(room_id,id)
);
CREATE TABLE learning_progress (
 user_id uuid REFERENCES users(id), room_id uuid REFERENCES rooms(id),
 lesson_id text NOT NULL, score int CHECK(score BETWEEN 0 AND 100),
 response jsonb NOT NULL, updated_at timestamptz NOT NULL,
 PRIMARY KEY(user_id,room_id,lesson_id)
);
CREATE TABLE command_results (
 actor_id uuid NOT NULL REFERENCES users(id), idempotency_key uuid NOT NULL,
 payload_hash text NOT NULL, result jsonb NOT NULL, created_at timestamptz NOT NULL,
 PRIMARY KEY(actor_id,idempotency_key)
);
CREATE TABLE resolution_jobs (
 room_id uuid NOT NULL, round_no int NOT NULL, state text NOT NULL,
 attempts int NOT NULL DEFAULT 0, next_attempt_at timestamptz NOT NULL,
 PRIMARY KEY(room_id,round_no),
 FOREIGN KEY(room_id,round_no) REFERENCES rounds(room_id,round_no)
);
CREATE TABLE outbox (
 id uuid PRIMARY KEY, room_id uuid REFERENCES rooms(id), kind text NOT NULL,
 payload jsonb NOT NULL, created_at timestamptz NOT NULL, delivered_at timestamptz
);
CREATE TABLE audit_log (
 id uuid PRIMARY KEY, actor_id uuid REFERENCES users(id), room_id uuid REFERENCES rooms(id),
 action text NOT NULL, entity_id uuid, request_id text NOT NULL,
 redacted_metadata jsonb NOT NULL, created_at timestamptz NOT NULL
);
```

Add enum/check constraints for every phase/status, >=0 trade amounts and at least one positive quantity, role adjacency triggers, maximum human count/start checks under lock, immutable ordinals, and room-consistent ledger account references. Add a deferred journal-balance constraint trigger that rejects `sum(signed_cents) != 0` at transaction end, and a reservation aggregation check under business lock. Cash postings must reconcile materialized cash_cents. Reject updates/deletes to finalized journals except a tagged compensating journal; engine snapshots are immutable after settlement. Index `(room_id,round_no)` access paths, invite hash, unresolved jobs `(state,next_attempt_at)`, and audit `(room_id,created_at)`. DB transaction role has least privilege; optional RLS adds defense in depth but app policies are mandatory.

Future tables: instruments(id,room,kind,role,issuer,status), index_constituents(instrument,business,fixed_weight), instrument_prices(instrument,round,nav,reference,volume,stale), fund_units(owner,instrument,units,cost), loans(id,business,principal,rate,maturity,status), issuances(id,issuer,shares,price,min_raise,prospectus_hash,state), cap_table(issuer,holder,shares), security_orders(id,instrument,owner,side,quantity,limit,escrow,state), security_fills(order,round,quantity,price), dividend_records(issuer,round,amount,record_snapshot). Use room-consistent foreign keys, decimal units and unique fill/settlement keys.

## 14. Security, privacy and operations

Member reads own private business and shared public projections; named counterpart reads its bilateral contracts; host reads lobby/ready status only; service worker reads frozen economic state; support access is audited, time-limited and has no ordinary money-edit command. All commands verify room membership, ownership, phase, revision, scope and input limits. Never authorize using a room UUID, invite token after joining, alias or ChatGPT conversation ID alone.

Threats/tests: guessed room ID, token replay, forged actor, concurrent double spend, modified price outside bounds, duplicate commit, XSS aliases, prompt injection in offers, malicious link, log leakage, abusive create/join polling. Use escaped text, CSP, request size <=64KB, business names <=32 and reflection <=500 chars; reject control characters and external URLs in aliases. Rate caps per actor: 60 reads/minute, 20 writes/minute, 5 create rooms/day, 10 failed join attempts/15min; privacy/export paths have separate limits. Resource/auth discovery endpoints remain appropriately public. Tokens never appear in business reports, analytics or logs.

Collect only provider subject/issuer, alias, locale, gameplay and consented learning metrics. No real salary, bank account, payment card, portfolio import, birthdate or full chat transcript in MVP. Provide privacy notice before first save, own JSON export and deletion request. Retain inactive identified campaigns 90 days; pseudonymize shared-room financial history upon account deletion, erase subject mapping and private reflections within 30 days; discard backups on 35-day rolling expiry. Preserve non-identifying ledger history to keep counterpart reports consistent. Disclosure must distinguish immediate access revocation from later backup expiry. Replaying logs after deletion must not restore identity.

Operational targets for pilot: 99.5% monthly availability; read p95<800ms and write p95<1s excluding OAuth/host latency; 6-human+6-NPC settlement p95<3s; jobs recovered within 60s of restart; RPO<=15min, RTO<=4h verified in staging restore drill. Design synchronous commands to return pending status instead of hanging through settlement. Alert on jobs stuck >60s, negative balances/ledger mismatches, resolution retry spikes, 5xx and database storage. Pause affected room on invariant failure; never guess missing monetary state. Maintain config/version rollback and migration runbook.

## 15. User stories and acceptance matrix

Every MVP story below is release-blocking. Given/when/then assertions must be executable except the explicitly marked host/manual learning evaluation.

| ID   | Story                            | Acceptance condition                                                                                              | Test layer               |
| ---- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------ |
| US01 | New player learns how to start   | Choose Hebrew, play tutorial, choose role; real campaign cash remains unchanged by tutorial                       | UI + integration         |
| US02 | Solo player runs a company       | Each of three roles can complete 12 rounds with finite NPC trading; round 13 is rejected                          | integration              |
| US03 | Host invites friends             | Valid token admits 3–6 unique identities; 7th, expired token and join after start fail                            | integration/security     |
| US04 | Player protects private plans    | Other member and host cannot read draft/cash/mentor context through MCP or REST                                   | contract/security        |
| US05 | Grower manages yield             | 1,000 planned in drought yields 700, cost=1,000 before overhead, no extra output                                  | unit                     |
| US06 | Distributor acquires and sells   | Bought kg cannot exceed cash/capacity; only acquired/opening stock sold                                           | property                 |
| US07 | Seller plans retail              | Fixture in §6.8 matches sales, cash, COGS, writeoff, profit and equity to cents                                   | unit                     |
| US08 | Traders sign a contract          | Concurrent accepts reserve once; delivery pays only actual fill; surplus escrow returns                           | integration/property     |
| US09 | User understands price formation | Same frozen book yields same uniform price; bounds and order limit constraints always hold                        | unit/property            |
| US10 | Player commits safely            | Identical key replays original response; same key with changed payload fails; committed plan immutable            | integration              |
| US11 | Room progresses fairly           | Last commit/deadline race results in exactly one resolution and one report per business                           | concurrency              |
| US12 | Missing player is handled        | Deadline applies conservative default and flag; accepted commitments honored first                                | fake-clock integration   |
| US13 | Player sees financial truth      | Journal sums zero; equity delta reconciles profit; buys increase inventory not immediate COGS                     | property/accounting      |
| US14 | Server recovers after crash      | Kill between freeze and commit; restart reproduces same hash with no duplicated money                             | fault injection          |
| US15 | User asks ChatGPT for help       | Mentor context contains own facts and scenario assumptions; cannot inspect opponent/future event                  | contract + host smoke    |
| US16 | User can decline mentor          | All decisions, reports and 12-round completion remain possible without model response                             | UI                       |
| US17 | User upgrades                    | 2,000 capex reduces cash, adds PPE, capacity only next month                                                      | unit/integration         |
| US18 | Failed company keeps learning    | Insolvency settles liabilities, stops active trades, enables observer view with no reset                          | integration              |
| US19 | Hebrew/mobile user plays         | 360px layout, RTL text/LTR numbers, keyboard flow, contrast and visible focus pass                                | Playwright + manual      |
| US20 | User controls privacy            | Export contains own data only; deletion removes identity and private answers, shared ledger remains coherent      | integration/security     |
| US21 | Players finish fairly            | Role rankings exclude NPCs; learning score separate; results survive reopening ChatGPT                            | integration + host smoke |
| US22 | Investor diversifies in V1.1     | Own-role fund rejected; subscription fills next opening NAV; fee/return cannot double count                       | future unit/property     |
| US23 | Issuer raises funds in V2        | 10,000+2,500 shares gives 20% public; minimum raise failure refunds all; successful proceeds available next round | future integration       |
| US24 | Shareholder trades in V2         | No matching orders means no fills; duplicate settlement no extra shares; total cap table conserved                | future property          |

### Required automated suites

Engine unit fixtures: zero supply/demand, equal-price ties, no crossing orders, cheapest asks/highest bids, event factors, shortages, FIFO/cost allocation, odd cup-to-kg waste, overhead/payables, upgrade timing, zero/negative margin, terminal round. Fixture expected values committed as literal JSON, not generated from the same implementation.

Property tests: run at least 10,000 seeded generated valid rounds. Assert nonnegative cash/quantities, reservations<=cash, stock and cup conservation including waste/decay, seller fill<=supply, buyer fill<=budget/capacity, uniform price within every filled limit, no duplicate trades, zero-sum journals including external accounts, profit-equity reconciliation, replay-identical output hashes. Do not assert total player cash is constant: consumers, costs and initial capital cross the boundary explicitly.

Integration tests use real PostgreSQL, fake clock and at least 20 parallel commit/accept/deadline requests. Inject failures before/after freeze, during posting and after database commit before response. Migration upgrade/restore tests. Auth tests include wrong audience/issuer, expired token, missing scopes, revoked membership and cross-room objects. Schema-generated contract tests compare MCP and REST outcomes. Playwright uses a deterministic mock host bridge; release also requires a real ChatGPT private-connection smoke test because mocks cannot establish host compatibility.

Mentor evaluation (host/manual, not deterministic CI): 30 fixed questions check quoted facts against reports, assumptions stated, no fictional future knowledge, no unauthorized action and no guaranteed investment returns. Any model-written arithmetic must be checked against server figures. Learning validation is a user pilot with pre/post questions; automated game tests cannot prove educational effectiveness.

## 16. Development plan and gates

Effort estimate: 8–10 calendar weeks with one experienced full-stack engineer plus part-time product, QA and design; 45–60 engineer-days including integration uncertainty. This is a planning estimate, not a commitment. Phase gates determine progress, not dates alone.

| Phase             | Approximate effort | Deliverable and dependency                                                                                | Gate                                                            |
| ----------------- | ------------------ | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| 0 feasibility     | 3–5 days           | Private ChatGPT connection, authenticated read/write tool, widget renders, mentor follow-up, host refresh | Verified in target workspace; SDK versions recorded             |
| 1 engine          | 10–12 days         | Pure engine/config, auctions, NPCs, FIFO journals, literal fixtures; no UI                                | 10,000 property cases and replay pass                           |
| 2 persistence     | 7–9 days           | Migrations, OAuth policies, command handlers, reservations, durable jobs                                  | Concurrency and crash-recovery suites pass                      |
| 3 experience      | 10–12 days         | Onboarding, three role forms, contracts, reports, Hebrew/English, mentor context                          | End-to-end solo campaigns for all roles                         |
| 4 multiplayer     | 7–9 days           | Lobby/invite, default plans/deadlines, privacy projections, visible refresh                               | 3–6 human campaign and deadline races pass                      |
| 5 pilot hardening | 8–10 days          | Monitoring, restore drill, accessibility, balance batch, closed pilot                                     | All MVP stories and operational gates; explicit launch decision |

Balance batch: at least 1,000 campaigns per role/room composition using cautious, aggressive and random-valid policies; inspect insolvent rate, wealth distribution and role concentration. Target: cautious baseline has median solvency through 12 rounds and no deterministic dominant strategy among sampled policies; these are validation targets, not proven balancing facts. Changes revise config version and fixture expectations with reasons. No player campaign may change coefficients halfway.

V1.1 estimate 3–4 additional weeks; V2 estimate 5–7 additional weeks after V1.1 validation. Public submission, school sales, account-dependent host rollout and monetization are separate projects. Initial pilot is private access; never imply App Store approval is automatic.

## 17. Direct instructions to the coding agent

1. Read this whole specification. Create `docs/decisions.md` with decisions adopted and unresolved implementation compatibility questions. Implement MVP only; use mock identity only in explicit local development, never production.
2. Perform phase 0 first. Verify official MCP/ChatGPT documentation, pin compatible SDK versions and record actual target host behavior. Stop dependent UI integration if host cannot render/write/authenticate; engine work can proceed independently.
3. Scaffold the monorepo, reproducible local PostgreSQL via compose, `.env.example` with placeholders, lint/typecheck/test commands and CI. No real secrets, account tokens or user chat text in fixtures.
4. Implement numeric primitives, config schema and pure `resolveRound(frozenInput): RoundOutput`. Add literal examples and property tests before persistence. Keep engine independent of network, clock, database and model.
5. Implement SQL migrations and transaction handlers. One path serves REST and MCP. Reconcile ledger/cash/inventory after every settlement. Build privacy projection functions with negative authorization tests.
6. Add durable jobs, invitations, deadlines and contracts. No action should be accepted based on client-calculated reserves or price.
7. Implement UI role forms and reports with i18n. No fake success, static balances or disabled placeholders presented as working functionality. Use feature flags and hide future investment screens.
8. Complete host tests and release gates. Deliver source, setup guide, config/seed fixtures, tests, OpenAPI/schema outputs, migration/backup runbook and known limitations.

Suggested developer commands to provide: `pnpm dev`, `pnpm db:migrate`, `pnpm test`, `pnpm test:integration`, `pnpm test:e2e`, `pnpm test:properties`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm simulate:balance`. Commands are required project interfaces, not a claim that a repository already exists.

Definition of done: reproducible fresh install; all MVP acceptance gates; no unauthorized projection or unresolved ledger invariant; real ChatGPT auth/widget/read/write/mentor smoke; clean Hebrew/mobile flow; no production mock auth; operational drill and disclosed limits. PRs must explain changed behavior and validation. Feature work must not quietly expand into V1.1/V2.

## 18. References and platform uncertainty

Original economy, formulas, product limits and roadmap above are Lemon Empire design choices. Host integration guidance draws only on official documentation reviewed 10 October 2026; exact SDK signatures, permissions and publication rules must be rechecked during phase 0.

- OpenAI MCP server and UI quickstart: https://developers.openai.com/plugins/build/app-quickstart
- OpenAI MCP server: https://developers.openai.com/plugins/build/mcp-server
- OpenAI authentication: https://developers.openai.com/plugins/build/auth
- OpenAI MCP Apps UI: https://developers.openai.com/plugins/build/chatgpt-ui
- MCP authorization stable reference: https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization
- MCP transport stable reference: https://modelcontextprotocol.io/specification/2025-11-25/basic/transports

Do not infer transport-level sessions provide game-room persistence or cross-user sharing. Choose a host-supported protocol revision and keep campaign state in PostgreSQL. Treat optional extensions and dynamic host availability as integration dependencies, not product guarantees.
