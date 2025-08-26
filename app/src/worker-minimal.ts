/**
 * Minimal Worker for testing basic Comlink functionality
 */

import * as Comlink from 'comlink';

console.log('[Minimal Worker] Worker script loaded');

const minimalAPI = {
  ping: () => {
    console.log('[Minimal Worker] ping() called');
    return { message: 'pong', timestamp: Date.now() };
  },
  
  add: (a: number, b: number) => {
    console.log('[Minimal Worker] add() called:', a, b);
    return a + b;
  },
  
  asyncTest: async () => {
    console.log('[Minimal Worker] asyncTest() called');
    await new Promise(resolve => setTimeout(resolve, 100));
    return { result: 'async-success' };
  }
};

console.log('[Minimal Worker] Exposing minimal API via Comlink...');
Comlink.expose(minimalAPI);
console.log('[Minimal Worker] Minimal API exposed successfully');