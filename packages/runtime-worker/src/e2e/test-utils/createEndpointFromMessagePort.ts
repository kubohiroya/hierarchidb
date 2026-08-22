import type { Endpoint } from 'comlink';
import type { MessagePort as NodeMessagePort, TransferListItem } from 'worker_threads';

type MessageEventLike<T = unknown> = { data: T };
type MessagePortEventListener = EventListenerOrEventListenerObject;
type NodeMessageListener = (value: unknown) => void;

function invokeListener(handler: MessagePortEventListener, event: Event): void {
  if (typeof handler === 'function') {
    handler(event);
    return;
  }
  if (typeof (handler as EventListenerObject).handleEvent === 'function') {
    (handler as EventListenerObject).handleEvent(event);
  }
}

const createMessageEvent = (data: unknown): Event => {
  if (typeof MessageEvent === 'function') {
    return new MessageEvent('message', { data });
  }
  const event = new Event('message');
  (event as Event & { data: unknown }).data = data;
  return event;
};

/**
 * Wraps a Node.js MessagePort to behave like the interface Comlink expects in browser contexts.
 */
export function createEndpointFromMessagePort(port: NodeMessagePort): Endpoint {
  const listeners = new Map<MessagePortEventListener, NodeMessageListener>();

  return {
    postMessage(value, transfer) {
      if (transfer && transfer.length > 0) {
        const list = Array.from(transfer) as TransferListItem[];
        port.postMessage(value, list);
      } else {
        port.postMessage(value);
      }
    },
    addEventListener(_type, handler: MessagePortEventListener) {
      const wrapped: NodeMessageListener = (data) =>
        invokeListener(handler, createMessageEvent(data));
      listeners.set(handler, wrapped);
      port.on('message', wrapped);
    },
    removeEventListener(_type, handler: MessagePortEventListener) {
      const wrapped = listeners.get(handler);
      if (!wrapped) return;
      if (typeof port.off === 'function') {
        port.off('message', wrapped);
      } else {
        port.removeListener('message', wrapped);
      }
      listeners.delete(handler);
    },
    start() {
      if (typeof port.start === 'function') {
        port.start();
      }
    },
  };
}
