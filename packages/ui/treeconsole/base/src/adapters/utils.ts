/**
  * TreeConsole API
  * API
 * CommandEnvelopestring
  */

// Use native crypto.randomUUID() instead of uuid package
import type { CommandEnvelope, OnNameConflict, Timestamp } from '@hierarchidb/common-types';

/**
  * CommandEnvelope
  * CommandEnvelope
 * TreeObservableService.test.ts
  */
export function createCommand<K extends string, P>(
  kind: K,
  payload: P,
  options?: {
    groupId?: string;
    sourceViewId?: string;
    onNameConflict?: OnNameConflict;
  },
): CommandEnvelope<K, P> {
  return {
    commandId: crypto.randomUUID(),
    groupId: options?.groupId || crypto.randomUUID(),
    kind,
    payload,
    issuedAt: Date.now() as Timestamp,
    sourceViewId: options?.sourceViewId,
    onNameConflict: options?.onNameConflict || 'auto-rename',
  };
}

/**
  * string
  */
export function createAdapterGroupId(): string {
  return crypto.randomUUID();
}

export function createAdapterCommandId(): string {
  return crypto.randomUUID();
}

/**
    */
export function createTimestamp(): Timestamp {
  return Date.now() as Timestamp;
}
