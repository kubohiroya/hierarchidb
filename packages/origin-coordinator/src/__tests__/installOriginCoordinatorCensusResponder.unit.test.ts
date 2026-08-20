import { describe, expect, it, vi } from 'vitest';
import {
  ORIGIN_COORDINATOR_FOUNDATION_CAPABILITY,
  ORIGIN_COORDINATOR_PROTOCOL_VERSION,
} from '../constants.js';
import { installOriginCoordinatorCensusResponder } from '../installOriginCoordinatorCensusResponder.js';
import type { OriginCoordinatorMessageTarget } from '../types.js';

const RELEASE_ID = '0123456789abcdef0123456789abcdef01234567';

interface ResponderHarness {
  readonly target: OriginCoordinatorMessageTarget;
  dispatch(data: unknown, port: MessagePort): void;
}

function createHarness(): ResponderHarness {
  let listener: ((event: MessageEvent<unknown>) => void) | null = null;
  return {
    target: {
      addEventListener(_type, nextListener): void {
        listener = nextListener;
      },
      removeEventListener(_type, currentListener): void {
        if (listener === currentListener) listener = null;
      },
    },
    dispatch(data, port): void {
      if (listener === null) throw new Error('responder-listener-missing');
      listener({ data, ports: [port] } as unknown as MessageEvent<unknown>);
    },
  };
}

describe('installOriginCoordinatorCensusResponder', () => {
  it('returns the exact capability and build release ID over the transferred port', async () => {
    const harness = createHarness();
    const remove = installOriginCoordinatorCensusResponder(harness.target, RELEASE_ID);
    const channel = new MessageChannel();
    const response = new Promise<unknown>((resolve) => {
      channel.port1.onmessage = (event: MessageEvent<unknown>) => resolve(event.data);
      channel.port1.start();
    });

    harness.dispatch(
      {
        type: 'HDB_COORDINATOR_CENSUS_PROBE',
        protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
        requestId: 'request-1',
      },
      channel.port2
    );

    await expect(response).resolves.toEqual({
      type: 'HDB_COORDINATOR_CENSUS_RESPONSE',
      protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
      requestId: 'request-1',
      releaseId: RELEASE_ID,
      capabilities: [ORIGIN_COORDINATOR_FOUNDATION_CAPABILITY],
    });
    remove();
    expect(() => harness.dispatch({}, channel.port2)).toThrow('responder-listener-missing');
    channel.port1.close();
  });

  it('ignores an extra probe field', () => {
    const harness = createHarness();
    installOriginCoordinatorCensusResponder(harness.target, RELEASE_ID);
    const postMessage = vi.fn();
    const close = vi.fn();

    harness.dispatch(
      {
        type: 'HDB_COORDINATOR_CENSUS_PROBE',
        protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
        requestId: 'request-1',
        legacyName: 'worker',
      },
      { postMessage, close } as unknown as MessagePort
    );

    expect(postMessage).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });

  it('rejects an accessor probe without invoking its getter', () => {
    const harness = createHarness();
    installOriginCoordinatorCensusResponder(harness.target, RELEASE_ID);
    let getterCalls = 0;
    const probe = {
      type: 'HDB_COORDINATOR_CENSUS_PROBE',
      protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
      requestId: 'request-1',
    };
    Object.defineProperty(probe, 'requestId', {
      enumerable: true,
      get: () => {
        getterCalls += 1;
        return 'request-1';
      },
    });
    const postMessage = vi.fn();

    harness.dispatch(probe, { postMessage, close: vi.fn() } as unknown as MessagePort);

    expect(getterCalls).toBe(0);
    expect(postMessage).not.toHaveBeenCalled();
  });
});
