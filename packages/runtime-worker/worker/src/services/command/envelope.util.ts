// Type-safe envelope creator that infers the payload type from the command kind.
// Keeps the runtime behavior unchanged; this is a typing utility only.

import type { Timestamp } from '@hierarchidb/common-type';
import type { CommandEnvelope, CommandKind, PayloadOf, EnvelopeInit } from './registry.types';

function randomId(prefix: string): string {
  const g: any = (globalThis as any);
  const cryptoObj = g?.crypto;
  if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
    return cryptoObj.randomUUID();
  }
  // Fallback – sufficient for non-crypto use (tests/dev only)
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createEnvelope<K extends CommandKind>(
  kind: K,
  payload: PayloadOf<K>,
  init?: EnvelopeInit
): CommandEnvelope<K> {
  const issuedAt = (init?.issuedAt ?? (Date.now() as unknown)) as Timestamp;
  return {
    commandId: init?.commandId ?? randomId('cmd'),
    groupId: init?.groupId ?? randomId('grp'),
    kind,
    payload,
    issuedAt,
    ...(init?.sourceViewId ? { sourceViewId: init.sourceViewId } : {}),
  } as CommandEnvelope<K>;
}

