import { z } from "zod";
import type { AccessRule, Evidence } from "../../contracts/types";
import { DomainError } from "../../domain/errors";

const timeWindow = z.object({
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end: z.string().regex(/^\d{2}:\d{2}$/),
});

const ruleInput = z.object({
  id: z.string().min(1),
  target_type: z.enum(["access_node", "access_edge"]),
  target_id: z.string().min(1),
  mode: z.array(z.enum(["motorcycle", "walk", "car"])).min(1),
  purpose: z.array(z.enum(["customer", "delivery"])).min(1),
  direction: z.enum(["forward", "reverse", "both"]),
  effect: z.enum(["closed", "allowed"]),
  valid_from: z.string().datetime({ offset: true }),
  valid_to: z.string().datetime({ offset: true }).nullable(),
  time_windows: z.array(timeWindow).default([]),
  evidence_ids: z.array(z.string().min(1)).min(1),
  version: z.number().int().positive().default(1),
});

const evidenceInput = z.object({
  id: z.string().min(1),
  type: z.enum(["survey", "notice", "report", "observation"]),
  content: z.string().min(1),
  review_due_at: z.string().datetime({ offset: true }).nullable().default(null),
  created_at: z.string().datetime({ offset: true }).optional(),
});

export const createChangesetBody = z.object({
  id: z.string().min(1).optional(),
  dataset_id: z.string().min(1),
  base_version: z.number().int().positive(),
  note: z.string().default(""),
  rules: z.array(ruleInput).default([]),
  evidence: z.array(evidenceInput).default([]),
});

export const patchChangesetBody = z.object({
  base_version: z.number().int().positive().optional(),
  note: z.string().optional(),
  rules: z.array(ruleInput).optional(),
  evidence: z.array(evidenceInput).optional(),
});

export const previewBody = z.object({
  depart_at: z.string().datetime({ offset: true }),
  origin_node_id: z.string().min(1).default("O"),
  mode: z.enum(["motorcycle", "walk"]).default("motorcycle"),
  place_ids: z.array(z.string().min(1)).min(1).optional(),
});

export const reportBody = z.object({
  dataset_id: z.string().min(1),
  message: z.string().min(1),
  related_node_ids: z.array(z.string().min(1)).default([]),
});

export const resetBody = z.object({
  confirm: z.string().min(1),
});

export function parseBody<S extends z.ZodTypeAny>(schema: S, value: unknown): z.output<S> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new DomainError(
      "VALIDATION",
      parsed.error.issues.map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`).join("; "),
      400,
    );
  }
  return parsed.data;
}

export function sealRule(input: z.infer<typeof ruleInput>): AccessRule {
  return {
    id: input.id,
    target_type: input.target_type,
    target_id: input.target_id,
    mode: input.mode,
    purpose: input.purpose,
    direction: input.direction,
    effect: input.effect,
    valid_from: input.valid_from,
    valid_to: input.valid_to,
    time_windows: input.time_windows,
    evidence_ids: input.evidence_ids,
    version: input.version,
    is_simulated: true,
    verification_status: "demo_only",
  };
}

export function sealEvidence(input: z.infer<typeof evidenceInput>, createdAt: string): Evidence {
  return {
    id: input.id,
    type: input.type,
    source_type: "synthetic",
    source_url: null,
    is_simulated: true,
    verification_status: "demo_only",
    review_status: "pending",
    created_at: input.created_at ?? createdAt,
    observed_at: null,
    published_at: null,
    reviewed_at: null,
    review_due_at: input.review_due_at,
    authority_scope: "simulation_only",
    rights: "synthetic-internal",
    content: input.content,
  };
}
