import type { NodeId } from '@hierarchidb/core-types';
import type { CoreDB } from '@hierarchidb/runtime-worker';
import { describe, expect, it, vi } from 'vitest';

import { ShapeEntityService } from '../../worker/handlers/ShapeEntityService.js';

const asNodeId = (value: string): NodeId => value as NodeId;

describe('ShapeEntityService stopReason contract', () => {
  it('reads auth-required from persisted entity data', async () => {
    const nodeId = asNodeId('shape-auth-required');
    const coreDB = {
      getNode: vi.fn(async () => ({
        id: nodeId,
        createdAt: 1,
        updatedAt: 2,
        version: 1,
        data: { stopReason: 'auth-required' },
      })),
    } as unknown as CoreDB;
    const service = new ShapeEntityService(coreDB);

    await expect(service.getEntity(nodeId)).resolves.toEqual(
      expect.objectContaining({ stopReason: 'auth-required' })
    );
  });

  it('rejects a persisted stopReason outside the canonical set', async () => {
    const nodeId = asNodeId('shape-invalid-stop-reason');
    const coreDB = {
      getNode: vi.fn(async () => ({
        id: nodeId,
        createdAt: 1,
        updatedAt: 2,
        version: 1,
        data: { stopReason: 'expired-auth' },
      })),
    } as unknown as CoreDB;
    const service = new ShapeEntityService(coreDB);

    await expect(service.getEntity(nodeId)).rejects.toThrowError(
      '[ShapeEntityService] unsupported stopReason: expired-auth'
    );
  });
});
