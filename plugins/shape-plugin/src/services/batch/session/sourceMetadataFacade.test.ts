import { describe, expect, it, vi } from 'vitest';

vi.mock('./metadata/sourceMetadata.js', () => ({
  updateSourceMetadataBase: vi.fn(async () => undefined),
  updateSourceMetadataStage: vi.fn(async () => undefined),
}));

import { updateSourceMetadataBase, updateSourceMetadataStage } from './metadata/sourceMetadata.js';
import { updateSourceMetadataBaseIfEnabled, updateSourceMetadataStageIfEnabled } from './metadata/sourceMetadataFacade.js';
import type { NodeId } from '@hierarchidb/common-types';

describe('sourceMetadataFacade', () => {
  it('no-ops when disabled', async () => {
    await updateSourceMetadataBaseIfEnabled({
      enabled: false,
      nodeId: 'node-1' as NodeId,
      store: {} as never,
      entries: [],
    });

    await updateSourceMetadataStageIfEnabled({
      enabled: false,
      nodeId: 'node-1' as NodeId,
      store: {} as never,
      originByKey: new Map(),
      stage: 'raw',
      statsByOrigin: new Map(),
    });

    expect(updateSourceMetadataBase).not.toHaveBeenCalled();
    expect(updateSourceMetadataStage).not.toHaveBeenCalled();
  });

  it('delegates when enabled', async () => {
    const store = {
      listSourceMetadata: vi.fn(async () => []),
      putSourceMetadata: vi.fn(async () => undefined),
      listSourceMetadataStage: vi.fn(async () => []),
      putSourceMetadataStage: vi.fn(async () => undefined),
    } as never;

    await updateSourceMetadataBaseIfEnabled({
      enabled: true,
      nodeId: 'node-1' as NodeId,
      store,
      entries: [{ originKey: 'k', originLabel: 'l', inputBufferId: 'b' } as never],
    });

    await updateSourceMetadataStageIfEnabled({
      enabled: true,
      nodeId: 'node-1' as NodeId,
      store,
      originByKey: new Map([['k', { originKey: 'k', originLabel: 'l', inputBufferId: 'b' } as never]]),
      stage: 'raw',
      statsByOrigin: new Map([['k', { vertexCount: 1, polygonCount: 1 }]]),
    });

    expect(updateSourceMetadataBase).toHaveBeenCalledTimes(1);
    expect(updateSourceMetadataStage).toHaveBeenCalledTimes(1);
  });
});
