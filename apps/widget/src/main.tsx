import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { callTool, connectHost, setIdentity, askMentor } from "./host.ts";
import type { Plan } from "../../../packages/contracts/index.ts";
import "./style.css";
import {
  BusinessPlayground,
  CashWidget,
  SeasonTrail,
} from "./play-widgets.tsx";
const words = {
  en: {
    home: "Your lemon business starts here",
    subtitle:
      "Build a business. Understand the numbers. Learn with your mentor.",
    new: "New campaign",
    join: "Join a room",
    role: "Your role",
    alias: "Business name",
    solo: "Solo",
    multi: "Multiplayer",
    start: "Start campaign",
    refresh: "Refresh",
    cash: "Cash",
    equity: "Business equity",
    inventory: "Lemons in stock",
    round: "Month",
    plan: "Your decision",
    save: "Save draft",
    commit: "Commit & lock decision",
    preview: "Preview outcomes",
    mentor: "Ask my mentor",
    next: "Start next month",
    report: "Monthly report",
    invite: "Create invite",
    back: "All campaigns",
    notice: "Educational simulation · fictional LE currency",
    grower: "Lemon grower",
    distributor: "Distributor",
    seller: "Lemonade seller",
    loading: "Connecting…",
    rules: "How to play",
    contracts: "Supply contracts",
    ready: "Ready",
    wait: "Waiting for settlement",
    reflection: "What drove your result?",
    pause: "Pause campaign",
    resume: "Resume campaign",
  },
  he: {
    home: "עסק הלימונים שלך מתחיל כאן",
    subtitle: "לבנות עסק. להבין את המספרים. ללמוד עם המנטור.",
    new: "משחק חדש",
    join: "הצטרפות לחדר",
    role: "התפקיד שלך",
    alias: "שם העסק",
    solo: "יחיד",
    multi: "רב משתתפים",
    start: "התחלת משחק",
    refresh: "רענון",
    cash: "מזומן",
    equity: "הון העסק",
    inventory: "לימונים במלאי",
    round: "חודש",
    plan: "ההחלטה שלך",
    save: "שמירת טיוטה",
    commit: "אישור ונעילת ההחלטה",
    preview: "תצוגת תרחישים",
    mentor: "לשאול את המנטור",
    next: "התחלת החודש הבא",
    report: "דוח חודשי",
    invite: "יצירת הזמנה",
    back: "כל המשחקים",
    notice: "סימולציה לימודית · מטבע LE בדיוני",
    grower: "מגדל לימונים",
    distributor: "משווק",
    seller: "מוכר לימונדה",
    loading: "מתחברים…",
    rules: "איך משחקים",
    contracts: "חוזי אספקה",
    ready: "מוכן",
    wait: "ממתינים לתוצאות",
    reflection: "מה השפיע על התוצאה?",
    pause: "השהיית המשחק",
    resume: "חזרה למשחק",
  },
};
const money = (value: string) =>
  new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(
    Number(value) / 100,
  ) + " LE";
