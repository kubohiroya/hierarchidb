import { describe, expect, it } from 'vitest';
import { createYamlStoragePostActivationReady } from '../createYamlStoragePostActivationReady.js';
import {
  getYamlStorageAccessDecision,
  isYamlStorageActualFenceEstablished,
} from '../getYamlStorageAccessDecision.js';

function validInput(): Record<string, unknown> {
  return {
    activationId: 'activation-v2',
    currentVersion: 2,
    targetVersion: 2,
    openRequestId: 'canonical-open-1',
    coordinatorGate: 'revoked-ready-for-preflight',
    schemaValidated: true,
    canonicalSnapshotValidated: true,
    initializationSucceeded: true,
  };
}

describe('createYamlStoragePostActivationReady', () => {
  it('issues an immutable canonical-ready state from complete evidence', () => {
    const result = createYamlStoragePostActivationReady(validInput());

    expect(result).toEqual({
      ok: true,
      state: {
        phase: 'canonical-ready',
        activationId: 'activation-v2',
        currentVersion: 2,
        targetVersion: 2,
        openRequestId: 'canonical-open-1',
        upgradeCommitted: true,
        initializationSucceeded: true,
        readinessProof: 'post-activation-boot',
      },
    });
    if (result.ok === false) throw new Error(result.error.code);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.state)).toBe(true);
    expect(isYamlStorageActualFenceEstablished(result.state)).toBe(true);
    expect(
      getYamlStorageAccessDecision(result.state, {
        domain: 'runtime',
        representation: 'canonical',
        operation: 'query',
      })
    ).toEqual({ allowed: true, code: 'CANONICAL_READY' });
  });

  it.each([
    ['empty activation ID', { activationId: '' }],
    ['empty open request ID', { openRequestId: '' }],
    ['version mismatch', { currentVersion: 1 }],
    ['future version mismatch', { targetVersion: 3 }],
    ['wrong gate', { coordinatorGate: 'allowed' }],
    ['unvalidated schema', { schemaValidated: false }],
    ['unvalidated snapshot', { canonicalSnapshotValidated: false }],
    ['failed initialization', { initializationSucceeded: false }],
    ['extra field', { extra: true }],
  ])('rejects %s without issuing a state', (_label, patch) => {
    const result = createYamlStoragePostActivationReady({ ...validInput(), ...patch });

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'INVALID_POST_ACTIVATION_EVIDENCE',
        stage: 'post-activation-boot',
      },
    });
    if (result.ok === true) throw new Error('expected invalid post-activation evidence');
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.error)).toBe(true);
  });

  it('does not invoke accessors and redacts reflection failures', () => {
    let getterCalled = false;
    const accessorInput = validInput();
    Object.defineProperty(accessorInput, 'schemaValidated', {
      enumerable: true,
      get() {
        getterCalled = true;
        throw new Error('post-activation-secret');
      },
    });
    const proxyInput = new Proxy(validInput(), {
      ownKeys() {
        throw new Error('post-activation-proxy-secret');
      },
    });

    for (const input of [accessorInput, proxyInput]) {
      const result = createYamlStoragePostActivationReady(input);
      expect(result).toEqual({
        ok: false,
        error: {
          code: 'INVALID_POST_ACTIVATION_EVIDENCE',
          stage: 'post-activation-boot',
        },
      });
      expect(JSON.stringify(result)).not.toContain('secret');
    }
    expect(getterCalled).toBe(false);
  });
});
