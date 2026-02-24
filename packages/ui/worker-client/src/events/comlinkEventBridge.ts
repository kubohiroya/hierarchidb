import { proxy } from 'comlink';

const sanitizeForComlink = <T>(value: T, seen = new WeakMap<object, unknown>()): T => {
  if (typeof value === 'bigint') {
    return value.toString() as T;
  }

  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (value instanceof Date) {
    return new Date(value.getTime()) as T;
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack ?? undefined,
    } as T;
  }

  if (value instanceof Map) {
    return Array.from(value.values()).map((entry) => sanitizeForComlink(entry, seen)) as T;
  }

  if (value instanceof Set) {
    return Array.from(value).map((entry) => sanitizeForComlink(entry, seen)) as T;
  }

  if (Array.isArray(value)) {
    const list = value;
    return list.map((entry) => sanitizeForComlink(entry, seen)) as T;
  }

  if (typeof value === 'object') {
    if (seen.has(value as object)) {
      return seen.get(value as object) as T;
    }
    const anyValue = value as Record<string, unknown>;
    const safe = {} as Record<string, unknown>;
    seen.set(value as object, safe);

    for (const key of Object.keys(anyValue)) {
      const rawValue = anyValue[key];
      if (typeof rawValue === 'function' || typeof rawValue === 'symbol') {
        continue;
      }
      safe[key] = sanitizeForComlink(rawValue, seen);
    }

    return safe as T;
  }

  return value;
};

export type EventListener<TEvent> = (event: TEvent) => void;
export type RemoteEventListener<TEvent> = EventListener<TEvent>;

export interface ComlinkEventBridgeOptions<
  TRuntimeEvent,
  TUiEvent extends TRuntimeEvent,
  TWorkerEvent extends TRuntimeEvent,
> {
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
  TUiEvent extends TRuntimeEvent = TRuntimeEvent,
  TWorkerEvent extends TRuntimeEvent = TRuntimeEvent,
>(
  options: ComlinkEventBridgeOptions<TRuntimeEvent, TUiEvent, TWorkerEvent> = {}
): ComlinkEventBridge<TRuntimeEvent, TUiEvent, TWorkerEvent> {
  const { runtimeToUi, workerToRuntime } = options;

  const toUi: EventTransformer<TRuntimeEvent, TUiEvent> = runtimeToUi
    ? runtimeToUi
    : (event: TRuntimeEvent) => event as TUiEvent;

  const toRuntime: EventTransformer<TWorkerEvent, TRuntimeEvent> = workerToRuntime
    ? workerToRuntime
    : (event: TWorkerEvent) => event;

  return {
    createUiProxy(listener: EventListener<TUiEvent>): RemoteEventListener<TRuntimeEvent> {
      return proxy((runtimeEvent: TRuntimeEvent) => {
        listener(toUi(sanitizeForComlink(runtimeEvent)));
      });
    },
    toRuntimeListener(listener: RemoteEventListener<TRuntimeEvent>): EventListener<TWorkerEvent> {
      return (workerEvent: TWorkerEvent) => {
        listener(toRuntime(sanitizeForComlink(workerEvent)));
      };
    },
  };
}
