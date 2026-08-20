import { describe, expect, it } from 'vitest';
import { parseAuthSessionConfig } from '../src/utils/parseAuthSessionConfig.js';

describe('parseAuthSessionConfig', () => {
  it.each(['persistent', 'stateless'] as const)('accepts the documented mode: %s', (mode) => {
    expect(
      parseAuthSessionConfig({ AUTH_SESSION_MODE: mode, SESSION_DURATION_HOURS: '4' })
    ).toEqual({ mode, durationHours: 4 });
  });

  it.each([undefined, '', 'automatic', 'PERSISTENT'])('rejects an invalid mode: %s', (mode) => {
    expect(() =>
      parseAuthSessionConfig({ AUTH_SESSION_MODE: mode, SESSION_DURATION_HOURS: '4' })
    ).toThrow('AUTH_SESSION_MODE must be either persistent or stateless');
  });

  it.each([undefined, '', '0', '-1', '1.5', 'four', ' 4', '4 '])(
    'rejects an invalid duration: %s',
    (duration) => {
      expect(() =>
        parseAuthSessionConfig({
          AUTH_SESSION_MODE: 'stateless',
          SESSION_DURATION_HOURS: duration,
        })
      ).toThrow('SESSION_DURATION_HOURS must be a positive integer');
    }
  );

  it('rejects a duration whose seconds exceed the safe integer range', () => {
    expect(() =>
      parseAuthSessionConfig({
        AUTH_SESSION_MODE: 'stateless',
        SESSION_DURATION_HOURS: Number.MAX_SAFE_INTEGER.toString(),
      })
    ).toThrow('SESSION_DURATION_HOURS must be a safe positive integer');
  });
});