function App() {
  const [locale, setLocale] = useState<"en" | "he">("en"),
    w = words[locale];
  const [connection, setConnection] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [snapshot, setSnapshot] = useState<any>(null),
    [campaigns, setCampaigns] = useState<any[]>([]),
    [plan, setPlan] = useState<any>(null),
    [scenarios, setScenarios] = useState<any>(null),
    [invite, setInvite] = useState(""),
    [mentor, setMentor] = useState<any>(null),
    [tutorial, setTutorial] = useState(false),
    [identity, setIdentityState] = useState("player");
  const [role, setRole] = useState("SELLER"),
    [alias, setAlias] = useState("Sunny Lemon"),
    [mode, setMode] = useState("SOLO"),
    [timing, setTiming] = useState("LIVE"),
    [joinCode, setJoinCode] = useState("");
  const [buyer, setBuyer] = useState(""),
    [contractKg, setContractKg] = useState(100),
    [contractPrice, setContractPrice] = useState(3),
    [rationale, setRationale] = useState(""),
    [answer, setAnswer] = useState("DEMAND");
  const poll = useRef(false),
    snapshotRef = useRef<any>(null);
  snapshotRef.current = snapshot;
  const accept = (data: any) => {
    if (data?.roomId && data?.ownBusiness) setSnapshot(data);
    else if (data?.snapshot?.roomId) setSnapshot(data.snapshot);
  };
  const run = async (fn: () => Promise<any>) => {
    setBusy(true);
    setError("");
    try {
      return await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const profile = async () => {
    const p = await callTool("lemon_get_profile", {});
    if (!Array.isArray(p.campaigns))
      throw new Error("Invalid profile response; reconnect and refresh.");
    setCampaigns(p.campaigns);
  };
  useEffect(() => {
    void connectHost(accept)
      .then(async (c) => {
        setConnection(c);
        await profile();
      })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    if (snapshot?.ownBusiness) {
      setPlan(snapshot.ownBusiness.plan);
      setScenarios(null);
    }
  }, [snapshot?.roomId, snapshot?.ownBusiness?.planRevision]);
  useEffect(() => {
    const timer = setInterval(async () => {
      const s = snapshotRef.current;
      if (
        document.hidden ||
        poll.current ||
        !s ||
        !["PLANNING", "LOCKED"].includes(s.phase)
      )
        return;
      poll.current = true;
      try {
        accept(await callTool("lemon_get_snapshot", { roomId: s.roomId }));
      } catch {
        /* Manual refresh remains available when background calls are denied. */
      } finally {
        poll.current = false;
      }
    }, 10000);
    return () => clearInterval(timer);
  }, []);
  const command = async (
    name: string,
    payload: any = {},
    round = false,
    current = snapshot,
  ) => {
    const result = await callTool(name, {
      roomId: current.roomId,
      expectedVersion: current.snapshotVersion,
      idempotencyKey: crypto.randomUUID(),
      ...(round ? { roundNo: current.roundNo } : {}),
      payload,
    });
    accept(result);
    return result;
  };
  const refresh = () =>
    run(async () =>
      accept(await callTool("lemon_get_snapshot", { roomId: snapshot.roomId })),
    );
  const input = (
    label: string,
    key: string,
    max: number,
    price = false,
    min = 0,
  ) => (
    <div className="field decision-control">
      <label htmlFor={`decision-${key}`}>{label}</label>
      <input
        id={`decision-${key}`}
        type="number"
        min={min}
        max={max}
        step={price ? ".01" : "1"}
        value={price ? Number(plan[key]) / 100 : plan[key]}
        onChange={(e) =>
          setPlan({
            ...plan,
            [key]: price
              ? String(Math.round(Number(e.target.value) * 100))
              : Number(e.target.value),
          })
        }
        required
      />
      <input
        type="range"
        aria-label={`${label} slider`}
        min={min}
        max={max}
        step={price ? ".01" : "1"}
        value={price ? Number(plan[key]) / 100 : plan[key]}
        onChange={(e) =>
          setPlan({
            ...plan,
            [key]: price
              ? String(Math.round(Number(e.target.value) * 100))
              : Number(e.target.value),
          })
        }
      />
      <div className="range-endpoints" aria-hidden="true">
        <span>{min}</span>
        <span>{max.toLocaleString()}</span>
      </div>
    </div>
  );
  const own = snapshot?.ownBusiness;
  const disabled = busy || own?.committed || own?.status === "INSOLVENT";
  return (
    <main dir={locale === "he" ? "rtl" : "ltr"}>
      <header>
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setSnapshot(null);
            void run(profile);
          }}
          className="brand"
        >
          <span className="lemon">◒</span>
          <span>
            LEMON <b>EMPIRE</b>
            <small>{w.notice}</small>
          </span>
        </a>
        <select
          aria-label="Language"
          value={locale}
          onChange={(e) => setLocale(e.target.value as "en" | "he")}
        >
          <option value="en">English</option>
          <option value="he">עברית</option>
        </select>
      </header>
      {connection === "development" && (
        <aside className="dev">
          Local development{" "}
          <label>
            Player identity{" "}
            <input
              value={identity}
              onChange={(e) => {
                setIdentityState(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ""));
              }}
            />
          </label>
          <button
            onClick={() =>
              run(async () => {
                setIdentity(identity);
                setSnapshot(null);
                await profile();
              })
            }
          >
            Switch player
          </button>
        </aside>
      )}
      {error && (
        <div role="alert" className="error">
          {error} {snapshot && <button onClick={refresh}>{w.refresh}</button>}
        </div>
      )}
      {snapshot?.phase === "PLANNING" &&
        own?.missedRounds >= 3 &&
        own.status !== "INSOLVENT" && (
          <section className="card">
            <p>Conservative decisions are active after three missed months.</p>
            <button
              disabled={busy}
              onClick={() =>
                run(() => command("lemon_reclaim_control", {}, true))
              }
            >
              Reclaim control for this month
            </button>
          </section>
        )}
      {!connection && !error && <p>{w.loading}</p>}
      {!snapshot ? (
        <>
          <section className="hero">
            <span className="eyebrow">GROW · TRADE · LEARN</span>
            <h1>{w.home}</h1>
            <p>{w.subtitle}</p>
            <button
              className="secondary"
              onClick={() => setTutorial(!tutorial)}
            >
              {w.rules}
            </button>
          </section>
          {tutorial && (
            <section className="card tutorial">
              <h2>{w.rules}</h2>
              <p>
                Growers harvest lemons. Distributors buy and resell them.
                Sellers turn 1 kg into 4 cups. All three businesses share one
                market.
              </p>
              <p>
                Each of 12 months has a public event. Set a plan, compare
                estimates, then commit. A commitment is final. Your room settles
                after everyone commits or the deadline passes.
              </p>
              <p>
                Example: selling 2,083 cups at 3 LE earns 6,249 LE revenue.
                Producing 4,000 cups costs 7,000 LE in ingredients and
                conversion. With 500 LE overhead and 100 LE depreciation, profit
                is −1,351 LE. Cash and profit are different.
              </p>
              <p>
                Start with 10,000 LE cash and 5,000 LE equipment. Forecasts are
                estimates. Judge success by business equity within your role.
                Mentoring is optional.
              </p>
            </section>
          )}
          <div className="grid">
            <form
              className="card"
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () =>
                  accept(
                    await callTool("lemon_create_room", {
                      idempotencyKey: crypto.randomUUID(),
                      payload: { mode, locale, timing, alias, role },
                    }),
                  ),
                );
              }}
            >
              <h2>{w.new}</h2>
              <label className="field">
                {w.alias}
                <input
                  value={alias}
                  maxLength={32}
                  required
                  onChange={(e) => setAlias(e.target.value)}
                />
              </label>
              <label className="field">
                {w.role}
                <select value={role} onChange={(e) => setRole(e.target.value)}>
                  <option value="GROWER">{w.grower}</option>
                  <option value="DISTRIBUTOR">{w.distributor}</option>
                  <option value="SELLER">{w.seller}</option>
                </select>
              </label>
              <p className="hint">
                {role === "GROWER"
                  ? "Manage harvest, production costs and weather risk."
                  : role === "DISTRIBUTOR"
                    ? "Balance procurement prices, resale margin and inventory."
                    : "Balance cup production, pricing, marketing and demand."}
              </p>
              <div className="row">
                <label className="field">
                  Mode
                  <select
                    value={mode}
                    onChange={(e) => setMode(e.target.value)}
                  >
                    <option value="SOLO">{w.solo}</option>
                    <option value="MULTIPLAYER">{w.multi}</option>
                  </select>
                </label>
                <label className="field">
                  Planning window
                  <select
                    value={timing}
                    onChange={(e) => setTiming(e.target.value)}
                  >
                    <option value="LIVE">10 minutes</option>
                    <option value="ASYNC">24 hours</option>
                  </select>
                </label>
              </div>
              <button disabled={busy || !connection}>{w.new}</button>
            </form>
            <section className="card">
              <h2>{w.join}</h2>
              <label className="field">
                Invite code
                <input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.trim())}
                />
              </label>
              <p className="hint">
                Your business name and role use the choices on the left. Rooms
                need 3–6 human players.
              </p>
              <button
                disabled={busy || !connection || !joinCode}
                onClick={() =>
                  run(async () =>
                    accept(
                      await callTool("lemon_join_room", {
                        idempotencyKey: crypto.randomUUID(),
                        inviteToken: joinCode,
                        payload: { alias, role },
                      }),
                    ),
                  )
                }
              >
                {w.join}
              </button>
              <h3>Continue a campaign</h3>
              {campaigns.length ? (
                campaigns.map((c) => (
                  <button
                    className="campaign"
                    key={c.roomId}
                    onClick={() =>
                      run(async () =>
                        accept(
                          await callTool("lemon_get_snapshot", {
                            roomId: c.roomId,
                          }),
                        ),
                      )
                    }
                  >
                    {c.alias}
                    <small>
                      {c.role} · {c.phase} · {w.round} {c.roundNo}
                    </small>
                  </button>
                ))
              ) : (
                <p className="hint">Your saved campaigns will appear here.</p>
              )}
            </section>
          </div>
        </>
      ) : (
        <>
          <div className="toolbar">
            <button
              className="text"
              onClick={() => {
                setSnapshot(null);
                void run(profile);
              }}
            >
              ← {w.back}
            </button>
            <span className="pill">{snapshot.phase}</span>
            <button className="secondary" onClick={refresh} disabled={busy}>
              {w.refresh}
            </button>
          </div>
          <section className="heading">
            <div>
              <span className="eyebrow">{own.role}</span>
              <h1>{own.alias}</h1>
            </div>
            <div className="month">
              {w.round} <strong>{snapshot.roundNo}</strong> / 12
            </div>
          </section>
          <SeasonTrail
            round={snapshot.roundNo}
            phase={snapshot.phase}
            he={locale === "he"}
          />
          <div className="metrics">
            <section className="metric">
              <small>{w.cash}</small>
              <strong dir="ltr">{money(own.cashCents)}</strong>
            </section>
            <section className="metric">
              <small>{w.equity}</small>
              <strong dir="ltr">{money(snapshot.ownEquityCents)}</strong>
            </section>
            <section className="metric">
              <small>{w.inventory}</small>
              <strong>
                {own.lots.reduce((s: number, l: any) => s + l.kg, 0)} kg
              </strong>
            </section>
            <section className="metric">
              <small>Capacity · reputation</small>
              <strong>
                {own.capacity} {own.role === "SELLER" ? "cups" : "kg"} ·{" "}
                {own.reputation}
              </strong>
            </section>
          </div>
          <section className="bulletin">
            <b>{snapshot.event.name.replaceAll("_", " ")}</b>
            <span>
              Yield {snapshot.event.yield}% · demand {snapshot.event.demand}% ·
              variable cost {snapshot.event.cost}%
            </span>
            {snapshot.deadline && (
              <small>
                Deadline: {new Date(snapshot.deadline).toLocaleString()}
              </small>
            )}
          </section>
          <div className="grid">
            <section className="card">
              <h2>
                {snapshot.phase === "LOBBY" ? "Room lobby" : "Market & room"}
              </h2>
              <div className="prices">
                <span>
                  Farm reference{" "}
                  <b>{money(snapshot.referencePrices.farm)}/kg</b>
                </span>
                <span>
                  Distribution reference{" "}
                  <b>{money(snapshot.referencePrices.distribution)}/kg</b>
                </span>
              </div>
              <p className="hint">
                Reference prices guide planning. Executed auction prices can
                differ.
              </p>
              {snapshot.members.map((m: any) => (
                <div className="member" key={m.id}>
                  <span>
                    {m.alias}
                    <small>
                      {m.role} {m.npc ? "· NPC" : ""}
                    </small>
                  </span>
                  <span className="pill">{m.ready ? w.ready : m.status}</span>
                </div>
              ))}
              {snapshot.phase === "LOBBY" && snapshot.isHost && (
                <div className="actions">
                  <button
                    disabled={busy}
                    onClick={() => run(() => command("lemon_start_campaign"))}
                  >
                    {w.start}
                  </button>
                  {snapshot.mode === "MULTIPLAYER" && (
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          const r = await command("lemon_create_invite");
                          setInvite(r.inviteToken);
                        })
                      }
                    >
                      {w.invite}
                    </button>
                  )}
                </div>
              )}
              {invite && (
                <label className="field">
                  Share this invite code manually
                  <input
                    readOnly
                    value={invite}
                    onFocus={(e) => e.target.select()}
                  />
                </label>
              )}
              {snapshot.phase === "PLANNING" && (
                <button
                  className="secondary mentor"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      const c = await callTool("lemon_get_mentor_context", {
                        roomId: snapshot.roomId,
                        roundNo: snapshot.roundNo,
                        topic: "PLAN",
                      });
                      setMentor(c);
                      await askMentor(
                        `Use lemon_get_mentor_context for room ${snapshot.roomId}, round ${snapshot.roundNo}. Compare my options and explain working capital. Label forecasts as estimates; do not commit any action.`,
                      );
                    })
                  }
                >
                  {w.mentor}
                </button>
              )}
              {mentor && (
                <div className="tutorial">
                  <p>{mentor.lesson}</p>
                  <p>Ask in ChatGPT: “Compare my plan at 20% lower demand.”</p>
                  <p className="hint">{mentor.scenarios?.assumptions}</p>
                </div>
              )}
            </section>
            {snapshot.phase === "PLANNING" && plan ? (
              <form
                className="card"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(() => command("lemon_save_plan", plan, true));
                }}
              >
                <h2>{w.plan}</h2>
                {own.committed && (
                  <p className="locked">
                    Your decision is locked. Waiting for the room.
                  </p>
                )}
                <fieldset disabled={disabled}>
                  <BusinessPlayground
                    plan={plan}
                    own={own}
                    event={snapshot.event}
                    change={setPlan}
                    he={locale === "he"}
                  />

                  <div className="row">
                    {plan.role === "GROWER" ? (
                      <>
                        {input(
                          "Planned harvest (kg)",
                          "plannedKg",
                          own.capacity,
                        )}
                        {input("Farm ask (LE/kg)", "askPriceCents", 6, true, 1)}
                      </>
                    ) : (
                      <>
                        {input(
                          "Procurement target (kg)",
                          "targetInputKg",
                          own.role === "SELLER"
                            ? own.capacity / 4
                            : own.capacity,
                        )}
                        {input(
                          "Maximum bid (LE/kg)",
                          "bidPriceCents",
                          own.role === "SELLER" ? 10 : 6,
                          true,
                          own.role === "SELLER" ? 2 : 1,
                        )}
                      </>
                    )}
                  </div>
                  {plan.role === "DISTRIBUTOR" && (
                    <div className="row">
                      {input(
                        "Resale ask (LE/kg)",
                        "askPriceCents",
                        10,
                        true,
                        2,
                      )}
                      {input("Sales cap (kg)", "salesCapKg", own.capacity)}
                    </div>
                  )}
                  {plan.role === "SELLER" && (
                    <>
                      <div className="row">
                        {input("Planned cups", "plannedCups", own.capacity)}
                        {input(
                          "Retail price (LE/cup)",
                          "retailPriceCents",
                          8,
                          true,
                          1,
                        )}
                      </div>
                      {input("Marketing (LE)", "marketingCents", 1000, true)}
                    </>
                  )}
                  <label className="field">
                    Equipment
                    <select
                      value={plan.upgrade}
                      onChange={(e) =>
                        setPlan({ ...plan, upgrade: e.target.value })
                      }
                    >
                      <option value="NONE">Keep current capacity</option>
                      <option value="CAPACITY">
                        Upgrade · 2,000 LE · available next month
                      </option>
                    </select>
                  </label>
                  <p className="hint">
                    Reserve overhead, procurement and production from your
                    opening cash. Sales this month cannot fund your plan.
                  </p>
                  <CashWidget
                    plan={plan}
                    own={own}
                    event={snapshot.event}
                    contracts={snapshot.contracts}
                    he={locale === "he"}
                  />
                  <div className="actions">
                    <button type="submit">{w.save}</button>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() =>
                        run(async () =>
                          setScenarios(
                            await callTool("lemon_preview_plan", {
                              roomId: snapshot.roomId,
                              roundNo: snapshot.roundNo,
                              proposedPlan: plan,
                            }),
                          ),
                        )
                      }
                    >
                      {w.preview}
                    </button>
                  </div>
                  <button
                    type="button"
                    className="commit"
                    onClick={() =>
                      run(async () => {
                        const saved = await command(
                          "lemon_save_plan",
                          plan,
                          true,
                        );
                        await command(
                          "lemon_commit_plan",
                          { planRevision: saved.ownBusiness.planRevision },
                          true,
                          saved,
                        );
                      })
                    }
                  >
                    {w.commit}
                  </button>
                  <small className="hint">
                    Commit is final for this month.
                  </small>
                </fieldset>
              </form>
            ) : (
              <section className="card">
                <h2>{snapshot.phase === "LOCKED" ? w.wait : w.report}</h2>
                {snapshot.report ? (
                  <>
                    <dl className="report">
                      {[
                        ["Revenue", "revenueCents"],
                        ["Cost of sold goods", "cogsCents"],
                        ["Spoilage & unsold output", "writeoffCents"],
                        ["Overhead", "overheadCents"],
                        ["Marketing", "marketingCents"],
                        ["Depreciation", "depreciationCents"],
                        ["Operating profit", "profitCents"],
                        ["Closing cash", "closingCashCents"],
                      ].map(([label, key]) => (
                        <React.Fragment key={key}>
                          <dt>{label}</dt>
                          <dd dir="ltr">{money(snapshot.report[key])}</dd>
                        </React.Fragment>
                      ))}
                    </dl>
                    <p>
                      Sales: {snapshot.report.sales} · Lost demand:{" "}
                      {snapshot.report.lostSales}
                    </p>
                    <p>
                      Break-even:{" "}
                      {snapshot.report.breakEvenQuantity ??
                        "No finite break-even at this contribution margin"}
                    </p>
                    {snapshot.phase === "COMPLETED" && (
                      <p className="locked">
                        Campaign complete. Compare equity within your role;
                        review your decisions and start a new campaign from
                        Home.
                      </p>
                    )}
                    {snapshot.isHost && snapshot.phase === "REPORT" && (
                      <div className="actions">
                        <button
                          disabled={busy}
                          onClick={() => run(() => command("lemon_next_round"))}
                        >
                          {w.next}
                        </button>
                        <button
                          className="secondary"
                          disabled={busy}
                          onClick={() =>
                            run(() =>
                              command("lemon_pause_resume", {
                                desiredState: "PAUSED",
                              }),
                            )
                          }
                        >
                          {w.pause}
                        </button>
                      </div>
                    )}
                    {snapshot.isHost && snapshot.phase === "PAUSED" && (
                      <button
                        disabled={busy}
                        onClick={() =>
                          run(() =>
                            command("lemon_pause_resume", {
                              desiredState: "REPORT",
                            }),
                          )
                        }
                      >
                        {w.resume}
                      </button>
                    )}
                  </>
                ) : (
                  <p className="hint">
                    Set your plan after the campaign starts. Reports appear
                    after the room settles.
                  </p>
                )}
              </section>
            )}
          </div>
          {scenarios && (
            <section className="card">
              <h2>Forecast · estimate</h2>
              <p className="hint">{scenarios.assumptions}</p>
              <div className="metrics">
                {scenarios.scenarios.map((s: any) => (
                  <div className="metric" key={s.demandPercent}>
                    <small>{s.demandPercent}% retail demand</small>
                    <strong dir="ltr">{money(s.report.profitCents)}</strong>
                    <small>
                      Profit · closing cash {money(s.report.closingCashCents)}
                    </small>
                  </div>
                ))}
              </div>
            </section>
          )}
          {snapshot.phase === "PLANNING" && (
            <section className="card">
              <h2>{w.contracts}</h2>
              <p className="hint">
                One-month offers between adjacent human roles. Acceptance
                reserves cash and updates both plans. Delivered quantity alone
                is paid.
              </p>
              {snapshot.contracts.map((c: any) => (
                <div className="contract" key={c.id}>
                  <span>
                    {c.kg} kg · {money(c.priceCents)}/kg · {c.status}
                  </span>
                  {c.status === "OFFERED" && c.buyerId === own.id && (
                    <div className="actions">
                      {["ACCEPT", "REJECT"].map((response) => (
                        <button
                          disabled={disabled}
                          className={response === "REJECT" ? "secondary" : ""}
                          key={response}
                          onClick={() =>
                            run(() =>
                              command(
                                "lemon_respond_contract",
                                {
                                  offerId: c.id,
                                  offerRevision: c.revision,
                                  response,
                                },
                                true,
                              ),
                            )
                          }
                        >
                          {response}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {own.role !== "SELLER" && (
                <fieldset disabled={disabled}>
                  <div className="row">
                    <label className="field">
                      Counterparty
                      <select
                        value={buyer}
                        onChange={(e) => setBuyer(e.target.value)}
                      >
                        <option value="">Select business</option>
                        {snapshot.members
                          .filter(
                            (b: any) =>
                              !b.npc &&
                              !b.ready &&
                              b.role ===
                                (own.role === "GROWER"
                                  ? "DISTRIBUTOR"
                                  : "SELLER"),
                          )
                          .map((b: any) => (
                            <option value={b.id} key={b.id}>
                              {b.alias}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label className="field">
                      Lemons (kg)
                      <input
                        type="number"
                        min="1"
                        value={contractKg}
                        onChange={(e) => setContractKg(Number(e.target.value))}
                      />
                    </label>
                    <label className="field">
                      Price (LE/kg)
                      <input
                        type="number"
                        step=".01"
                        min={own.role === "GROWER" ? 1 : 2}
                        max={own.role === "GROWER" ? 6 : 10}
                        value={contractPrice}
                        onChange={(e) =>
                          setContractPrice(Number(e.target.value))
                        }
                      />
                    </label>
                  </div>
                  <button
                    disabled={!buyer || disabled}
                    onClick={() =>
                      run(() =>
                        command(
                          "lemon_offer_contract",
                          {
                            buyerBusinessId: buyer,
                            kg: contractKg,
                            unitPriceCents: String(
                              Math.round(contractPrice * 100),
                            ),
                            expiry: snapshot.deadline,
                          },
                          true,
                        ),
                      )
                    }
                  >
                    Offer supply contract
                  </button>
                </fieldset>
              )}
            </section>
          )}
          {snapshot.report &&
            ["REPORT", "COMPLETED"].includes(snapshot.phase) && (
              <section className="card">
                <h2>{w.reflection}</h2>
                <div className="row">
                  <label className="field">
                    Main factor
                    <select
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                    >
                      {["CASH", "PROFIT", "CAPACITY", "DEMAND", "RISK"].map(
                        (a) => (
                          <option key={a}>{a}</option>
                        ),
                      )}
                    </select>
                  </label>
                  <label className="field">
                    Your reasoning
                    <input
                      value={rationale}
                      maxLength={500}
                      onChange={(e) => setRationale(e.target.value)}
                    />
                  </label>
                </div>
                <button
                  disabled={busy}
                  onClick={() =>
                    run(() =>
                      command(
                        "lemon_record_reflection",
                        { answer, rationale },
                        true,
                      ),
                    )
                  }
                >
                  Record reflection
                </button>
              </section>
            )}
        </>
      )}
      <footer>
        LEMON EMPIRE · Learn through decisions
        <span>Cash ≠ profit · Estimates ≠ outcomes</span>
      </footer>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
