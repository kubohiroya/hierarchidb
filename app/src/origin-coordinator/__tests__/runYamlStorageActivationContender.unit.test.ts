import {
  createYamlStorageFreshActivation,
  reduceYamlStorageActivation,
  type YamlStoragePreflightState,
} from '@hierarchidb/runtime-worker/yaml-storage-activation';
import { describe, expect, it, vi } from 'vitest';
import { runYamlStorageActivationContender } from '../runYamlStorageActivationContender.js';
import type { OriginCoordinatorClientHandle } from '../types.js';

function identities(prefix: string): () => string {
  let index = 0;
  return () => `${prefix}-${++index}`;
}

function coordinator(
  startQuiescence: OriginCoordinatorClientHandle['startQuiescence']
): OriginCoordinatorClientHandle {
  return {
    getReadiness: vi.fn(),
    startQuiescence,
    getQuiescenceStatus: vi.fn(),
  };
}

describe('runYamlStorageActivationContender', () => {
  it('starts CoreDB preflight only for exact ready-for-preflight identity', async () => {
    const startQuiescence = vi.fn(async (input) => ({
      type: 'HDB_COORDINATOR_QUIESCENCE_RESULT' as const,
      protocolVersion: 2 as const,
      status: 'ready-for-preflight' as const,
      activationId: input.activationId,
      quiescenceRequestId: input.quiescenceRequestId,
      actualFenceEstablished: false as const,
      progress: { participantCount: 2, acknowledgedCount: 2, discardedCount: 0 },
    }));
    const activateCoreDb = vi.fn(
      async (input: {
        state: YamlStoragePreflightState;
        migrationId: string;
        openRequestId: string;
      }) => {
        let state = reduceYamlStorageActivation(input.state, {
          type: 'preflight-completed',
          activationId: input.state.activationId,
          openRequestId: input.openRequestId,
        });
        state = reduceYamlStorageActivation(state, {
          type: 'versionchange-started',
          activationId: state.activationId,
          openRequestId: input.openRequestId,
        });
        state = reduceYamlStorageActivation(state, {
          type: 'upgrade-committed',
          activationId: state.activationId,
          openRequestId: input.openRequestId,
        });
        state = reduceYamlStorageActivation(state, {
          type: 'initialization-succeeded',
          activationId: state.activationId,
          openRequestId: input.openRequestId,
        });
        if (state.phase !== 'canonical-ready') throw new Error('test-state-failed');
        return { ok: true as const, state };
      }
    );

    const state = await runYamlStorageActivationContender({
      coordinator: coordinator(startQuiescence),
      quiescenceTimeoutMs: 30_000,
      createIdentity: identities('winner'),
      activateCoreDb,
    });

    expect(state.readinessProof).toBe('same-activation-upgrade');
    expect(startQuiescence).toHaveBeenCalledOnce();
    expect(activateCoreDb).toHaveBeenCalledOnce();
    expect(activateCoreDb).toHaveBeenCalledWith(
      expect.objectContaining({
        migrationId: 'winner-3',
        openRequestId: 'winner-4',
      })
    );
  });

  it('performs zero storage work for an identity-mismatch loser', async () => {
    const activateCoreDb = vi.fn();

    await expect(
      runYamlStorageActivationContender({
        coordinator: coordinator(async () => ({
          type: 'HDB_COORDINATOR_QUIESCENCE_RESULT',
          protocolVersion: 2,
          status: 'request-rejected',
          actualFenceEstablished: false,
          code: 'QUIESCENCE_IDENTITY_MISMATCH',
        })),
        quiescenceTimeoutMs: 30_000,
        createIdentity: identities('loser'),
        activateCoreDb,
      })
    ).rejects.toMatchObject({ code: 'QUIESCENCE_NOT_READY' });

    expect(activateCoreDb).not.toHaveBeenCalled();
  });

  it('accepts same-activation fresh-create readiness evidence', async () => {
    const startQuiescence = vi.fn(async (input) => ({
      type: 'HDB_COORDINATOR_QUIESCENCE_RESULT' as const,
      protocolVersion: 2 as const,
      status: 'ready-for-preflight' as const,
      activationId: input.activationId,
      quiescenceRequestId: input.quiescenceRequestId,
      actualFenceEstablished: false as const,
      progress: { participantCount: 1, acknowledgedCount: 1, discardedCount: 0 },
    }));
    const activateCoreDb = vi.fn(
      async (input: {
        state: YamlStoragePreflightState;
        migrationId: string;
        openRequestId: string;
      }) => {
        const created = createYamlStorageFreshActivation({
          activationId: input.state.activationId,
          targetVersion: 2,
        });
        if (!created.ok) throw new Error('fresh-test-state-create-failed');
        let state = reduceYamlStorageActivation(created.state, {
          type: 'quiescing-completed',
          activationId: created.state.activationId,
        });
        state = reduceYamlStorageActivation(state, {
          type: 'preflight-completed',
          activationId: state.activationId,
          openRequestId: input.openRequestId,
        });
        state = reduceYamlStorageActivation(state, {
          type: 'versionchange-started',
          activationId: state.activationId,
          openRequestId: input.openRequestId,
        });
        state = reduceYamlStorageActivation(state, {
          type: 'upgrade-committed',
          activationId: state.activationId,
          openRequestId: input.openRequestId,
        });
        state = reduceYamlStorageActivation(state, {
          type: 'initialization-succeeded',
          activationId: state.activationId,
          openRequestId: input.openRequestId,
        });
        if (state.phase !== 'canonical-ready') throw new Error('fresh-test-state-failed');
        return { ok: true as const, state };
      }
    );

    const state = await runYamlStorageActivationContender({
      coordinator: coordinator(startQuiescence),
      quiescenceTimeoutMs: 30_000,
      createIdentity: identities('fresh'),
      activateCoreDb,
    });

    expect(state.readinessProof).toBe('same-activation-fresh-create');
  });

  it('rejects duplicate or unavailable identities before coordinator access', async () => {
    const startQuiescence = vi.fn();
    const activateCoreDb = vi.fn();

    await expect(
      runYamlStorageActivationContender({
        coordinator: coordinator(startQuiescence),
        quiescenceTimeoutMs: 30_000,
        createIdentity: () => 'duplicate',
        activateCoreDb,
      })
    ).rejects.toMatchObject({ code: 'CRYPTO_IDENTITY_INVALID' });

    expect(startQuiescence).not.toHaveBeenCalled();
    expect(activateCoreDb).not.toHaveBeenCalled();
  });
});
