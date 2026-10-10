import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BusinessPlayground,
  CashWidget,
  SeasonTrail,
} from "../src/play-widgets.tsx";
import { EVENTS, ROLE, type Role } from "../../../packages/config/index.ts";
import type { Plan } from "../../../packages/contracts/index.ts";
import type { Business } from "../../../packages/engine/types.ts";
import "./preview.css";
const initial = (role: Role): Plan =>
  role === "GROWER"
    ? { role, plannedKg: 0, askPriceCents: "300", upgrade: "NONE" }
    : role === "DISTRIBUTOR"
      ? {
          role,
          targetInputKg: 0,
          bidPriceCents: "300",
          askPriceCents: "500",
          salesCapKg: 0,
          upgrade: "NONE",
        }
      : {
          role,
          targetInputKg: 0,
          bidPriceCents: "500",
          plannedCups: 0,
          retailPriceCents: "300",
          marketingCents: "0",
          upgrade: "NONE",
        };
function Preview() {
  const [plan, setPlan] = useState<Plan>(initial("GROWER"));
  const [he, setHe] = useState(true);
  const own = {
    id: "preview",
    role: plan.role,
    capacity: ROLE[plan.role].capacity,
    cashCents: "1000000",
  } as Business;
  const field = (
    label: string,
    key: string,
    max: number,
    price = false,
    min = 0,
  ) => {
    const value = (plan as unknown as Record<string, string | number>)[key];
    return (
      <label className="preview-field">
        {label}
        <output>{price ? Number(value) / 100 : value}</output>
        <input
          type="range"
          min={min}
          max={max}
          step={price ? 0.01 : 1}
          value={price ? Number(value) / 100 : value}
          onChange={(e) =>
            setPlan({
              ...plan,
              [key]: price
                ? String(Math.round(Number(e.target.value) * 100))
                : Number(e.target.value),
            } as Plan)
          }
        />
      </label>
    );
  };
  return (
    <div className="preview-product" dir={he ? "rtl" : "ltr"}>
      <header>
        <strong>◒ LEMON EMPIRE</strong>
        <span>
          {he ? "המשחק נעצר · תצוגת טיוטה" : "Game stopped · Draft preview"}
        </span>
        <button onClick={() => setHe(!he)}>{he ? "English" : "עברית"}</button>
      </header>
      <nav aria-label={he ? "תפקיד" : "Role"}>
        {(["GROWER", "DISTRIBUTOR", "SELLER"] as Role[]).map((role, i) => (
          <button
            key={role}
            aria-pressed={plan.role === role}
            onClick={() => setPlan(initial(role))}
          >
            {he
              ? ["מגדל לימונים", "משווק", "מוכר לימונדה"][i]
              : ["Grower", "Distributor", "Lemonade seller"][i]}
          </button>
        ))}
      </nav>
      <SeasonTrail round={1} phase="PLANNING" he={he} />
      <div className="preview-columns">
        <section>
          <BusinessPlayground
            plan={plan}
            own={own}
            event={EVENTS[0]}
            change={setPlan}
            he={he}
          />
          <CashWidget
            plan={plan}
            own={own}
            event={EVENTS[0]}
            contracts={[]}
            he={he}
          />
        </section>
        <section className="preview-controls">
          <h2>{he ? "בונים את התוכנית" : "Build your plan"}</h2>
          {plan.role === "GROWER" ? (
            <>
              {field(
                he ? "יבול מתוכנן (ק״ג)" : "Planned harvest (kg)",
                "plannedKg",
                own.capacity,
              )}
              {field(
                he ? "מחיר מבוקש (LE/kg)" : "Ask price (LE/kg)",
                "askPriceCents",
                6,
                true,
                1,
              )}
            </>
          ) : (
            <>
              {field(
                he ? "רכש לימונים (ק״ג)" : "Procurement target (kg)",
                "targetInputKg",
                1000,
              )}
              {field(
                he ? "הצעת מחיר מקסימלית (LE/kg)" : "Maximum bid (LE/kg)",
                "bidPriceCents",
                plan.role === "SELLER" ? 10 : 6,
                true,
                plan.role === "SELLER" ? 2 : 1,
              )}
              {plan.role === "SELLER" ? (
                <>
                  {field(
                    he ? "כוסות לימונדה" : "Planned cups",
                    "plannedCups",
                    4000,
                  )}
                  {field(
                    he ? "מחיר לכוס (LE)" : "Price per cup (LE)",
                    "retailPriceCents",
                    8,
                    true,
                    1,
                  )}
                  {field(
                    he ? "תקציב שיווק (LE)" : "Marketing budget (LE)",
                    "marketingCents",
                    1000,
                    true,
                  )}
                </>
              ) : (
                <>
                  {field(
                    he ? "מכירה מתוכננת (ק״ג)" : "Sales cap (kg)",
                    "salesCapKg",
                    1000,
                  )}
                  {field(
                    he ? "מחיר מכירה (LE/kg)" : "Resale ask (LE/kg)",
                    "askPriceCents",
                    10,
                    true,
                    2,
                  )}
                </>
              )}
            </>
          )}
          <label className="preview-equipment">
            <input
              type="checkbox"
              checked={plan.upgrade === "CAPACITY"}
              onChange={(e) =>
                setPlan({
                  ...plan,
                  upgrade: e.target.checked ? "CAPACITY" : "NONE",
                })
              }
            />
            {he ? "שדרוג ציוד · 2,000 LE" : "Equipment upgrade · 2,000 LE"}
          </label>
          <p className="hint">
            {he
              ? "10,000 LE בדיוניים · מזג אוויר רגיל · השינויים כאן אינם נשמרים למשחק."
              : "10,000 fictional LE · Normal weather · Changes here are not saved to a campaign."}
          </p>
        </section>
      </div>
    </div>
  );
}
createRoot(document.getElementById("lemon-preview")!).render(<Preview />);
