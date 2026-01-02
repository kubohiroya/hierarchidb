import { describe, expect, it, vi } from 'vitest';
import { buildExtract2TasksWithTopoJSON } from './extract2/topojsonGrouping.js';
import type { ShapeExtract1TaskInputData } from '@hierarchidb/plugin-service-api';
import type { NodeId } from '@hierarchidb/common-types';
import { BatchTaskStage } from '../../../common/types/index.js';
import type { FeatureCollection } from 'geojson';

const encoder = new TextEncoder();

describe('buildExtract2TasksWithTopoJSON', () => {
  it('creates grouped buffers and extract2 tasks', async () => {
    const putExtractedBuffers = vi.fn(async () => undefined);
    const getExtractedBuffer = vi.fn(async () => ({ data: encoder.encode('dummy').buffer }));

    const decodeFeatureCollection = vi.fn(async (_buffer: ArrayBuffer): Promise<FeatureCollection> => ({
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
          stage: BatchTaskStage.WAIT,
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
      buildTaskId: (_stage, details) => `id-${details.featureGroupId}`,
      resolveTaskContinent: (input) => input?.continent,
      resolveTaskCountryName: (input) => input?.countryName,
      resolveTaskCountryCode: (task, input) => input?.countryCode ?? task.countryCode,
      resolveTaskAdminCode: (input) => input?.adminCode,
      getExtractedBuffer,
      decodeFeatureCollection,
      encodeFeatureCollection,
      putExtractedBuffers,
      consoleWarn: () => undefined,
      consoleDebug: () => undefined,
    });

    expect(res.tasks.length).toBeGreaterThan(0);
    expect(res.inputsByTaskId.size).toBe(res.tasks.length);
    expect(encodeFeatureCollection).toHaveBeenCalled();
    expect(putExtractedBuffers).toHaveBeenCalled();
  });
});
