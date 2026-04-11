// Type-safe envelope creator that infers the payload type from the command kind.
// Keeps the runtime-worker behavior unchanged; this is a typing utility only.

import type { Timestamp } from '@hierarchidb/core-types';
import type { CommandEnvelope, CommandKind, EnvelopeInit, PayloadOf } from './registryTypes.js';

type CryptoLike = { randomUUID?: () => string };

function randomId(prefix: string): string {
  const cryptoObj: CryptoLike | undefined =
    typeof globalThis === 'object' && globalThis && 'crypto' in globalThis
      ? (globalThis as typeof globalThis & { crypto?: CryptoLike }).crypto
      : undefined;
  if (cryptoObj?.randomUUID) {
    return cryptoObj.randomUUID();
  }
  //  Fallback sufficient for non-crypto use (tests/dev only)
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createEnvelope<K extends CommandKind>(
  kind: K,
  payload: PayloadOf<K>,
  init?: EnvelopeInit
): CommandEnvelope<K> {
  const issuedAt = (init?.issuedAt ?? Date.now()) as Timestamp;
  const envelope: CommandEnvelope<K> = {
    commandId: init?.commandId ?? randomId('cmd'),
    groupId: init?.groupId ?? randomId('grp'),
    kind,
    payload,
    issuedAt,
    ...(init?.sourceViewId ? { sourceViewId: init.sourceViewId } : {}),
  };
  return envelope;
}
