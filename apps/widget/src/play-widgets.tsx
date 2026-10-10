import React from "react";
import type { Plan } from "../../../packages/contracts/index.ts";
import { planningBudget } from "../../../packages/engine/budget.ts";
import type { Business, Contract } from "../../../packages/engine/types.ts";
import type { Event } from "../../../packages/config/index.ts";
const amount = (cents: bigint) =>
  `${new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(Number(cents) / 100)} LE`;
export function SeasonTrail({
  round,
  phase,
  he,
}: {
  round: number;
  phase: string;
  he: boolean;
}) {
  return (
    <ol
      className="season-trail"
      aria-label={he ? "מסלול 12 החודשים" : "12-month journey"}
    >
      {Array.from({ length: 12 }, (_, i) => (
        <li
          key={i}
          className={
            i + 1 === round
              ? "current"
              : i + 1 < round || phase === "COMPLETED"
                ? "finished"
                : ""
          }
          aria-current={i + 1 === round ? "step" : undefined}
        >
          <span>{i + 1 < round || phase === "COMPLETED" ? "✓" : i + 1}</span>
          <small>
            {he ? "חודש" : "Month"} {i + 1}
          </small>
        </li>
      ))}
    </ol>
  );
}
export function BusinessPlayground({
  plan,
  own,
  event,
  change,
  he,
}: {
  plan: Plan;
  own: Business;
  event: Event;
  change: (plan: Plan) => void;
  he: boolean;
}) {
  const key =
    plan.role === "GROWER"
      ? "plannedKg"
      : plan.role === "SELLER"
        ? "plannedCups"
        : "targetInputKg";
  const value =
    plan.role === "GROWER"
      ? plan.plannedKg
      : plan.role === "SELLER"
        ? plan.plannedCups
        : plan.targetInputKg;
  const title =
    plan.role === "GROWER"
      ? he
        ? "המטע שלך"
        : "Your orchard"
      : plan.role === "SELLER"
        ? he
          ? "דוכן הלימונדה"
          : "Your lemonade stand"
        : he
          ? "מחסן הלימונים"
          : "Your lemon warehouse";
  const unit = plan.role === "SELLER" ? (he ? "כוסות" : "cups") : "kg";
  return (
    <section className="business-playground" aria-label={title}>
      <div className="play-title">
        <strong>{title}</strong>
        <span className="draft-tag">{he ? "טיוטה" : "DRAFT"}</span>
      </div>
      <p className="hint">
        {he
          ? "לחצו על אריח כדי לבחור כמות. ההחלטה טרם אושרה."
          : "Tap a tile to choose your volume. Nothing is committed yet."}
      </p>
      <div className="business-tiles">
        {Array.from({ length: 10 }, (_, i) => {
          const target = Math.round((own.capacity * (i + 1)) / 10);
          return (
            <button
              type="button"
              key={i}
              className={value >= target ? "active" : ""}
              aria-label={`${he ? "תכנון" : "Plan"} ${target} ${unit}`}
              aria-pressed={value >= target}
              onClick={() => change({ ...plan, [key]: target } as Plan)}
            >
              <span
                aria-hidden="true"
                className={`business-icon ${plan.role.toLowerCase()}`}
              />
              <small>{(i + 1) * 10}%</small>
            </button>
          );
        })}
      </div>
      <div className="volume-summary" aria-live="polite">
        <strong>
          {value.toLocaleString()} / {own.capacity.toLocaleString()} {unit}
        </strong>
        <span>{he ? "קיבולת מתוכננת" : "Planned capacity"}</span>
      </div>
      <progress
        aria-label={he ? "שימוש בקיבולת" : "Planned capacity usage"}
        value={Math.min(value, own.capacity)}
        max={own.capacity}
      />
      {plan.role === "GROWER" && (
        <p className="hint">
          {he
            ? "יבול צפוי לפי מזג האוויר"
            : "Weather-adjusted harvest estimate"}
          : {Math.floor((value * event.yield) / 100)} kg
        </p>
      )}
      {plan.role === "SELLER" && (
        <p className="hint">
          {he ? "לכמות זו נדרשים" : "This volume needs"} {Math.ceil(value / 4)}{" "}
          kg{" "}
          {he
            ? "לימונים. הרכש והמכירות אינם מובטחים."
            : "of lemons. Procurement and sales are not guaranteed."}
        </p>
      )}
    </section>
  );
}
export function CashWidget({
  plan,
  own,
  event,
  contracts,
  he,
}: {
  plan: Plan;
  own: Business;
  event: Event;
  contracts: Contract[];
  he: boolean;
}) {
  let budget;
  try {
    budget = planningBudget(own, plan, event, contracts);
  } catch {
    return (
      <p role="status">
        {he
          ? "הזינו ערכים תקינים להצגת התקציב"
          : "Enter valid amounts to see your budget."}
      </p>
    );
  }
  const cash = BigInt(own.cashCents),
    left = cash - budget.total;
  const labels: Record<string, string> = he
    ? {
        overhead: "תקורה",
        procurement: "רכש",
        production: "ייצור וטיפול",
        marketing: "שיווק",
        equipment: "ציוד",
      }
    : {
        overhead: "Overhead",
        procurement: "Procurement",
        production: "Production / handling",
        marketing: "Marketing",
        equipment: "Equipment",
      };
  return (
    <section
      className={`cash-widget ${left < 0n ? "over-budget" : ""}`}
      aria-label={he ? "תקציב חי" : "Live cash budget"}
    >
      <div className="play-title">
        <strong>{he ? "לאן הולך הכסף?" : "Where does your cash go?"}</strong>
        <span className="coin-icon" aria-hidden="true">
          LE
        </span>
      </div>
      <div className="cash-bar" aria-hidden="true">
        {Object.entries(budget.parts)
          .filter(([, n]) => n > 0n)
          .map(([key, n], i) => (
            <span
              key={key}
              className={`cash-segment segment-${i}`}
              style={{ flexGrow: Number(n), flexBasis: 0 }}
            />
          ))}
        {left > 0n && (
          <span
            className="cash-free"
            style={{ flexGrow: Number(left), flexBasis: 0 }}
          />
        )}
      </div>
      <dl className="budget-items">
        {Object.entries(budget.parts)
          .filter(([, n]) => n > 0n)
          .map(([key, n]) => (
            <React.Fragment key={key}>
              <dt>{labels[key]}</dt>
              <dd>{amount(n)}</dd>
            </React.Fragment>
          ))}
      </dl>
      <div className="cash-left" role="status" aria-live="polite">
        <span>
          {left < 0n
            ? he
              ? "חסר לתוכנית"
              : "Over budget by"
            : he
              ? "מזומן שנותר לאחר שריון"
              : "Cash left after reservation"}
        </span>
        <strong>{amount(left < 0n ? -left : left)}</strong>
      </div>
      <p className="hint">
        {he
          ? "שריון ממזומן פתיחה בלבד; אין כאן תחזית רווח. השרת בודק את התוכנית לפני שמירה."
          : "Opening cash only; this is not a profit forecast. The server validates your plan before saving."}
      </p>
    </section>
  );
}
