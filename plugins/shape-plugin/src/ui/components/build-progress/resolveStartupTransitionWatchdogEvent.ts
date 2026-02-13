export const START_DIAGNOSTIC_WARN_MS = 10_000;
export const START_DIAGNOSTIC_LONG_WAIT_MS = 20_000;
export const START_DIAGNOSTIC_TIMEOUT_MS = 45_000;

export type BuildStartupTransitionWarnStep = 0 | 1 | 2 | 3;

export type StartupTransitionWatchdogEventKind =
  | 'none'
  | 'wait'
  | 'long-wait'
  | 'timeout';

export type StartupTransitionWatchdogEvent = {
  kind: StartupTransitionWatchdogEventKind;
  nextWarnStep: BuildStartupTransitionWarnStep;
};

export type ResolveStartupTransitionWatchdogEventInput = {
  elapsedMs: number;
  warnStep: BuildStartupTransitionWarnStep;
};

export const resolveStartupTransitionWatchdogEvent = (
  input: ResolveStartupTransitionWatchdogEventInput,
): StartupTransitionWatchdogEvent => {
  if (input.elapsedMs >= START_DIAGNOSTIC_TIMEOUT_MS && input.warnStep < 3) {
    return {
      kind: 'timeout',
      nextWarnStep: 3,
    };
  }
  if (input.elapsedMs >= START_DIAGNOSTIC_LONG_WAIT_MS && input.warnStep < 2) {
    return {
      kind: 'long-wait',
      nextWarnStep: 2,
    };
  }
  if (input.elapsedMs >= START_DIAGNOSTIC_WARN_MS && input.warnStep < 1) {
    return {
      kind: 'wait',
      nextWarnStep: 1,
    };
  }
  return {
    kind: 'none',
    nextWarnStep: input.warnStep,
  };
};
