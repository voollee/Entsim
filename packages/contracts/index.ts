import { z } from "zod";
import { ROLES } from "../config/index.ts";
export const money = z.string().regex(/^(0|[1-9][0-9]{0,12})$/);
const quantity = z.number().int().min(0).max(1000000);
const upgrade = z.enum(["NONE", "CAPACITY"]);
export const planSchema = z.discriminatedUnion("role", [
  z
    .object({
      role: z.literal("GROWER"),
      plannedKg: quantity,
      askPriceCents: money,
      upgrade,
    })
    .strict(),
  z
    .object({
      role: z.literal("DISTRIBUTOR"),
      targetInputKg: quantity,
      bidPriceCents: money,
      askPriceCents: money,
      salesCapKg: quantity,
      upgrade,
    })
    .strict(),
  z
    .object({
      role: z.literal("SELLER"),
      targetInputKg: quantity,
      bidPriceCents: money,
      plannedCups: quantity,
      retailPriceCents: money,
      marketingCents: money,
      upgrade,
    })
    .strict(),
]);
export type Plan = z.infer<typeof planSchema>;
export const roleSchema = z.enum(ROLES);
export const aliasSchema = z
  .string()
  .trim()
  .min(1)
  .max(32)
  .refine((s) => !/[\x00-\x1f<>]/.test(s), "Use a plain-text name");
export const writeBase = {
  roomId: z.string().uuid(),
  expectedVersion: z.number().int().nonnegative(),
  idempotencyKey: z.string().uuid(),
};
export const roundBase = {
  ...writeBase,
  roundNo: z.number().int().min(1).max(12),
};
export class GameError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 422,
    public currentVersion?: number,
  ) {
    super(message);
  }
}
export function requireGame(
  condition: unknown,
  code: string,
  message: string,
  status = 422,
): asserts condition {
  if (!condition) throw new GameError(code, message, status);
}
