import { proxy } from 'comlink';

export type EventListener<TEvent> = (event: TEvent) => void;
export type RemoteEventListener<TEvent> = EventListener<TEvent>;

export interface ComlinkEventBridgeOptions<TRuntimeEvent, TUiEvent, TWorkerEvent> {
  runtimeToUi?: (event: TRuntimeEvent) => TUiEvent;
  workerToRuntime?: (event: TWorkerEvent) => TRuntimeEvent;
}

export interface ComlinkEventBridge<TRuntimeEvent, TUiEvent, TWorkerEvent> {
  createUiProxy(listener: EventListener<TUiEvent>): RemoteEventListener<TRuntimeEvent>;
  toRuntimeListener(listener: RemoteEventListener<TRuntimeEvent>): EventListener<TWorkerEvent>;
}

export type PhaseEvent = { type: string; payload?: unknown };
export type PhaseEventMap = Record<string, PhaseEvent>;
export type EventTransformer<TInput, TOutput> = (event: TInput) => TOutput;

export function createComlinkEventBridge<
  TRuntimeEvent,
  TUiEvent = TRuntimeEvent,
  TWorkerEvent = TRuntimeEvent,
>(
  options: ComlinkEventBridgeOptions<TRuntimeEvent, TUiEvent, TWorkerEvent> = {}
): ComlinkEventBridge<TRuntimeEvent, TUiEvent, TWorkerEvent> {
  const { runtimeToUi, workerToRuntime } = options;

  const toUi: EventTransformer<TRuntimeEvent, TUiEvent> = runtimeToUi
    ? runtimeToUi
    : (event: TRuntimeEvent) => event as unknown as TUiEvent;

  const toRuntime: EventTransformer<TWorkerEvent, TRuntimeEvent> = workerToRuntime
    ? workerToRuntime
    : (event: TWorkerEvent) => event as unknown as TRuntimeEvent;

  return {
    createUiProxy(listener: EventListener<TUiEvent>): RemoteEventListener<TRuntimeEvent> {
      return proxy((runtimeEvent: TRuntimeEvent) => {
        listener(toUi(runtimeEvent));
      });
    },
    toRuntimeListener(listener: RemoteEventListener<TRuntimeEvent>): EventListener<TWorkerEvent> {
      return (workerEvent: TWorkerEvent) => {
        listener(toRuntime(workerEvent));
      };
    },
  };
}
