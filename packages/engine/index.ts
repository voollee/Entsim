import { planningBudget } from "./budget.ts";
import { CONFIG, ROLE, type Role, type Event } from "../config/index.ts";
import { planSchema, requireGame, type Plan } from "../contracts/index.ts";
import {
  allocate,
  allocateCents,
  Decimal,
  replayHash,
  rounded,
} from "./math.ts";
import { clearMarket, type Order } from "./market.ts";
import type {
  Business,
  Contract,
  Lot,
  Report,
  RoundInput,
  Settlement,
} from "./types.ts";
export * from "./types.ts";
export { eventFor, hash, replayHash, pcg32 } from "./math.ts";
export { clearMarket } from "./market.ts";
export const kg = (b: Business) => b.lots.reduce((s, l) => s + l.kg, 0);
export const inventoryCost = (b: Business) =>
  b.lots.reduce((s, l) => s + BigInt(l.costCents), 0n);
export const equity = (b: Business) =>
  BigInt(b.cashCents) +
  BigInt(b.ppeCents) +
  inventoryCost(b) -
  BigInt(b.payablesCents);
export function defaultPlan(role: Role): Plan {
  if (role === "GROWER")
    return { role, plannedKg: 0, askPriceCents: "300", upgrade: "NONE" };
  if (role === "DISTRIBUTOR")
    return {
      role,
      targetInputKg: 0,
      bidPriceCents: "300",
      askPriceCents: "500",
      salesCapKg: 1000,
      upgrade: "NONE",
    };
  return {
    role,
    targetInputKg: 0,
    bidPriceCents: "500",
    plannedCups: 0,
    retailPriceCents: "300",
    marketingCents: "0",
    upgrade: "NONE",
  };
}
export function newBusiness(
  id: string,
  ordinal: number,
  actor: string | null,
  alias: string,
  role: Role,
): Business {
  return {
    id,
    ordinal,
    actor,
    alias,
    role,
    npc: actor === null,
    cashCents: actor === null ? "10000000" : "1000000",
    ppeCents: "500000",
    payablesCents: "0",
    lots: [],
    capacity: ROLE[role].capacity,
    reputation: 50,
    unpaidRounds: 0,
    status: "ACTIVE",
    missedRounds: 0,
    plan: defaultPlan(role),
    planRevision: 0,
    committed: false,
    timedOut: false,
  };
}
export function commitments(b: Business, contracts: Contract[]) {
  const accepted = contracts.filter((c) => c.status === "ACCEPTED");
  const input = accepted.filter((c) => c.buyerId === b.id),
    output = accepted.filter((c) => c.sellerId === b.id);
  return {
    input,
    output,
    inputKg: input.reduce((s, c) => s + c.kg, 0),
    outputKg: output.reduce((s, c) => s + c.kg, 0),
    inputCost: input.reduce(
      (s, c) => s + BigInt(c.priceCents) * BigInt(c.kg),
      0n,
    ),
  };
}
export function reserve(
  b: Business,
  p: Plan,
  event: Event,
  contracts: Contract[],
): bigint {
  return planningBudget(b, p, event, contracts).total;
}
export function validatePlan(
  b: Business,
  raw: unknown,
  event: Event,
  contracts: Contract[],
): Plan {
  const parsed = planSchema.safeParse(raw);
  requireGame(
    parsed.success,
    "INVALID_PLAN",
    "Invalid role fields or monetary values",
  );
  const p = parsed.data;
  requireGame(
    p.role === b.role,
    "ROLE_MISMATCH",
    "Plan must match your business role",
  );
  const c = commitments(b, contracts);
  requireGame(
    b.status !== "INSOLVENT",
    "INSOLVENT",
    "This business can only observe",
  );
  function price(value: string, min: number, max: number) {
    requireGame(
      BigInt(value) >= BigInt(min) && BigInt(value) <= BigInt(max),
      "PRICE_RANGE",
      `Price must be between ${min / 100} and ${max / 100} LE`,
    );
  }
  if (p.role === "GROWER") {
    requireGame(
      p.plannedKg <= b.capacity,
      "CAPACITY",
      "Harvest exceeds capacity",
    );
    price(p.askPriceCents, 100, 600);
    requireGame(
      kg(b) + Math.floor((p.plannedKg * event.yield) / 100) >= c.outputKg,
      "CONTRACT_CAPACITY",
      "Harvest and inventory must cover accepted supply",
    );
  } else {
    requireGame(
      p.targetInputKg <=
        (p.role === "SELLER" ? Math.floor(b.capacity / 4) : b.capacity),
      "CAPACITY",
      "Procurement exceeds capacity",
    );
    requireGame(
      p.targetInputKg >= c.inputKg,
      "CONTRACT_CAPACITY",
      "Procurement must include accepted inputs",
    );
    price(
      p.bidPriceCents,
      p.role === "SELLER" ? 200 : 100,
      p.role === "SELLER" ? 1000 : 600,
    );
    if (p.role === "DISTRIBUTOR") {
      price(p.askPriceCents, 200, 1000);
      requireGame(
        p.salesCapKg <= b.capacity &&
          p.salesCapKg >= c.outputKg &&
          kg(b) + p.targetInputKg >= c.outputKg,
        "CONTRACT_CAPACITY",
        "Sales commitments exceed available inventory or capacity",
      );
    } else {
      price(p.retailPriceCents, 100, 800);
      requireGame(
        p.plannedCups <= b.capacity,
        "CAPACITY",
        "Cup production exceeds capacity",
      );
      requireGame(
        BigInt(p.marketingCents) <= 100000n,
        "MARKETING_LIMIT",
        "Marketing is limited to 1,000 LE",
      );
    }
  }
  requireGame(
    reserve(b, p, event, contracts) <= BigInt(b.cashCents),
    "INSUFFICIENT_CASH",
    "Reserve all costs from opening cash; future revenue cannot fund this plan",
  );
  return p;
}
export function conservativePlan(
  b: Business,
  event: Event,
  contracts: Contract[],
): Plan {
  const c = commitments(b, contracts),
    p = defaultPlan(b.role);
  if (p.role === "GROWER")
    p.plannedKg = Math.max(
      0,
      Math.ceil((Math.max(0, c.outputKg - kg(b)) * 100) / event.yield),
    );
  if (p.role === "DISTRIBUTOR") {
    p.targetInputKg = Math.max(c.inputKg, c.outputKg - kg(b));
    p.salesCapKg = b.capacity;
  }
  if (p.role === "SELLER") p.targetInputKg = c.inputKg;
  return p;
}
export function npcPlan(
  b: Business,
  event: Event,
  farm: string,
  distribution: string,
): Plan {
  const p = defaultPlan(b.role);
  let available = BigInt(b.cashCents) - ROLE[b.role].overhead;
  if (available <= 0n || b.status === "INSOLVENT") return p;
  const bounded = (value: string, factor: string, min: number, max: number) =>
    rounded(Decimal.max(min, Decimal.min(max, new Decimal(value).mul(factor))));
  if (p.role === "GROWER") {
    p.askPriceCents = bounded(farm, ".9", 100, 600);
    p.plannedKg = Math.min(b.capacity, Number(available / BigInt(event.cost)));
  }
  if (p.role === "DISTRIBUTOR") {
    p.bidPriceCents = bounded(farm, "1.1", 100, 600);
    p.askPriceCents = bounded(distribution, ".9", 200, 1000);
    p.targetInputKg = Math.min(
      b.capacity,
      Number(available / (BigInt(p.bidPriceCents) + BigInt(event.cost) / 2n)),
    );
    p.salesCapKg = b.capacity;
  }
  if (p.role === "SELLER") {
    p.bidPriceCents = bounded(distribution, "1.1", 200, 1000);
    p.targetInputKg = Math.min(
      Math.floor(b.capacity / 4),
      Number(available / (BigInt(p.bidPriceCents) + BigInt(event.cost) * 2n)),
    );
    p.plannedCups = p.targetInputKg * 4;
  }
  return p;
}
function consume(lots: Lot[], quantity: number): bigint {
  let left = quantity,
    cost = 0n;
  while (left > 0) {
    const lot = lots[0];
    if (!lot) throw new Error("Inventory conservation failed");
    const take = Math.min(left, lot.kg);
    const cents =
      take === lot.kg
        ? BigInt(lot.costCents)
        : (BigInt(lot.costCents) * BigInt(take)) / BigInt(lot.kg);
    cost += cents;
    lot.kg -= take;
    lot.costCents = (BigInt(lot.costCents) - cents).toString();
    left -= take;
    if (!lot.kg) lots.shift();
  }
  return cost;
}
export function settle(raw: RoundInput): Settlement {
  const input = structuredClone(raw);
  input.businesses.sort((a, b) => a.ordinal - b.ordinal);
  input.contracts.sort((a, b) => a.id.localeCompare(b.id));
  const inputHash = replayHash(input);
  const businesses = input.businesses,
    contracts = input.contracts;
  const lookup = new Map(businesses.map((b) => [b.id, b]));
  const journal: Settlement["journal"] = [],
    reports: Report[] = [];
  const opening = new Map(
    businesses.map((b) => [b.id, { cash: b.cashCents, equity: equity(b) }]),
  );
  const metrics = new Map(
    businesses.map((b) => [
      b.id,
      {
        revenue: 0n,
        cogs: 0n,
        writeoff: 0n,
        marketing: 0n,
        production: 0,
        sales: 0,
        allocated: 0,
        spoilage: 0,
        capex: 0n,
        promised: 0,
        delivered: 0,
        acquired: 0,
      },
    ]),
  );
  const pay = (
    from: Business | null,
    to: Business | null,
    cents: bigint,
    reason: string,
  ) => {
    if (!cents) return;
    if (from) {
      if (BigInt(from.cashCents) < cents)
        throw new Error("Working capital violated");
      from.cashCents = (BigInt(from.cashCents) - cents).toString();
    }
    if (to) to.cashCents = (BigInt(to.cashCents) + cents).toString();
    journal.push({
      from: from ? from.id + ":cash" : "external:consumers",
      to: to ? to.id + ":cash" : "external:" + reason,
      cents: cents.toString(),
      reason,
    });
  };
  for (const b of businesses) {
    if (b.status === "INSOLVENT") continue;
    if (b.npc)
      b.plan = npcPlan(
        b,
        input.event,
        input.farmReferenceCents,
        input.distributionReferenceCents,
      );
    if (BigInt(b.cashCents) < ROLE[b.role].overhead) {
      b.status = "DISTRESSED";
      b.plan = conservativePlan(b, input.event, contracts);
    } else validatePlan(b, b.plan, input.event, contracts);
    if (b.plan.role === "GROWER") {
      const harvest = Math.floor((b.plan.plannedKg * input.event.yield) / 100),
        cost = BigInt(b.plan.plannedKg) * BigInt(input.event.cost);
      pay(b, null, cost, "crop");
      metrics.get(b.id)!.production = harvest;
      if (harvest) b.lots.push({ kg: harvest, costCents: cost.toString() });
      else metrics.get(b.id)!.writeoff += cost;
    }
  }
  const trade = (
    sellerId: string,
    buyerId: string,
    quantity: number,
    price: string,
  ) => {
    if (!quantity) return;
    const seller = lookup.get(sellerId)!,
      buyer = lookup.get(buyerId)!,
      cost = consume(seller.lots, quantity),
      amount = BigInt(quantity) * BigInt(price);
    pay(buyer, seller, amount, "lemons");
    buyer.lots.push({ kg: quantity, costCents: amount.toString() });
    metrics.get(sellerId)!.revenue += amount;
    metrics.get(sellerId)!.cogs += cost;
    metrics.get(sellerId)!.sales += quantity;
    metrics.get(buyerId)!.acquired += quantity;
  };
  const venue = (
    role: "GROWER" | "DISTRIBUTOR",
    buyerRole: "DISTRIBUTOR" | "SELLER",
    previous: string,
    base: number,
    min: number,
    max: number,
  ) => {
    for (const seller of businesses.filter(
      (b) => b.role === role && b.status !== "INSOLVENT",
    )) {
      const accepted = contracts.filter(
          (c) => c.status === "ACCEPTED" && c.sellerId === seller.id,
        ),
        promised = accepted.reduce((s, c) => s + c.kg, 0);
      const cap =
        seller.plan.role === "DISTRIBUTOR"
          ? seller.plan.salesCapKg
          : kg(seller);
      const quantity = Math.min(kg(seller), cap, promised);
      const fills = allocate(
        quantity,
        accepted.map((c) => ({
          id: c.id,
          ordinal: lookup.get(c.buyerId)!.ordinal,
          weight: c.kg,
        })),
      );
      for (const c of accepted) {
        c.deliveredKg = fills.get(c.id)!;
        trade(c.sellerId, c.buyerId, c.deliveredKg, c.priceCents);
        c.status = "SETTLED";
      }
      metrics.get(seller.id)!.promised = promised;
      metrics.get(seller.id)!.delivered = quantity;
    }
    const asks: Order[] = businesses
      .filter((b) => b.role === role && b.status !== "INSOLVENT")
      .map((b) => ({
        id: b.id,
        ordinal: b.ordinal,
        kg: Math.min(
          kg(b),
          b.plan.role === "DISTRIBUTOR"
            ? Math.max(0, b.plan.salesCapKg - metrics.get(b.id)!.sales)
            : kg(b),
        ),
        price: Number(
          (b.plan as Extract<Plan, { role: "GROWER" | "DISTRIBUTOR" }>)
            .askPriceCents,
        ),
      }));
    const bids: Order[] = businesses
      .filter((b) => b.role === buyerRole && b.status === "ACTIVE")
      .map((b) => {
        const p = b.plan as Extract<Plan, { role: "DISTRIBUTOR" | "SELLER" }>;
        return {
          id: b.id,
          ordinal: b.ordinal,
          kg: Math.max(0, p.targetInputKg - metrics.get(b.id)!.acquired),
          price: Number(p.bidPriceCents),
        };
      });
    const result = clearMarket(asks, bids, previous, base, min, max);
    for (const t of result.trades)
      trade(t.sellerId, t.buyerId, t.kg, t.priceCents);
    return result.market;
  };
  const farm = venue(
    "GROWER",
    "DISTRIBUTOR",
    input.farmReferenceCents,
    300,
    100,
    600,
  );
  for (const b of businesses.filter(
    (b) => b.role === "DISTRIBUTOR" && b.status !== "INSOLVENT",
  )) {
    const cost = BigInt(input.event.cost) / 2n;
    const handling = BigInt(metrics.get(b.id)!.acquired) * cost;
    pay(b, null, handling, "handling");
    // Newly acquired lots are appended after opening inventory; allocate handling to all incoming units only.
    let remaining = metrics.get(b.id)!.acquired;
    for (let i = b.lots.length - 1; i >= 0 && remaining; i--) {
      const lot = b.lots[i];
      const incoming = Math.min(remaining, lot.kg);
      lot.costCents = (
        BigInt(lot.costCents) +
        BigInt(incoming) * cost
      ).toString();
      remaining -= incoming;
    }
  }
  const distribution = venue(
    "DISTRIBUTOR",
    "SELLER",
    input.distributionReferenceCents,
    500,
    200,
    1000,
  );
  const sellers = businesses.filter(
    (b) => b.role === "SELLER" && b.status === "ACTIVE",
  );
  const weights = sellers.map((b) => {
    const p = b.plan as Extract<Plan, { role: "SELLER" }>;
    const m = metrics.get(b.id)!;
    m.production = Math.min(p.plannedCups, b.capacity, 4 * kg(b));
    const rawCost = consume(b.lots, Math.ceil(m.production / 4)),
      conversion = (BigInt(m.production) * BigInt(input.event.cost)) / 2n;
    pay(b, null, conversion, "conversion");
    m.writeoff = rawCost + conversion;
    m.marketing = BigInt(p.marketingCents);
    pay(b, null, m.marketing, "marketing");
    return {
      id: b.id,
      ordinal: b.ordinal,
      weight: new Decimal(p.retailPriceCents)
        .div(300)
        .pow("-1.2")
        .mul(new Decimal(".5").add(new Decimal(b.reputation).div(100)))
        .mul(
          new Decimal(1).add(
            new Decimal(p.marketingCents).div(10000).add(1).ln().mul(".25"),
          ),
        ),
    };
  });
  const demand = Math.floor(
    (((CONFIG.baseDemand * input.initialSellerCount * input.event.demand) /
      100) *
      (input.demandPercent ?? 100)) /
      100,
  );
  const allocations = allocate(demand, [
    ...weights,
    {
      id: "outside",
      ordinal: 2147483647,
      weight: new Decimal(".2").mul(input.initialSellerCount),
    },
  ]);
  for (const b of sellers) {
    const p = b.plan as Extract<Plan, { role: "SELLER" }>,
      m = metrics.get(b.id)!;
    m.allocated = allocations.get(b.id)!;
    m.sales = Math.min(m.production, m.allocated);
    m.revenue = BigInt(m.sales) * BigInt(p.retailPriceCents);
    pay(null, b, m.revenue, "retail");
    const [sold, expired] = allocateCents(m.writeoff, [
      m.sales,
      m.production - m.sales,
    ]);
    m.cogs = sold;
    m.writeoff = expired;
  }
  for (const b of businesses) {
    const m = metrics.get(b.id)!,
      wasInsolvent = b.status === "INSOLVENT";
    if (!wasInsolvent) {
      m.spoilage = Math.floor((kg(b) * ROLE[b.role].decay) / 100);
      m.writeoff += consume(b.lots, m.spoilage);
    }
    const overhead = wasInsolvent ? 0n : ROLE[b.role].overhead,
      paid = BigInt(b.cashCents) < overhead ? BigInt(b.cashCents) : overhead;
    pay(b, null, paid, "overhead");
    b.payablesCents = (BigInt(b.payablesCents) + overhead - paid).toString();
    b.unpaidRounds = BigInt(b.payablesCents) > 0n ? b.unpaidRounds + 1 : 0;
    const depreciation = wasInsolvent
      ? 0n
      : BigInt(b.ppeCents) < CONFIG.depreciationCents
        ? BigInt(b.ppeCents)
        : CONFIG.depreciationCents;
    b.ppeCents = (BigInt(b.ppeCents) - depreciation).toString();
    if (!wasInsolvent && b.plan.upgrade === "CAPACITY") {
      pay(b, null, CONFIG.upgradeCents, "capex");
      m.capex = CONFIG.upgradeCents;
      b.ppeCents = (BigInt(b.ppeCents) + CONFIG.upgradeCents).toString();
      b.capacity += b.role === "SELLER" ? CONFIG.upgradeCups : CONFIG.upgradeKg;
    }
    const denominator = b.role === "SELLER" ? m.allocated : m.promised,
      numerator = b.role === "SELLER" ? m.sales : m.delivered;
    if (denominator)
      b.reputation = Math.max(
        0,
        Math.min(
          100,
          b.reputation +
            Number(
              rounded(new Decimal(numerator).div(denominator).sub(".8").mul(5)),
            ),
        ),
      );
    if (!wasInsolvent && (b.unpaidRounds >= 2 || equity(b) < 0n)) {
      const book = inventoryCost(b) + BigInt(b.ppeCents),
        reference =
          b.role === "GROWER"
            ? farm.referenceCents
            : distribution.referenceCents;
      const recovery =
        (BigInt(kg(b)) * BigInt(reference)) / 2n + BigInt(b.ppeCents) / 2n;
      pay(null, b, recovery, "liquidation");
      journal[journal.length - 1] &&
        (journal[journal.length - 1].from =
          journal[journal.length - 1].reason === "liquidation"
            ? "external:liquidation"
            : journal[journal.length - 1].from);
      if (book > recovery) m.writeoff += book - recovery;
      else m.revenue += recovery - book;
      b.lots = [];
      b.ppeCents = "0";
      const repay =
        BigInt(b.cashCents) < BigInt(b.payablesCents)
          ? BigInt(b.cashCents)
          : BigInt(b.payablesCents);
      pay(b, null, repay, "payables");
      b.payablesCents = (BigInt(b.payablesCents) - repay).toString();
      b.status = "INSOLVENT";
    } else if (!wasInsolvent)
      b.status = BigInt(b.payablesCents) > 0n ? "DISTRESSED" : "ACTIVE";
    const profit =
      m.revenue - m.cogs - m.writeoff - overhead - m.marketing - depreciation;
    const open = opening.get(b.id)!;
    if (equity(b) - open.equity !== profit)
      throw new Error("Accounting reconciliation failed");
    const contribution = m.sales
      ? new Decimal(m.revenue.toString()).sub(m.cogs.toString()).div(m.sales)
      : new Decimal(0);
    reports.push({
      businessId: b.id,
      roundNo: input.roundNo,
      openingCashCents: open.cash,
      closingCashCents: b.cashCents,
      openingEquityCents: open.equity.toString(),
      closingEquityCents: equity(b).toString(),
      revenueCents: m.revenue.toString(),
      cogsCents: m.cogs.toString(),
      writeoffCents: m.writeoff.toString(),
      overheadCents: overhead.toString(),
      marketingCents: m.marketing.toString(),
      depreciationCents: depreciation.toString(),
      profitCents: profit.toString(),
      production: m.production,
      sales: m.sales,
      allocatedDemand: m.allocated,
      lostSales: Math.max(0, m.allocated - m.sales),
      spoilageKg: m.spoilage,
      capexCents: m.capex.toString(),
      timedOut: b.timedOut,
      breakEvenQuantity: contribution.gt(0)
        ? new Decimal((overhead + m.marketing + depreciation).toString())
            .div(contribution)
            .ceil()
            .toNumber()
        : null,
    });
  }
  const output = {
    businesses,
    contracts,
    reports,
    journal,
    markets: { farm, distribution },
  };
  return { ...output, inputHash, outputHash: replayHash(output) };
}
