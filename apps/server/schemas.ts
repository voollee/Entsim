import { z } from "zod";
import {
  aliasSchema,
  planSchema,
  roleSchema,
  roundBase,
  writeBase,
} from "../../packages/contracts/index.ts";
const roomRead = z.object({ roomId: z.string().uuid() }).strict();
const withPayload = (shape: Record<string, z.ZodType>, round = false) =>
  z
    .object({
      ...(round ? roundBase : writeBase),
      payload: z.object(shape).strict(),
    })
    .strict();
export const schemas = {
  lemon_get_rules: z
    .object({ locale: z.enum(["en", "he"]).default("en") })
    .strict(),
  lemon_get_profile: z.object({}).strict(),
  lemon_create_room: z
    .object({
      idempotencyKey: z.string().uuid(),
      payload: z
        .object({
          mode: z.enum(["SOLO", "MULTIPLAYER"]),
          locale: z.enum(["en", "he"]),
          timing: z.enum(["LIVE", "ASYNC"]),
          alias: aliasSchema,
          role: roleSchema,
        })
        .strict(),
    })
    .strict(),
  lemon_create_invite: withPayload({}),
  lemon_join_room: z
    .object({
      idempotencyKey: z.string().uuid(),
      inviteToken: z.string().min(20).max(128),
      payload: z.object({ alias: aliasSchema, role: roleSchema }).strict(),
    })
    .strict(),
  lemon_configure_lobby: withPayload({
    role: roleSchema.optional(),
    hostBusinessId: z.string().uuid().optional(),
    revokeInvite: z.boolean().optional(),
  }),
  lemon_start_campaign: withPayload({}),
  lemon_get_snapshot: roomRead,
  lemon_save_plan: z.object({ ...roundBase, payload: planSchema }).strict(),
  lemon_preview_plan: z
    .object({
      roomId: z.string().uuid(),
      roundNo: z.number().int().min(1).max(12),
      proposedPlan: planSchema,
    })
    .strict(),
  lemon_offer_contract: withPayload(
    {
      buyerBusinessId: z.string().uuid(),
      kg: z.number().int().positive().max(1000000),
      unitPriceCents: z.string().regex(/^[0-9]{1,4}$/),
      expiry: z.string().datetime(),
    },
    true,
  ),
  lemon_respond_contract: withPayload(
    {
      offerId: z.string().uuid(),
      offerRevision: z.number().int().nonnegative(),
      response: z.enum(["ACCEPT", "REJECT"]),
    },
    true,
  ),
  lemon_commit_plan: withPayload(
    { planRevision: z.number().int().nonnegative() },
    true,
  ),
  lemon_reclaim_control: withPayload({}, true),
  lemon_get_report: z
    .object({
      roomId: z.string().uuid(),
      roundNo: z.number().int().min(1).max(12),
    })
    .strict(),
  lemon_get_mentor_context: z
    .object({
      roomId: z.string().uuid(),
      roundNo: z.number().int().min(1).max(12),
      topic: z
        .enum(["PLAN", "CASH_VS_PROFIT", "MARKET", "REFLECTION"])
        .default("PLAN"),
    })
    .strict(),
  lemon_record_reflection: withPayload(
    {
      answer: z.enum(["CASH", "PROFIT", "CAPACITY", "DEMAND", "RISK"]),
      rationale: z.string().max(500),
    },
    true,
  ),
  lemon_pause_resume: withPayload({
    desiredState: z.enum(["PAUSED", "REPORT"]),
  }),
  lemon_next_round: withPayload({}),
  lemon_export_account: z.object({}).strict(),
  lemon_export_delete_account: z
    .object({
      idempotencyKey: z.string().uuid(),
      action: z.enum(["PREPARE_DELETE", "DELETE"]),
      confirmationToken: z.string().min(20).max(128).optional(),
    })
    .strict(),
};
export type ToolName = keyof typeof schemas;
export const READS = new Set<ToolName>([
  "lemon_get_rules",
  "lemon_get_profile",
  "lemon_get_snapshot",
  "lemon_preview_plan",
  "lemon_get_report",
  "lemon_get_mentor_context",
  "lemon_export_account",
]);
