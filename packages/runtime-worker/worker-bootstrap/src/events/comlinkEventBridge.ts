/**
 * Comlink Event Bridge Helpers
 *
 * Provides generic wrappers for event listener payloads flowing between
 * UI, runtime worker, and stage worker layers. Each hop can specify its own
 * payload shape via generics while reusing the same listener plumbing.
 */

import { proxy, type ProxyMarked } from 'comlink';

export type EventListener<TEvent> = (event: TEvent) => void;
export type RemoteEventListener<TEvent> = EventListener<TEvent> & ProxyMarked;

export type EventTransformer<TInput, TOutput> = (event: TInput) => TOutput;

export interface ComlinkEventBridge<
  TUiEvent,
  TRuntimeEvent = TUiEvent,
  TWorkerEvent = TRuntimeEvent,
> {
  createUiProxy(listener: EventListener<TUiEvent>): RemoteEventListener<TRuntimeEvent>;
  toUiListener(listener: EventListener<TUiEvent>): EventListener<TRuntimeEvent>;
  toRuntimeListener(listener: EventListener<TRuntimeEvent>): EventListener<TWorkerEvent>;
}

export interface ComlinkEventBridgeOptions<TRuntimeEvent, TUiEvent, TWorkerEvent> {
  runtimeToUi?: EventTransformer<TRuntimeEvent, TUiEvent>;
  workerToRuntime?: EventTransformer<TWorkerEvent, TRuntimeEvent>;
}

export function createComlinkEventBridge<
  TUiEvent,
  TRuntimeEvent = TUiEvent,
  TWorkerEvent = TRuntimeEvent,
>(
  options: ComlinkEventBridgeOptions<TRuntimeEvent, TUiEvent, TWorkerEvent> = {},
): ComlinkEventBridge<TUiEvent, TRuntimeEvent, TWorkerEvent> {
  const { runtimeToUi, workerToRuntime } = options;

  const adaptRuntimeToUi = (event: TRuntimeEvent): TUiEvent => {
    return runtimeToUi ? runtimeToUi(event) : (event as unknown as TUiEvent);
  };

  const adaptWorkerToRuntime = (event: TWorkerEvent): TRuntimeEvent => {
    return workerToRuntime ? workerToRuntime(event) : (event as unknown as TRuntimeEvent);
  };

  const createUiProxy = (listener: EventListener<TUiEvent>): RemoteEventListener<TRuntimeEvent> => {
    return proxy((event: TRuntimeEvent) => {
      listener(adaptRuntimeToUi(event));
    });
  };

  const toUiListener = (listener: EventListener<TUiEvent>): EventListener<TRuntimeEvent> => {
    return (event: TRuntimeEvent) => {
      listener(adaptRuntimeToUi(event));
    };
  };

  const toRuntimeListener = (listener: EventListener<TRuntimeEvent>): EventListener<TWorkerEvent> => {
    return (event: TWorkerEvent) => {
      listener(adaptWorkerToRuntime(event));
    };
  };

  return {
    createUiProxy,
    toUiListener,
    toRuntimeListener,
  };
}

export type PhaseEventMap = Record<string, unknown>;

export type PhaseEvent<M extends PhaseEventMap, K extends keyof M = keyof M> = {
  phase: K;
  payload: M[K];
  timestamp: number;
};
