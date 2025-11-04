import { MessageChannel } from 'node:worker_threads';
import type { DialogStateAPI } from '@hierarchidb/common-api';
import { expose, proxy, type Remote, wrap } from 'comlink';
import { describe, expect, it } from 'vitest';
import { createEndpointFromMessagePort } from '../../../e2e/test-utils/messagePortEndpoint.js';
import { DialogStateService } from '../../DialogStateService.js';

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
        createEndpointFromMessagePort(port2)
      );

      const remote = wrap<{ getDialogStateAPI(): Remote<DialogStateAPI> }>(
        createEndpointFromMessagePort(port1)
      );
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
