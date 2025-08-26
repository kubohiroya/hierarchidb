/**
 * Simple Worker for testing Comlink
 */

import * as Comlink from 'comlink';

console.log('[Simple Worker] Worker script loaded');

// Very simple synchronous API
const simpleAPI = {
  ping: () => {
    console.log('[Simple Worker] ping called');
    return { message: 'pong', timestamp: Date.now() };
  },
  
  test: () => {
    console.log('[Simple Worker] test called');
    return 'test-success';
  }
};

console.log('[Simple Worker] Exposing simple API...');
Comlink.expose(simpleAPI);
console.log('[Simple Worker] Simple API exposed');