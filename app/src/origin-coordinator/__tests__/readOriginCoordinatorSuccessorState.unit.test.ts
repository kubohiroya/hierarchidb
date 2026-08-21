import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readOriginCoordinatorSuccessorState } from '../readOriginCoordinatorSuccessorState.js';

const DATABASE_NAME = 'hierarchidb-origin-coordinator';
const STATE_STORE_NAME = 'coordinator-state';

const readyState = Object.freeze({
  key: 'yaml-storage',
  protocolVersion: 2,
  phase: 'revoked',
  status: 'ready-for-preflight',
  activationId: 'activation-1',
  quiescenceRequestId: 'quiescence-1',
  participants: Object.freeze([
    Object.freeze({ participantKind: 'tab', participantId: 'window-1' }),
  ]),
  evidence: Object.freeze([
    Object.freeze({
      participantKind: 'tab',
      participantId: 'window-1',
      outcome: 'acknowledged',
    }),
  ]),
});

const deleteDatabase = (): Promise<void> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DATABASE_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('coordinator-delete-failed'));
    request.onblocked = () => reject(new Error('coordinator-delete-blocked'));
  });

function createDatabase(version: number, state: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, version);
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore(STATE_STORE_NAME, { keyPath: 'key' });
      store.add(state);
    };
    request.onerror = () => reject(request.error ?? new Error('coordinator-open-failed'));
    request.onsuccess = () => {
      request.result.close();
      resolve();
    };
  });
}

describe('readOriginCoordinatorSuccessorState', () => {
  beforeEach(deleteDatabase);
  afterEach(deleteDatabase);

  it('returns only sanitized success for the exact revoked ready record', async () => {
    await createDatabase(2, readyState);

    await expect(readOriginCoordinatorSuccessorState(indexedDB)).resolves.toEqual({ ok: true });
  });

  it('rejects an active quiescence record', async () => {
    await createDatabase(2, { ...readyState, status: 'quiescing', evidence: [] });

    await expect(readOriginCoordinatorSuccessorState(indexedDB)).resolves.toEqual({ ok: false });
  });

  it('rejects a record with an extra property', async () => {
    await createDatabase(2, { ...readyState, legacyParticipantName: 'window-1' });

    await expect(readOriginCoordinatorSuccessorState(indexedDB)).resolves.toEqual({ ok: false });
  });

  it('rejects a version mismatch without upgrading the database', async () => {
    await createDatabase(1, { key: 'yaml-storage', protocolVersion: 1, phase: 'allowed' });

    await expect(readOriginCoordinatorSuccessorState(indexedDB)).resolves.toEqual({ ok: false });
    await expect(indexedDB.databases()).resolves.toEqual([
      expect.objectContaining({ name: DATABASE_NAME, version: 1 }),
    ]);
  });

  it('rejects a missing database without creating one', async () => {
    await expect(readOriginCoordinatorSuccessorState(indexedDB)).resolves.toEqual({ ok: false });
    const databases = await indexedDB.databases();
    expect(databases.some((database) => database.name === DATABASE_NAME)).toBe(false);
  });
});
