import type { Endpoint } from 'comlink';
import type { MessagePort as NodeMessagePort } from 'worker_threads';

type MessageEventHandler = (event: MessageEvent) => void;
type NodeMessageListener = (value: unknown) => void;

/**
 * Wraps a Node.js MessagePort to behave like the interface Comlink expects in browser contexts.
 */
export function createEndpointFromMessagePort(port: NodeMessagePort): Endpoint {
  const listeners = new Map<MessageEventHandler, NodeMessageListener>();

  return {
    postMessage(value, transfer) {
      if (transfer && transfer.length > 0) {
        port.postMessage(value, transfer);
      } else {
        port.postMessage(value);
      }
    },
    addEventListener(_type, handler) {
      const wrapped: NodeMessageListener = (data) => handler({ data } as MessageEvent);
      listeners.set(handler, wrapped);
      port.on('message', wrapped);
    },
    removeEventListener(_type, handler) {
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
