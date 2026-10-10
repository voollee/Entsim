export const CONFIG = Object.freeze({
  version: "1.0.0",
  engineVersion: "0.1.0",
  rounds: 12,
  upgradeCents: 200000n,
  upgradeKg: 250,
  upgradeCups: 1000,
  depreciationCents: 10000n,
  baseDemand: 2500,
  precision: 28,
});
export const ROLES = ["GROWER", "DISTRIBUTOR", "SELLER"] as const;
export type Role = (typeof ROLES)[number];
export const ROLE = {
  GROWER: { capacity: 1000, overhead: 50000n, decay: 15, min: 100, max: 600 },
  DISTRIBUTOR: {
    capacity: 1000,
    overhead: 40000n,
    decay: 10,
    min: 200,
    max: 1000,
  },
  SELLER: { capacity: 4000, overhead: 50000n, decay: 10, min: 100, max: 800 },
} as const;
export const EVENTS = [
  { name: "NORMAL", weight: 50, yield: 100, demand: 100, cost: 100 },
  { name: "DROUGHT", weight: 15, yield: 70, demand: 100, cost: 100 },
  { name: "HEATWAVE", weight: 15, yield: 90, demand: 125, cost: 100 },
  { name: "FESTIVAL", weight: 10, yield: 100, demand: 130, cost: 100 },
  { name: "INPUT_SHOCK", weight: 10, yield: 100, demand: 100, cost: 120 },
] as const;
export type Event = (typeof EVENTS)[number];
