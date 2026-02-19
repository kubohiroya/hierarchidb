import { describe, expect, it } from 'vitest';
import {
  resolveStartupTransitionWatchdogEvent,
  START_DIAGNOSTIC_LONG_WAIT_MS,
  START_DIAGNOSTIC_TIMEOUT_MS,
  START_DIAGNOSTIC_WARN_MS,
} from '~/ui/components/build-progress/resolveStartupTransitionWatchdogEvent';

describe('resolveStartupTransitionWatchdogEvent', () => {
  it('returns wait when warn threshold is reached first time', () => {
    const event = resolveStartupTransitionWatchdogEvent({
      elapsedMs: START_DIAGNOSTIC_WARN_MS,
      warnStep: 0,
    });
    expect(event).toEqual({
      kind: 'wait',
      nextWarnStep: 1,
    });
  });

  it('returns long-wait when long threshold is reached after wait', () => {
    const event = resolveStartupTransitionWatchdogEvent({
      elapsedMs: START_DIAGNOSTIC_LONG_WAIT_MS,
      warnStep: 1,
    });
    expect(event).toEqual({
      kind: 'long-wait',
      nextWarnStep: 2,
    });
  });

  it('returns timeout when timeout threshold is reached after long-wait', () => {
    const event = resolveStartupTransitionWatchdogEvent({
      elapsedMs: START_DIAGNOSTIC_TIMEOUT_MS,
      warnStep: 2,
    });
    expect(event).toEqual({
      kind: 'timeout',
      nextWarnStep: 3,
    });
  });

  it('returns none when timeout already emitted', () => {
    const event = resolveStartupTransitionWatchdogEvent({
      elapsedMs: START_DIAGNOSTIC_TIMEOUT_MS + 1000,
      warnStep: 3,
    });
    expect(event).toEqual({
      kind: 'none',
      nextWarnStep: 3,
    });
  });
});
