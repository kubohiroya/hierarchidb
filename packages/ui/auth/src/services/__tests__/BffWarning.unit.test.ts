import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BFF_WARNING_EVENT,
  type BffWarning,
  isBffWarning,
  maybeEmitBffWarning,
  readWarningFromResponse,
} from '../BffWarning.js';

const validWarning: BffWarning = {
  code: 'kv_unavailable',
  operation: 'refresh',
  action: 'relogin',
  reason: 'missing_kv',
};

describe('BffWarning', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(['login', 'refresh', 'revoke', 'logout'] as const)(
    'accepts the documented operation: %s',
    (operation) => {
      expect(isBffWarning({ ...validWarning, operation })).toBe(true);
    }
  );

  it.each(['none', 'relogin'] as const)('accepts the documented action: %s', (action) => {
    expect(isBffWarning({ ...validWarning, action })).toBe(true);
  });

  it.each(['missing_kv', 'kv_error'] as const)('accepts the documented reason: %s', (reason) => {
    expect(isBffWarning({ ...validWarning, reason })).toBe(true);
  });

  it.each([
    null,
    undefined,
    {},
    { ...validWarning, code: 'other_warning' },
    { ...validWarning, operation: 'unknown-operation' },
    { ...validWarning, operation: 1 },
    { ...validWarning, action: 'ignore' },
    { ...validWarning, action: false },
    { ...validWarning, reason: 'quota' },
    { ...validWarning, reason: [] },
  ])('rejects an invalid warning payload: %j', (value) => {
    expect(isBffWarning(value)).toBe(false);
  });

  it('emits the warning event only for a valid payload', () => {
    const listener = vi.fn();
    window.addEventListener(BFF_WARNING_EVENT, listener);

    expect(maybeEmitBffWarning(validWarning)).toEqual(validWarning);
    expect(maybeEmitBffWarning({ ...validWarning, action: 'ignore' })).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);

    const emittedEvent = listener.mock.calls[0]?.[0] as CustomEvent<BffWarning> | undefined;
    expect(emittedEvent?.detail).toEqual(validWarning);

    window.removeEventListener(BFF_WARNING_EVENT, listener);
  });

  it('reads and emits a valid warning from a JSON response', async () => {
    const listener = vi.fn();
    window.addEventListener(BFF_WARNING_EVENT, listener);
    const response = Response.json({ warning: validWarning });

    await expect(readWarningFromResponse(response)).resolves.toEqual(validWarning);
    expect(listener).toHaveBeenCalledTimes(1);

    window.removeEventListener(BFF_WARNING_EVENT, listener);
  });

  it('rejects an invalid warning from a JSON response', async () => {
    const listener = vi.fn();
    window.addEventListener(BFF_WARNING_EVENT, listener);
    const response = Response.json({
      warning: { ...validWarning, reason: 'unknown-reason' },
    });

    await expect(readWarningFromResponse(response)).resolves.toBeNull();
    expect(listener).not.toHaveBeenCalled();

    window.removeEventListener(BFF_WARNING_EVENT, listener);
  });
});
