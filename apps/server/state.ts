import type {
  Business,
  Contract,
  Report,
  Market,
} from "../../packages/engine/index.ts";
import type { Event } from "../../packages/config/index.ts";
export type Phase =
  "LOBBY" | "PLANNING" | "LOCKED" | "REPORT" | "PAUSED" | "COMPLETED";
export interface Room {
  id: string;
  mode: "SOLO" | "MULTIPLAYER";
  locale: "en" | "he";
  timing: "LIVE" | "ASYNC";
  host: string;
  version: number;
  phase: Phase;
  roundNo: number;
  deadline: string | null;
  seed: string;
  engineVersion: string;
  configVersion: string;
  event: Event;
  initialSellerCount: number;
  farmReferenceCents: string;
  distributionReferenceCents: string;
  businesses: Business[];
  contracts: Contract[];
  reports: Record<string, Report[]>;
  markets: { farm: Market | null; distribution: Market | null };
  inviteHash: string | null;
  inviteExpiry: string | null;
  reflections: Record<
    string,
    { roundNo: number; answer: string; rationale: string }[]
  >;
}
