import { allocate, Decimal, rounded } from "./math.ts";
import type { Market } from "./types.ts";
export interface Order {
  id: string;
  ordinal: number;
  kg: number;
  price: number;
}
export interface Trade {
  sellerId: string;
  buyerId: string;
  kg: number;
  priceCents: string;
}
export function clearMarket(
  asks: Order[],
  bids: Order[],
  previous: string,
  base: number,
  min: number,
  max: number,
): { market: Market; trades: Trade[] } {
  const supply = asks.reduce((s, x) => s + x.kg, 0),
    demand = bids.reduce((s, x) => s + x.kg, 0);
  const target = Decimal.max(
    min,
    Decimal.min(
      max,
      new Decimal(base).mul(new Decimal(demand + 1).div(supply + 1).pow(".35")),
    ),
  );
  const reference = Number(
    rounded(new Decimal(previous).mul(".7").add(target.mul(".3"))),
  );
  let best = { p: min, v: 0, imbalance: Infinity, distance: Infinity };
  for (let p = min; p <= max; p++) {
    const s = asks.reduce((n, x) => n + (x.price <= p ? x.kg : 0), 0),
      d = bids.reduce((n, x) => n + (x.price >= p ? x.kg : 0), 0);
    const v = Math.min(s, d),
      imbalance = Math.abs(s - d),
      distance = Math.abs(p - reference);
    if (
      v > best.v ||
      (v === best.v &&
        (imbalance < best.imbalance ||
          (imbalance === best.imbalance && distance < best.distance)))
    )
      best = { p, v, imbalance, distance };
  }
  const market: Market = {
    referenceCents: String(reference),
    priceCents: best.v ? String(best.p) : null,
    volumeKg: best.v,
    noTrades: !best.v,
    supplyKg: supply,
    demandKg: demand,
  };
  function fill(orders: Order[], side: "ask" | "bid") {
    const eligible = orders
      .filter((x) => (side === "ask" ? x.price <= best.p : x.price >= best.p))
      .sort(
        (a, b) =>
          (side === "ask" ? a.price - b.price : b.price - a.price) ||
          a.ordinal - b.ordinal,
      );
    const filled: Order[] = [];
    let left = best.v;
    for (let i = 0; i < eligible.length && left > 0;) {
      let j = i;
      while (j < eligible.length && eligible[j].price === eligible[i].price)
        j++;
      const tier = eligible.slice(i, j),
        q = Math.min(
          left,
          tier.reduce((s, x) => s + x.kg, 0),
        ),
        allocated = allocate(
          q,
          tier.map((x) => ({ ...x, weight: x.kg })),
        );
      for (const x of tier) {
        const kg = allocated.get(x.id)!;
        if (kg) filled.push({ ...x, kg });
      }
      left -= q;
      i = j;
    }
    return filled.sort((a, b) => a.ordinal - b.ordinal);
  }
  const sellers = fill(asks, "ask"),
    buyers = fill(bids, "bid"),
    trades: Trade[] = [];
  let i = 0,
    j = 0;
  while (i < sellers.length && j < buyers.length) {
    const kg = Math.min(sellers[i].kg, buyers[j].kg);
    trades.push({
      sellerId: sellers[i].id,
      buyerId: buyers[j].id,
      kg,
      priceCents: String(best.p),
    });
    sellers[i].kg -= kg;
    buyers[j].kg -= kg;
    if (!sellers[i].kg) i++;
    if (!buyers[j].kg) j++;
  }
  return { market, trades };
}
