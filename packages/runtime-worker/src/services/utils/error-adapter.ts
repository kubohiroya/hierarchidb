import { PERFORMANCE_CONFIG } from '../../utils/performance-config.js';
import type { WorkerErrorCode } from '../command-types.js';
import { WorkerErrorCodeValue } from '../command-types.js';

const KNOWN_CODES = new Set<WorkerErrorCode>(Object.values(WorkerErrorCodeValue));
const DATABASE_ERROR_NAMES = new Set([
  'ConstraintError',
  'ModifyError',
  'BulkError',
  'DexieError',
  'InvalidStateError',
]);
const VALIDATION_ERROR_NAMES = new Set(['ZodError', 'ValidationError']);

export type WorkerErrorClassification = {
  code: WorkerErrorCode;
  message: string;
};

/**
 * Normalize error text so that logs/results never leak long or multi-line content.
 */
export function sanitizeMessageText(
  input: unknown,
  fallback = 'An unexpected error occurred'
): string {
  const raw = extractRawMessage(input);
  const collapsed = raw
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (!collapsed) {
    return fallback;
  }
  return collapsed.slice(0, PERFORMANCE_CONFIG.MAX_ERROR_MESSAGE_LENGTH);
}

/**
 * Map thrown errors or rejection reasons to WorkerErrorCode/Message pairs.
 * The heuristics intentionally stay conservative; unknown cases fall back to the provided code.
 */
export function classifyWorkerError(
  error: unknown,
  fallback: WorkerErrorCode = WorkerErrorCodeValue.UNKNOWN_ERROR
): WorkerErrorClassification {
  const message = sanitizeMessageText(error);

  const directCode = extractCodeFromError(error);
  if (directCode) {
    return { code: directCode, message };
  }

  const name = extractNameFromError(error);
  if (name) {
    if (DATABASE_ERROR_NAMES.has(name)) {
      return { code: WorkerErrorCodeValue.DATABASE_ERROR, message };
    }
    if (VALIDATION_ERROR_NAMES.has(name)) {
      return { code: WorkerErrorCodeValue.VALIDATION_ERROR, message };
    }
  }

  if (/draft|working copy/i.test(message)) {
    return { code: WorkerErrorCodeValue.WORKING_COPY_NOT_FOUND, message };
  }

  if (/name (conflict|already exists|must be unique)/i.test(message)) {
    return { code: WorkerErrorCodeValue.NAME_NOT_UNIQUE, message };
  }

  if (/commit conflict|version conflict/i.test(message)) {
    return { code: WorkerErrorCodeValue.COMMIT_CONFLICT, message };
  }

  if (/validation|invalid/i.test(message)) {
    return { code: WorkerErrorCodeValue.VALIDATION_ERROR, message };
  }

  if (/not found/i.test(message)) {
    return { code: WorkerErrorCodeValue.NODE_NOT_FOUND, message };
  }

  if (/dexie|indexeddb|database|constraint/i.test(message)) {
    return { code: WorkerErrorCodeValue.DATABASE_ERROR, message };
  }

  return { code: fallback, message };
}

function extractRawMessage(input: unknown): string {
  if (typeof input === 'string') {
    return input;
  }
  if (input instanceof Error) {
    return input.message ?? '';
  }
  if (typeof input === 'object' && input !== null && 'message' in input) {
    const candidate = (input as { message?: unknown }).message;
    if (typeof candidate === 'string') {
      return candidate;
    }
  }
  return '';
}

function extractCodeFromError(error: unknown): WorkerErrorCode | null {
  if (!error || typeof error !== 'object') {
    return null;
  }
  if ('code' in error) {
    const raw = (error as { code?: unknown }).code;
    if (typeof raw === 'string') {
      const upper = raw.toUpperCase() as WorkerErrorCode;
      if (KNOWN_CODES.has(upper)) {
        return upper;
      }
    }
  }
  if ('errorCode' in error) {
    const raw = (error as { errorCode?: unknown }).errorCode;
    if (typeof raw === 'string') {
      const upper = raw.toUpperCase() as WorkerErrorCode;
      if (KNOWN_CODES.has(upper)) {
        return upper;
      }
    }
  }
  return null;
}

function extractNameFromError(error: unknown): string | null {
  if (!error || typeof error !== 'object') {
    return null;
  }
  if ('name' in error) {
    const raw = (error as { name?: unknown }).name;
    if (typeof raw === 'string') {
      return raw;
    }
  }
  if (error instanceof Error && typeof error.name === 'string') {
    return error.name;
  }
  return null;
}
