import { describe, expect, it } from 'vitest';
import { MessageChannel } from 'node:worker_threads';
import { expose, proxy, wrap, type Remote } from 'comlink';
import type { DialogStateAPI } from '@hierarchidb/common-api';
import { DialogStateService } from '../DialogStateService.js';

describe('DialogStateService via Comlink proxy', () => {
  it('exposes dialog state methods as callable functions on the remote proxy', async () => {
    const { port1, port2 } = new MessageChannel();

    try {
      const service = new DialogStateService();
      expose(
        {
          async getDialogStateAPI(): Promise<DialogStateAPI> {
            return proxy(service) as unknown as DialogStateAPI;
          },
        },
        port2,
      );

      const remote = wrap<{ getDialogStateAPI(): Remote<DialogStateAPI> }>(port1);
      const api = await remote.getDialogStateAPI();

      expect(typeof api.publishState).toBe('function');
      expect(typeof api.getState).toBe('function');
      expect(typeof api.subscribeState).toBe('function');
      expect(typeof api.unsubscribeState).toBe('function');
    } finally {
      port1.close();
      port2.close();
    }
  });
});
