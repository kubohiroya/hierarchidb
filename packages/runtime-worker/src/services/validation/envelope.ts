import type { CommandEnvelope, CommandMeta } from '~/services/command-types';

// Common constraints (kept consistent with previous zod-based checks)
const ID_MAX = 100;
const TYPE_MAX = 64;
const SOURCE_VIEW_ID_MAX = 128;

function isNonEmptyString(v: unknown, max: number): v is string {
  return typeof v === 'string' && v.length > 0 && v.length <= max;
}

const TYPE_RE = /^[A-Za-z0-9_-]+$/; // alnum, dash, underscore
function isTypeString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0 && v.length <= TYPE_MAX && TYPE_RE.test(v);
}

export type EnvelopeInput = unknown;

export type ValidationSuccess<TType extends string = string, TPayload = unknown> = {
  ok: true;
  envelope: CommandEnvelope<TType, TPayload>;
};

export type ValidationFailure = {
  ok: false;
  error: string;
};

export function isValidationFailure(
  x: ValidationSuccess | ValidationFailure
): x is ValidationFailure {
  return x?.ok === false;
}

export function isValidationSuccess<TType extends string = string, TPayload = unknown>(
  x: ValidationSuccess<TType, TPayload> | ValidationFailure
): x is ValidationSuccess<TType, TPayload> {
  return x?.ok === true;
}

// Strict parse + normalization: ensure `kind` exists, preserve alias `type` for compatibility.
export function validateAndNormalizeEnvelope(
  envelope: EnvelopeInput
): ValidationSuccess | ValidationFailure {
  const obj = envelope as Record<string, unknown>;
  if (!obj || typeof obj !== 'object') {
    return { ok: false, error: 'Envelope must be an object' };
  }
  // required fields (basic existence/type checks)
  if (!isNonEmptyString(obj.commandId, ID_MAX)) {
    return { ok: false, error: 'Invalid commandId' };
  }
  if (!isNonEmptyString(obj.groupId, ID_MAX)) {
    return { ok: false, error: 'Invalid groupId' };
  }
  const kind = obj.kind ?? obj.type;
  if (!isTypeString(kind)) {
    return {
      ok: false,
      error: 'Either kind or type is required and must be alnum/dash/underscore',
    };
  }
  if (typeof obj.issuedAt !== 'number') {
    return { ok: false, error: 'issuedAt must be a number' };
  }
  if (!('payload' in obj)) {
    return { ok: false, error: 'payload is required' };
  }
  if (obj.sourceViewId !== undefined && !isNonEmptyString(obj.sourceViewId, SOURCE_VIEW_ID_MAX)) {
    return { ok: false, error: 'sourceViewId too long or invalid' };
  }
  if (
    obj.onNameConflict !== undefined &&
    obj.onNameConflict !== 'error' &&
    obj.onNameConflict !== 'auto-rename' &&
    obj.onNameConflict !== 'overwrite'
  ) {
    return { ok: false, error: 'onNameConflict must be "error", "auto-rename", or "overwrite"' };
  }
  // meta (optional)
  if (obj.meta !== undefined) {
    const meta = obj.meta as Record<string, unknown>;
    if (typeof meta !== 'object') {
      return { ok: false, error: 'meta must be an object when provided' };
    }
    if (meta.commandId !== undefined && !isNonEmptyString(meta.commandId, ID_MAX)) {
      return { ok: false, error: 'meta.commandId invalid' };
    }
    if (meta.timestamp !== undefined && typeof meta.timestamp !== 'number') {
      return { ok: false, error: 'meta.timestamp must be a number' };
    }
    if (meta.userId !== undefined && typeof meta.userId !== 'string') {
      return { ok: false, error: 'meta.userId must be a string' };
    }
    if (meta.correlationId !== undefined && typeof meta.correlationId !== 'string') {
      return { ok: false, error: 'meta.correlationId must be a string' };
    }
  }

  const metaSource = obj.meta as Record<string, unknown> | undefined;
  const resolvedType = isTypeString(obj.type) ? obj.type : kind;
  let normalizedMeta: CommandMeta | undefined;
  if (metaSource) {
    normalizedMeta = {
      commandId:
        typeof metaSource.commandId === 'string' && metaSource.commandId.length > 0
          ? metaSource.commandId
          : (obj.commandId as string),
      timestamp:
        typeof metaSource.timestamp === 'number' ? metaSource.timestamp : (obj.issuedAt as number),
      userId: typeof metaSource.userId === 'string' ? metaSource.userId : undefined,
      correlationId:
        typeof metaSource.correlationId === 'string' ? metaSource.correlationId : undefined,
    };
  }

  const normalized: CommandEnvelope<string, unknown> = {
    commandId: obj.commandId as string,
    groupId: obj.groupId as string,
    kind: kind as string,
    payload: obj.payload,
    issuedAt: obj.issuedAt as number,
    sourceViewId: typeof obj.sourceViewId === 'string' ? obj.sourceViewId : undefined,
    onNameConflict: obj.onNameConflict as 'error' | 'auto-rename' | 'overwrite' | undefined,
    type: resolvedType,
    meta: normalizedMeta,
  };

  return { ok: true, envelope: normalized };
}

// Minimal schema-like factory for tests compatibility (zod-less).
// Returns an object exposing parse/safeParse with equivalent validations.
export function createEnvelopeSchema() {
  return {
    parse(input: unknown) {
      const r = validateAndNormalizeEnvelope(input);
      if (isValidationFailure(r)) {
        throw new Error(r.error);
      }
      // return normalized envelope (like zod.parse would do)
      return r.envelope;
    },
    safeParse(input: unknown) {
      const r = validateAndNormalizeEnvelope(input);
      if (isValidationFailure(r)) {
        return { success: false, error: r.error };
      }
      return { success: true, data: r.envelope };
    },
  } as const;
}
