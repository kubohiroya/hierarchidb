import { describe, expect, it, vi } from 'vitest';
import { requireOriginCoordinatorDedicatedWorkerTarget } from '../requireOriginCoordinatorDedicatedWorkerTarget.js';

const INVALID_TARGET_ERROR = 'origin-coordinator-invalid-dedicated-worker-target';

function createDedicatedWorkerTarget(): Record<PropertyKey, unknown> {
  const target: Record<PropertyKey, unknown> = {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    postMessage: vi.fn(),
  };
  target.self = target;
  return target;
}

describe('requireOriginCoordinatorDedicatedWorkerTarget', () => {
  it('returns the exact dedicated worker global after validating its transport', () => {
    const target = createDedicatedWorkerTarget();

    expect(requireOriginCoordinatorDedicatedWorkerTarget(target)).toBe(target);
  });

  it.each([
    ['missing target', undefined],
    [
      'missing self identity',
      { addEventListener: vi.fn(), removeEventListener: vi.fn(), postMessage: vi.fn() },
    ],
    [
      'mismatched self identity',
      {
        self: {},
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        postMessage: vi.fn(),
      },
    ],
    [
      'missing postMessage',
      (() => {
        const target = createDedicatedWorkerTarget();
        delete target.postMessage;
        return target;
      })(),
    ],
    [
      'window target',
      (() => {
        const target = createDedicatedWorkerTarget();
        target.document = {};
        return target;
      })(),
    ],
  ])('rejects %s with the stable contract error', (_label, target) => {
    expect(() => requireOriginCoordinatorDedicatedWorkerTarget(target)).toThrow(
      INVALID_TARGET_ERROR
    );
  });

  it('converts reflection failures to the stable contract error', () => {
    const target = new Proxy(createDedicatedWorkerTarget(), {
      get() {
        throw new Error('secret-reflection-error');
      },
    });

    expect(() => requireOriginCoordinatorDedicatedWorkerTarget(target)).toThrow(
      INVALID_TARGET_ERROR
    );
  });
});
