import type { BuildProgressAdapter, BuildProgressEvent, BuildProgressPayload, BuildUnifiedProgressInfo } from '@hierarchidb/build-api';

const assertFiniteNumber = (value: unknown, label: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`[progressEventToUnified] ${label} must be a finite number, received ${String(value)}`);
  }
  return value;
};

export function progressEventToUnified(event: BuildProgressEvent): BuildUnifiedProgressInfo {
  const payload = event.payload as BuildProgressPayload | undefined;
  if (!payload) {
    throw new Error(`[progressEventToUnified] event.payload is required but was absent (nodeId=${String(event.nodeId)}, stage=${String(event.stage)})`);
  }
  assertFiniteNumber(payload.total, 'payload.total');
  assertFiniteNumber(payload.completed, 'payload.completed');
  assertFiniteNumber(payload.failed, 'payload.failed');
  // Return the event as-is — BuildUnifiedProgressInfo is an alias for BuildProgressEvent.
  return event;
}

export function createAdapterFromProgressSubscribe(
  subscribeProgress: (cb: (event: BuildProgressEvent) => void) => (() => void) | Promise<() => void>,
): BuildProgressAdapter {
  return {
    subscribe: (consumer: (info: BuildUnifiedProgressInfo) => void) => {
      const wrapped = (event: BuildProgressEvent) => {
        consumer(progressEventToUnified(event));
      };
      return subscribeProgress(wrapped);
    },
  };
}
