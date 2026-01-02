import { describe, expect, it, vi } from 'vitest';
import { buildExtract2TasksWithTopoJSON } from './extract2TopojsonTasks.js';
import type { SessionArtifactStore } from '../SessionArtifactStore.js';
import type { ShapeExtract1TaskInputData } from '@hierarchidb/plugin-service-api';
import type { NodeId } from '@hierarchidb/common-types';

const encoder = new TextEncoder();

describe('buildExtract2TasksWithTopoJSON', () => {
  it('creates grouped buffers and extract2 tasks', async () => {
    const putExtractedBuffers = vi.fn(async () => undefined);
    const store: Pick<SessionArtifactStore, 'getExtractedBuffer' | 'putExtractedBuffers'> = {
      getExtractedBuffer: vi.fn(async () => ({
        nodeId: 'node-1' as NodeId,
        stage: 'extract1',
        id: 'node-1-extract1-0',
        data: encoder.encode('dummy').buffer,
        featureCount: 1,
        extractionRatio: 1,
        tolerance: 0,
        timestamp: Date.now(),
      })),
      putExtractedBuffers,
    };

    const decodeFeatureCollection = vi.fn(async () => ({
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', geometry: null, properties: { any: 'x' } },
        { type: 'Feature', geometry: null, properties: { any: 'y' } },
      ],
    }));

    const encodeFeatureCollection = vi.fn(async () => encoder.encode('out').buffer);

    const res = await buildExtract2TasksWithTopoJSON({
      nodeId: 'node-1' as NodeId,
      extract1Tasks: [
        {
          taskId: 't1',
          nodeId: 'node-1' as NodeId,
          taskType: 'extract1',
          stage: 'WAIT',
          type: 'extract1',
          status: 'waiting',
          index: 0,
          progress: 0,
          inputBufferId: 'buf-raw',
          countryCode: 'JPN',
          adminLevel: 1,
        },
      ],
      extract1InputsByTaskId: new Map([
        ['t1', {
          inputBufferId: 'node-1-extract1-0',
          continent: 'Asia',
          countryName: 'Japan',
          countryCode: 'JPN',
          adminLevel: 1,
          originKey: 'k',
          originLabel: 'l',
          dataSource: 'naturalearth',
        } satisfies ShapeExtract1TaskInputData],
      ]),
      originMetadataByBuffer: new Map(),
      store,
      decodeFeatureCollection,
      encodeFeatureCollection,
      buildProcessingTaskId: (_stage, details) => `id-${details.featureGroupId}`,
      maxFeaturesPerGroup: 1,
    });

    expect(res.tasks.length).toBeGreaterThan(0);
    expect(res.inputsByTaskId.size).toBe(res.tasks.length);
    expect(encodeFeatureCollection).toHaveBeenCalled();
    expect(putExtractedBuffers).toHaveBeenCalled();
  });
});
