import type { Endpoint } from 'comlink';
import type { MessagePort as NodeMessagePort, TransferListItem } from 'worker_threads';

type MessageEventLike<T = unknown> = { data: T };
type MessageEventListener = (event: MessageEventLike) => void;
type NodeMessageListener = (value: unknown) => void;

function invokeListener(
  handler: EventListenerOrEventListenerObject | MessageEventListener,
  event: MessageEventLike
): void {
  if (typeof handler === 'function') {
    (handler as MessageEventListener)(event);
    return;
  }
  if (handler && typeof (handler as EventListenerObject).handleEvent === 'function') {
    (handler as EventListenerObject).handleEvent(event as unknown as Event);
  }
}

/**
 * Wraps a Node.js MessagePort to behave like the interface Comlink expects in browser contexts.
 */
export function createEndpointFromMessagePort(port: NodeMessagePort): Endpoint {
  const listeners = new Map<
    EventListenerOrEventListenerObject | MessageEventListener,
    NodeMessageListener
  >();

  return {
    postMessage(value, transfer) {
      if (transfer && transfer.length > 0) {
        const list = Array.from(transfer) as TransferListItem[];
        port.postMessage(value, list);
      } else {
        port.postMessage(value);
      }
    },
    addEventListener(_type, handler: EventListenerOrEventListenerObject | MessageEventListener) {
      const wrapped: NodeMessageListener = (data) => invokeListener(handler, { data });
      listeners.set(handler, wrapped);
      port.on('message', wrapped);
    },
    removeEventListener(_type, handler: EventListenerOrEventListenerObject | MessageEventListener) {
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
