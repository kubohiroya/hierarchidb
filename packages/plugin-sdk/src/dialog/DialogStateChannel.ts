/**
 * @file DialogStateChannel.ts
 * @description Shared channel utilities for plugin dialog state updates between worker and runtime UI.
 */

interface DialogStateEventBase {
  nodeType: string;
  dialogId: string;
  timestamp: number;
}

export interface DialogStateProgressEvent extends DialogStateEventBase {
  type: 'progress';
  stepIndex?: number;
  stepId?: string;
  progress?: number;
  status?: 'idle' | 'running' | 'completed' | 'failed';
  message?: string;
  details?: Record<string, unknown>;
}

export interface DialogStateValidationEvent extends DialogStateEventBase {
  type: 'validation';
  stepIndex?: number;
  stepId?: string;
  isValid: boolean;
  errors?: string[];
  warnings?: string[];
  details?: Record<string, unknown>;
}

export interface DialogStateDismissEvent extends DialogStateEventBase {
  type: 'dismiss';
  reason: 'completed' | 'cancelled' | 'error' | 'timeout';
  message?: string;
  details?: Record<string, unknown>;
}

export type DialogStateEvent =
  | DialogStateProgressEvent
  | DialogStateValidationEvent
  | DialogStateDismissEvent;

type DialogStateEventWithoutContext<TEvent extends DialogStateEvent> =
  Omit<TEvent, 'nodeType' | 'dialogId' | 'timestamp'> & { timestamp?: number };

export type DialogStateEventInput =
  | DialogStateEventWithoutContext<DialogStateProgressEvent>
  | DialogStateEventWithoutContext<DialogStateValidationEvent>
  | DialogStateEventWithoutContext<DialogStateDismissEvent>;

export type DialogStateChannelListener = (event: DialogStateEvent) => void;

export interface DialogStateChannelHandle {
  emit: (event: DialogStateEventInput) => void;
  dispose: () => void;
}

export interface SubscribeOptions {
  /**
   * Replay the latest known events immediately after subscribing. Defaults to true.
   */
  replayLatest?: boolean;
}

interface ChannelRecord {
  listeners: Set<DialogStateChannelListener>;
  lastEvents: Map<DialogStateEvent['type'], DialogStateEvent>;
}

type ChannelKey = string;

const channels = new Map<ChannelKey, ChannelRecord>();

const makeKey = (nodeType: string, dialogId: string): ChannelKey => `${nodeType}::${dialogId}`;

const ensureChannelRecord = (key: ChannelKey): ChannelRecord => {
  let record = channels.get(key);
  if (!record) {
    record = {
      listeners: new Set(),
      lastEvents: new Map(),
    };
    channels.set(key, record);
  }
  return record;
};

const emitInternal = (
  nodeType: string,
  dialogId: string,
  event: DialogStateEventInput,
): DialogStateEvent => {
  const key = makeKey(nodeType, dialogId);
  const record = ensureChannelRecord(key);

  const timestamp = event.timestamp ?? Date.now();
  const fullEvent: DialogStateEvent = {
    ...event,
    nodeType,
    dialogId,
    timestamp,
  } as DialogStateEvent;

  record.lastEvents.set(fullEvent.type, fullEvent);

  for (const listener of Array.from(record.listeners)) {
    try {
      listener(fullEvent);
    } catch (error) {
      if (typeof console !== 'undefined' && typeof console.error === 'function') {
        console.error('[DialogStateChannel] listener error', error);
      }
    }
  }

  if (fullEvent.type === 'dismiss') {
    record.listeners.clear();
    record.lastEvents.clear();
    channels.delete(key);
  }

  return fullEvent;
};

export const registerDialogStateChannel = (
  nodeType: string,
  dialogId: string,
): DialogStateChannelHandle => {
  const key = makeKey(nodeType, dialogId);
  ensureChannelRecord(key);

  return {
    emit: (event: DialogStateEventInput) => {
      emitInternal(nodeType, dialogId, event);
    },
    dispose: () => {
      channels.delete(key);
    },
  };
};

export const subscribeDialogStateChannel = (
  nodeType: string,
  dialogId: string,
  listener: DialogStateChannelListener,
  options?: SubscribeOptions,
): () => void => {
  const key = makeKey(nodeType, dialogId);
  const record = ensureChannelRecord(key);
  record.listeners.add(listener);

  if (options?.replayLatest !== false) {
    for (const snapshot of record.lastEvents.values()) {
      listener(snapshot);
    }
  }

  return () => {
    const current = channels.get(key);
    if (!current) return;
    current.listeners.delete(listener);
    if (current.listeners.size === 0 && current.lastEvents.size === 0) {
      channels.delete(key);
    }
  };
};

export const emitDialogStateEvent = (
  nodeType: string,
  dialogId: string,
  event: DialogStateEventInput,
): DialogStateEvent => emitInternal(nodeType, dialogId, event);

export const clearDialogStateChannel = (nodeType: string, dialogId: string): void => {
  const key = makeKey(nodeType, dialogId);
  channels.delete(key);
};

