import { CONFIG, ROLE, type Event } from "../config/index.ts";
import type { Plan } from "../contracts/index.ts";
import type { Business, Contract } from "./types.ts";

/** Browser-safe, exact opening-cash reservation. No revenue assumptions. */
export function planningBudget(
  b: Pick<Business, "id" | "role">,
  p: Plan,
  event: Pick<Event, "cost">,
  contracts: Contract[],
) {
  const input = contracts.filter(
    (c) => c.status === "ACCEPTED" && c.buyerId === b.id,
  );
  const contractedKg = input.reduce((sum, c) => sum + c.kg, 0);
  const cost = BigInt(event.cost);
  const parts = {
    overhead: ROLE[b.role].overhead,
    procurement:
      p.role === "GROWER"
        ? 0n
        : input.reduce(
            (sum, c) => sum + BigInt(c.priceCents) * BigInt(c.kg),
            0n,
          ) +
          BigInt(Math.max(0, p.targetInputKg - contractedKg)) *
            BigInt(p.bidPriceCents),
    production:
      p.role === "GROWER"
        ? BigInt(p.plannedKg) * cost
        : (BigInt(p.role === "SELLER" ? p.plannedCups : p.targetInputKg) *
            50n *
            cost) /
          100n,
    marketing: p.role === "SELLER" ? BigInt(p.marketingCents) : 0n,
    equipment: p.upgrade === "CAPACITY" ? CONFIG.upgradeCents : 0n,
  };
  return {
    parts,
    total: Object.values(parts).reduce((sum, value) => sum + value, 0n),
  };
}
