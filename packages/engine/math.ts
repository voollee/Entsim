import { createHash } from "node:crypto";
import { Decimal } from "decimal.js";
import { CONFIG, EVENTS } from "../config/index.ts";
Decimal.set({ precision: CONFIG.precision, rounding: Decimal.ROUND_HALF_UP });
export { Decimal };
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object")
    return (
      "{" +
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => JSON.stringify(k) + ":" + canonical(v))
        .join(",") +
      "}"
    );
  return JSON.stringify(value) ?? "null";
}
export const hash = (value: unknown) =>
  createHash("sha256").update(canonical(value)).digest("hex");
export function replayHash<T extends { businesses: unknown[] }>(
  value: T,
): string {
  const sanitized = {
    ...value,
    businesses: value.businesses.map((raw) => {
      const { actor, alias, ...economic } = raw as Record<string, unknown>;
      return economic;
    }),
  };
  return hash(sanitized);
}
export function pcg32(seed: bigint, stream: bigint): () => number {
  const mask = (1n << 64n) - 1n;
  let state = 0n;
  const inc = ((stream << 1n) | 1n) & mask;
  const draw = () => {
    const old = state;
    state = (old * 6364136223846793005n + inc) & mask;
    const x = Number((((old >> 18n) ^ old) >> 27n) & 0xffffffffn) >>> 0;
    const rot = Number(old >> 59n);
    return ((x >>> rot) | (x << (-rot & 31))) >>> 0;
  };
  draw();
  state = (state + seed) & mask;
  draw();
  return draw;
}
export function eventFor(seed: string, round: number) {
  const digest = hash({ seed, round, purpose: "event" });
  const draw = pcg32(
    BigInt("0x" + digest.slice(0, 16)),
    BigInt("0x" + digest.slice(16, 32)),
  );
  const range = 4294967200;
  let v = draw();
  while (v >= range) v = draw();
  let p = v % 100;
  for (const event of EVENTS) {
    if (p < event.weight) return event;
    p -= event.weight;
  }
  return EVENTS[0];
}
export function allocate(
  total: number,
  items: { id: string; ordinal: number; weight: Decimal.Value }[],
): Map<string, number> {
  const result = new Map(items.map((x) => [x.id, 0]));
  const sum = items.reduce((s, x) => s.add(x.weight), new Decimal(0));
  if (!total || sum.isZero()) return result;
  const shares = items.map((x) => {
    const exact = new Decimal(total).mul(x.weight).div(sum);
    const floor = exact.floor().toNumber();
    result.set(x.id, floor);
    return { ...x, floor, remainder: exact.sub(floor) };
  });
  let left = total - shares.reduce((s, x) => s + x.floor, 0);
  shares.sort(
    (a, b) =>
      b.remainder.cmp(a.remainder) ||
      a.ordinal - b.ordinal ||
      a.id.localeCompare(b.id),
  );
  for (const x of shares) {
    if (left-- <= 0) break;
    result.set(x.id, x.floor + 1);
  }
  return result;
}
export function allocateCents(total: bigint, quantities: number[]): bigint[] {
  const sum = BigInt(quantities.reduce((s, q) => s + q, 0));
  if (!sum) return quantities.map(() => 0n);
  const parts = quantities.map((q, i) => ({
    i,
    amount: (total * BigInt(q)) / sum,
    remainder: (total * BigInt(q)) % sum,
  }));
  let left = total - parts.reduce((s, p) => s + p.amount, 0n);
  for (const p of [...parts].sort((a, b) =>
    a.remainder === b.remainder
      ? a.i - b.i
      : a.remainder > b.remainder
        ? -1
        : 1,
  )) {
    if (left-- <= 0n) break;
    p.amount++;
  }
  return parts.map((p) => p.amount);
}
export const rounded = (n: Decimal.Value) =>
  new Decimal(n).toDecimalPlaces(0).toFixed(0);
