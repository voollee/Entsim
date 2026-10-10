import type { Event, Role } from "../config/index.ts";
import type { Plan } from "../contracts/index.ts";
export interface Lot {
  kg: number;
  costCents: string;
}
export interface Business {
  id: string;
  ordinal: number;
  actor: string | null;
  alias: string;
  role: Role;
  npc: boolean;
  cashCents: string;
  ppeCents: string;
  payablesCents: string;
  lots: Lot[];
  capacity: number;
  reputation: number;
  unpaidRounds: number;
  status: "ACTIVE" | "DISTRESSED" | "INSOLVENT";
  missedRounds: number;
  plan: Plan;
  planRevision: number;
  committed: boolean;
  timedOut: boolean;
}
export interface Contract {
  id: string;
  sellerId: string;
  buyerId: string;
  roundNo: number;
  kg: number;
  priceCents: string;
  expiresAt: string;
  status: "OFFERED" | "ACCEPTED" | "REJECTED" | "EXPIRED" | "SETTLED";
  revision: number;
  deliveredKg?: number;
}
export interface Posting {
  from: string;
  to: string;
  cents: string;
  reason: string;
}
export interface Report {
  businessId: string;
  roundNo: number;
  openingCashCents: string;
  closingCashCents: string;
  openingEquityCents: string;
  closingEquityCents: string;
  revenueCents: string;
  cogsCents: string;
  writeoffCents: string;
  overheadCents: string;
  marketingCents: string;
  depreciationCents: string;
  profitCents: string;
  production: number;
  sales: number;
  allocatedDemand: number;
  lostSales: number;
  spoilageKg: number;
  capexCents: string;
  timedOut: boolean;
  breakEvenQuantity: number | null;
}
export interface Market {
  referenceCents: string;
  priceCents: string | null;
  volumeKg: number;
  noTrades: boolean;
  supplyKg: number;
  demandKg: number;
}
export interface Settlement {
  businesses: Business[];
  contracts: Contract[];
  reports: Report[];
  journal: Posting[];
  markets: { farm: Market; distribution: Market };
  inputHash: string;
  outputHash: string;
}
export interface RoundInput {
  seed: string;
  roundNo: number;
  event: Event;
  initialSellerCount: number;
  farmReferenceCents: string;
  distributionReferenceCents: string;
  businesses: Business[];
  contracts: Contract[];
  demandPercent?: number;
}
