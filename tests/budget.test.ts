import { test } from "node:test";
import assert from "node:assert/strict";
import { planningBudget } from "../packages/engine/budget.ts";
import { EVENTS } from "../packages/config/index.ts";
import { defaultPlan } from "../packages/engine/index.ts";
import type { Contract } from "../packages/engine/types.ts";
test("opening-cash budget uses literal costs for all roles and input shocks", () => {
  assert.equal(
    planningBudget(
      { id: "a", role: "GROWER" },
      {
        ...defaultPlan("GROWER"),
        role: "GROWER",
        plannedKg: 800,
        askPriceCents: "300",
        upgrade: "CAPACITY",
      },
      EVENTS[4],
      [],
    ).total,
    346000n,
  );
  assert.equal(
    planningBudget(
      { id: "a", role: "SELLER" },
      {
        role: "SELLER",
        targetInputKg: 400,
        bidPriceCents: "500",
        plannedCups: 1600,
        retailPriceCents: "400",
        marketingCents: "10000",
        upgrade: "NONE",
      },
      EVENTS[0],
      [],
    ).total,
    340000n,
  );
  assert.equal(
    planningBudget(
      { id: "a", role: "DISTRIBUTOR" },
      {
        role: "DISTRIBUTOR",
        targetInputKg: 400,
        bidPriceCents: "300",
        askPriceCents: "500",
        salesCapKg: 400,
        upgrade: "NONE",
      },
      EVENTS[0],
      [],
    ).total,
    180000n,
  );
});
test("accepted input contracts replace spot reservation without double counting", () => {
  const plan = {
    role: "DISTRIBUTOR" as const,
    targetInputKg: 400,
    bidPriceCents: "300",
    askPriceCents: "500",
    salesCapKg: 400,
    upgrade: "NONE" as const,
  };
  const contract = {
    id: "c",
    sellerId: "b",
    buyerId: "a",
    roundNo: 1,
    kg: 100,
    priceCents: "200",
    expiresAt: "",
    status: "ACCEPTED",
    revision: 1,
  } as Contract;
  const result = planningBudget(
    { id: "a", role: "DISTRIBUTOR" },
    plan,
    EVENTS[0],
    [
      contract,
      { ...contract, status: "OFFERED" },
      { ...contract, buyerId: "elsewhere" },
    ],
  );
  assert.equal(result.parts.procurement, 110000n);
  assert.equal(result.total, 170000n);
  assert.equal(
    planningBudget(
      { id: "a", role: "DISTRIBUTOR" },
      { ...plan, targetInputKg: 0 },
      EVENTS[0],
      [contract],
    ).parts.procurement,
    20000n,
  );
});
