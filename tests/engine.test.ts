import test from "node:test";
import assert from "node:assert/strict";
import { CONFIG, EVENTS, ROLES } from "../packages/config/index.ts";
import {
  newBusiness,
  settle,
  validatePlan,
  defaultPlan,
  npcPlan,
  equity,
  eventFor,
  clearMarket,
  replayHash,
  pcg32,
  type RoundInput,
} from "../packages/engine/index.ts";
import { allocate, Decimal } from "../packages/engine/math.ts";
function input(): RoundInput {
  return {
    seed: "fixture",
    roundNo: 1,
    event: EVENTS[0],
    initialSellerCount: 1,
    farmReferenceCents: "300",
    distributionReferenceCents: "500",
    businesses: [],
    contracts: [],
  };
}
test("literal retail fixture reconciles cash, unsold cups, equity and profit", () => {
  const i = input(),
    dist = newBusiness("dist", 0, "d", "Dist", "DISTRIBUTOR"),
    seller = newBusiness("seller", 1, "s", "Seller", "SELLER");
  dist.lots = [{ kg: 1000, costCents: "500000" }];
  dist.plan = {
    role: "DISTRIBUTOR",
    targetInputKg: 0,
    bidPriceCents: "300",
    askPriceCents: "500",
    salesCapKg: 1000,
    upgrade: "NONE",
  };
  seller.plan = {
    role: "SELLER",
    targetInputKg: 1000,
    bidPriceCents: "500",
    plannedCups: 4000,
    retailPriceCents: "300",
    marketingCents: "0",
    upgrade: "NONE",
  };
  i.businesses = [dist, seller];
  const out = settle(i),
    report = out.reports[1];
  assert.equal(report.sales, 2083);
  assert.equal(report.revenueCents, "624900");
  assert.equal(report.cogsCents, "364525");
  assert.equal(report.writeoffCents, "335475");
  assert.equal(report.profitCents, "-135100");
  assert.equal(report.closingCashCents, "874900");
  assert.equal(report.closingEquityCents, "1364900");
  assert.equal(out.businesses[1].lots.length, 0);
  assert.equal(replayHash(i), out.inputHash);
  assert.deepEqual(settle(i), out);
  assert.equal(i.businesses[1].cashCents, "1000000");
});
test("opening cash, bounds, capacity and role checks reject invalid plans", () => {
  const b = newBusiness("a", 0, "actor", "A", "SELLER");
  assert.throws(
    () =>
      validatePlan(
        b,
        {
          ...defaultPlan("SELLER"),
          targetInputKg: 1000,
          bidPriceCents: "1000",
          plannedCups: 4000,
        },
        EVENTS[0],
        [],
      ),
    /opening cash/,
  );
  assert.throws(
    () =>
      validatePlan(
        b,
        { ...defaultPlan("SELLER"), plannedCups: 4001 },
        EVENTS[0],
        [],
      ),
    /capacity/,
  );
  assert.throws(
    () =>
      validatePlan(
        b,
        { ...defaultPlan("SELLER"), retailPriceCents: "99" },
        EVENTS[0],
        [],
      ),
    /between/,
  );
  assert.throws(
    () => validatePlan(b, defaultPlan("GROWER"), EVENTS[0], []),
    /role/,
  );
});
test("largest remainder is deterministic and preserves integer totals", () => {
  assert.deepEqual(
    [
      ...allocate(7, [
        { id: "a", ordinal: 0, weight: 1 },
        { id: "b", ordinal: 1, weight: 1 },
        { id: "c", ordinal: 2, weight: 1 },
      ]),
    ],
    [
      ["a", 3],
      ["b", 2],
      ["c", 2],
    ],
  );
  assert.equal(new Decimal("0.1").add("0.2").toString(), "0.3");
});
test("call auction honors limits, priority and no-trade state", () => {
  const result = clearMarket(
    [
      { id: "a", ordinal: 0, kg: 10, price: 200 },
      { id: "b", ordinal: 1, kg: 10, price: 400 },
    ],
    [{ id: "c", ordinal: 2, kg: 15, price: 500 }],
    "300",
    300,
    100,
    600,
  );
  assert.equal(result.market.volumeKg, 15);
  assert.equal(result.trades[0].kg, 10);
  assert.equal(result.trades[1].kg, 5);
  assert.ok(
    Number(result.market.priceCents) >= 400 &&
      Number(result.market.priceCents) <= 500,
  );
  const no = clearMarket(
    [{ id: "a", ordinal: 0, kg: 10, price: 600 }],
    [{ id: "b", ordinal: 1, kg: 10, price: 100 }],
    "300",
    300,
    100,
    600,
  );
  assert.equal(no.market.noTrades, true);
  assert.equal(no.market.priceCents, null);
  assert.equal(no.trades.length, 0);
});
test("10,000 randomized auction cases preserve volume, limits and order-independent ties", () => {
  const draw = pcg32(42n, 54n);
  for (let n = 0; n < 10000; n++) {
    const asks = [0, 1, 2].map((ordinal) => ({
        id: "s" + ordinal,
        ordinal,
        kg: draw() % 100,
        price: 100 + (draw() % 501),
      })),
      bids = [3, 4, 5].map((ordinal) => ({
        id: "b" + ordinal,
        ordinal,
        kg: draw() % 100,
        price: 100 + (draw() % 501),
      }));
    const a = clearMarket(asks, bids, "300", 300, 100, 600);
    assert.deepEqual(
      a,
      clearMarket(
        [...asks].reverse(),
        [...bids].reverse(),
        "300",
        300,
        100,
        600,
      ),
    );
    assert.equal(
      a.trades.reduce((s, t) => s + t.kg, 0),
      a.market.volumeKg,
    );
    for (const t of a.trades) {
      assert.ok(
        Number(t.priceCents) >= asks.find((o) => o.id === t.sellerId)!.price,
      );
      assert.ok(
        Number(t.priceCents) <= bids.find((o) => o.id === t.buyerId)!.price,
      );
    }
  }
});
test("contracts precede spot, shortages prorate by buyer ordinal and charge delivery only", () => {
  const i = input(),
    g = newBusiness("g", 0, "g", "Grower", "GROWER"),
    a = newBusiness("a", 1, "a", "A", "DISTRIBUTOR"),
    b = newBusiness("b", 2, "b", "B", "DISTRIBUTOR");
  g.lots = [{ kg: 9, costCents: "900" }];
  g.plan = defaultPlan("GROWER");
  a.plan = { ...defaultPlan("DISTRIBUTOR"), targetInputKg: 5 } as any;
  b.plan = { ...defaultPlan("DISTRIBUTOR"), targetInputKg: 5 } as any;
  // Frozen settlement fixture models realized shortfall after accepted obligations.
  i.contracts = [
    {
      id: "z",
      sellerId: "g",
      buyerId: "a",
      roundNo: 1,
      kg: 5,
      priceCents: "300",
      expiresAt: "2099-01-01T00:00:00Z",
      status: "ACCEPTED",
      revision: 1,
    },
    {
      id: "a",
      sellerId: "g",
      buyerId: "b",
      roundNo: 1,
      kg: 5,
      priceCents: "300",
      expiresAt: "2099-01-01T00:00:00Z",
      status: "ACCEPTED",
      revision: 1,
    },
  ];
  // Farm output cannot be under-promised by validation; distributor shortage is tested instead.
  g.role = "DISTRIBUTOR";
  g.capacity = 1000;
  g.plan = {
    role: "DISTRIBUTOR",
    targetInputKg: 1,
    bidPriceCents: "100",
    askPriceCents: "500",
    salesCapKg: 10,
    upgrade: "NONE",
  };
  a.role = "SELLER";
  a.capacity = 4000;
  a.plan = { ...defaultPlan("SELLER"), targetInputKg: 5 } as any;
  b.role = "SELLER";
  b.capacity = 4000;
  b.plan = { ...defaultPlan("SELLER"), targetInputKg: 5 } as any;
  i.businesses = [g, a, b];
  const out = settle(i);
  assert.equal(out.contracts.find((c) => c.buyerId === "a")!.deliveredKg, 5);
  assert.equal(out.contracts.find((c) => c.buyerId === "b")!.deliveredKg, 4);
  assert.equal(out.markets.distribution.volumeKg, 0);
  assert.equal(out.reports[0].revenueCents, "2700");
});
test("upgrades change next-round capacity and are capex, not expense", () => {
  const i = input(),
    b = newBusiness("g", 0, "g", "Grower", "GROWER");
  b.plan = { ...defaultPlan("GROWER"), upgrade: "CAPACITY" };
  i.businesses = [b];
  const out = settle(i);
  assert.equal(out.businesses[0].capacity, 1250);
  assert.equal(out.businesses[0].ppeCents, "690000");
  assert.equal(out.reports[0].profitCents, "-60000");
  assert.equal(out.reports[0].capexCents, "200000");
});
test("events are public deterministic PCG draws with no future hidden changes", () => {
  assert.deepEqual(eventFor("test", 1), eventFor("test", 1));
  const draw = pcg32(42n, 54n);
  assert.equal(draw(), 2707161783);
  for (let n = 1; n <= 100; n++)
    assert.ok(EVENTS.includes(eventFor("test", n)));
});
test("1,000 seeded complete campaigns (12,000 settlements) conserve accounting and finite NPC cash", () => {
  for (let campaign = 0; campaign < 1000; campaign++) {
    const i = input();
    i.seed = String(campaign);
    i.initialSellerCount = 2;
    i.businesses = ROLES.flatMap((role) =>
      [0, 1].map((_, j) =>
        newBusiness(
          role + j,
          ROLES.indexOf(role) * 2 + j,
          null,
          role + j,
          role,
        ),
      ),
    );
    for (let round = 1; round <= CONFIG.rounds; round++) {
      i.roundNo = round;
      i.event = eventFor(i.seed, round);
      const out = settle(i);
      for (let j = 0; j < out.businesses.length; j++) {
        const b = out.businesses[j],
          r = out.reports[j];
        assert.ok(BigInt(b.cashCents) >= 0n);
        assert.ok(b.lots.every((l) => l.kg > 0 && BigInt(l.costCents) >= 0n));
        assert.equal(
          equity(b) - BigInt(r.openingEquityCents),
          BigInt(r.profitCents),
        );
      }
      for (const p of out.journal)
        assert.ok(BigInt(p.cents) > 0n && p.from !== p.to);
      i.businesses = out.businesses;
      i.farmReferenceCents = out.markets.farm.referenceCents;
      i.distributionReferenceCents = out.markets.distribution.referenceCents;
    }
  }
});
test("two unpaid rounds liquidate and retain unpaid liabilities", () => {
  const i = input(),
    b = newBusiness("g", 0, "g", "Grower", "GROWER");
  b.cashCents = "0";
  b.ppeCents = "200000";
  i.businesses = [b];
  const first = settle(i);
  assert.equal(first.businesses[0].status, "DISTRESSED");
  i.businesses = first.businesses;
  i.roundNo = 2;
  const next = settle(i);
  assert.equal(next.businesses[0].status, "INSOLVENT");
  assert.ok(BigInt(next.businesses[0].payablesCents) > 0n);
});
