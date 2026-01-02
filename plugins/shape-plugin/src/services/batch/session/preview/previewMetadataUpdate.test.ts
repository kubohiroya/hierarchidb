import { describe, expect, it, vi } from 'vitest';
import { updatePreviewMetadataStageWith } from './previewMetadataUpdate.js';
import { NodeId } from '@hierarchidb/common-types';
import { SessionArtifactStore } from '../SessionArtifactStore';

describe('previewMetadataUpdate', () => {
  it('forwards args to injected update()', async () => {
    const update = vi.fn(async () => undefined);

    const originByKey = new Map();
    const statsByOrigin = new Map();

    await updatePreviewMetadataStageWith({
      enabled: true,
      nodeId: 'node-1' as NodeId,
      store: {} as SessionArtifactStore,
      originByKey,
      stage: 'extract1',
      statsByOrigin,
      update,
    });

    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0]?.[0]).toMatchObject({
      enabled: true,
      nodeId: 'node-1' as NodeId,
      originByKey,
      stage: 'extract1',
      statsByOrigin,
    });
  });
});
