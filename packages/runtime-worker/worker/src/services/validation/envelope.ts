import { z } from 'zod';
import type { CommandEnvelope } from '../command-types';

// ZE-1: Minimal skeleton only. Full rules in ZE-2.

// Factory to allow later environment-based tweaks if needed
export const createEnvelopeSchema = () =>
  z
    .object({
      // At this stage keep fields optional to avoid breaking callers.
      // ZE-2 will tighten requirements and add normalization.
      commandId: z.string().optional(),
      groupId: z.string().optional(),
      kind: z.string().optional(),
      type: z.string().optional(), // alias for backward compatibility
      payload: z.unknown().optional(),
      issuedAt: z.number().optional(),
      sourceViewId: z.string().optional(),
      onNameConflict: z.enum(['error', 'auto-rename']).optional(),
      meta: z
        .object({
          commandId: z.string().optional(),
          timestamp: z.number().optional(),
          userId: z.string().optional(),
          correlationId: z.string().optional(),
        })
        .optional(),
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

// For ZE-1 we do a permissive parse and pass-through; ZE-2 adds real checks.
export function validateAndNormalizeEnvelope(
  envelope: EnvelopeInput
): ValidationSuccess | ValidationFailure {
  try {
    const schema = createEnvelopeSchema();
    const parsed = schema.parse(envelope) as CommandEnvelope<string, unknown>;

    // Minimal normalization: if only `type` is present, mirror to `kind`.
    const normalized: CommandEnvelope<string, unknown> = {
      ...parsed,
      kind: (parsed as any).kind ?? (parsed as any).type,
      type: (parsed as any).type ?? (parsed as any).kind,
    };

    return { ok: true, envelope: normalized };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Invalid envelope';
    return { ok: false, error: message };
  }
}

