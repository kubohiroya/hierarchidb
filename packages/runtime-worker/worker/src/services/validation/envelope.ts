import { z } from 'zod';
import type { CommandEnvelope } from '../command-types';

// Common constraints
const ID_MAX = 100;
const TYPE_MAX = 64;
const SOURCE_VIEW_ID_MAX = 128;

const idString = z.string().min(1).max(ID_MAX);
const typeString = z
  .string()
  .min(1)
  .max(TYPE_MAX)
  // Allow letters, digits, dash, underscore, and camelCase; keep permissive
  .regex(/^[A-Za-z0-9_-]+$/, 'type/kind must be alnum, dash or underscore');

// Factory to allow environment-based tweaks if ever needed
export const createEnvelopeSchema = () =>
  z
    .object({
      commandId: idString,
      groupId: idString,
      kind: typeString.optional(),
      type: typeString.optional(), // alias for backward compatibility
      payload: z.unknown(), // existence check only
      issuedAt: z.number(),
      sourceViewId: z.string().max(SOURCE_VIEW_ID_MAX).optional(),
      onNameConflict: z.enum(['error', 'auto-rename']).optional(),
      meta: z
        .object({
          commandId: idString.optional(),
          timestamp: z.number().optional(),
          userId: z.string().optional(),
          correlationId: z.string().optional(),
        })
        .optional(),
    })
    .refine((v) => Boolean(v.kind ?? v.type), {
      message: 'Either kind or type is required',
      path: ['kind'],
    })
    .passthrough();

export type EnvelopeInput = unknown;

export type ValidationSuccess<TType extends string = string, TPayload = unknown> = {
  ok: true;
  envelope: CommandEnvelope<TType, TPayload>;
};

export type ValidationFailure = {
  ok: false;
  error: string;
};

// Strict parse + normalization: ensure `kind` exists, preserve alias `type` for compatibility.
export function validateAndNormalizeEnvelope(
  envelope: EnvelopeInput
): ValidationSuccess | ValidationFailure {
  try {
    const schema = createEnvelopeSchema();
    const parsed = schema.parse(envelope) as Partial<CommandEnvelope<string, unknown>>;

    const normalized: CommandEnvelope<string, unknown> = {
      ...(parsed as any),
      kind: (parsed.kind ?? parsed.type) as string,
      type: (parsed.type ?? parsed.kind) as string,
    } as CommandEnvelope<string, unknown>;

    return { ok: true, envelope: normalized };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Invalid envelope';
    return { ok: false, error: message.replace(/[\r\n\t]/g, ' ').slice(0, 200) };
  }
}
