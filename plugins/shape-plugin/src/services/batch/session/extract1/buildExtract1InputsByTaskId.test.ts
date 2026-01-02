import { describe, expect, it } from 'vitest';
import type { NodeId } from '@hierarchidb/common-types';
import { BatchTaskStage } from '../../../../common/types/index.js';
import type { Extract1Task } from '../../../../common/types/index.js';
import type { OriginMetadata } from '../SessionTypes.js';
import { buildExtract1InputsByTaskId } from './buildExtract1InputsByTaskId.js';

describe('buildExtract1InputsByTaskId', () => {
  it('builds ShapeExtract1TaskInputData from origin metadata when present', () => {
    const nodeId = 'node-1' as NodeId;

    const tasks: Extract1Task[] = [
      {
        taskId: 'extract1-0',
        nodeId,
        taskType: 'extract1',
        stage: BatchTaskStage.WAIT,
        type: 'extract1',
        status: 'waiting',
        index: 0,
        progress: 0,
        inputBufferId: 'raw-0',
        countryCode: 'JPN',
        adminLevel: 1,
      },
    ];

    const originByInputBufferId = new Map<string, OriginMetadata>([
      ['raw-0', {
        originKey: 'ne:asia:jpn:adm1:0',
        originLabel: 'Japan (ADM1)',
        inputBufferId: 'raw-0',
        dataSource: 'naturalearth',
        sourceUrl: 'https://example.test/source.fgb',
        countryName: 'Japan',
        countryCode: 'JPN',
        continent: 'Asia',
        adminLevel: 1,
        featureGroupId: 'continent-group:Asia',
        featureLabel: 'Japan',
        featureIndex: 0,
      }],
    ]);

    const inputs = buildExtract1InputsByTaskId({
      tasks,
      originByInputBufferId,
      buildFallbackFeatureId: (task) => `${task.countryCode ?? 'UNK'}:ADM${task.adminLevel ?? 'X'}`,
    });

    const input = inputs.get('extract1-0');
    expect(input).toBeTruthy();
    expect(input?.originKey).toBe('ne:asia:jpn:adm1:0');
    expect(input?.featureId).toBe('Japan');
    expect(input?.countryName).toBe('Japan');
  });

  it('falls back to stable featureId when origin metadata missing', () => {
    const nodeId = 'node-1' as NodeId;

    const tasks: Extract1Task[] = [
      {
        taskId: 'extract1-0',
        nodeId,
        taskType: 'extract1',
        stage: BatchTaskStage.WAIT,
        type: 'extract1',
        status: 'waiting',
        index: 0,
        progress: 0,
        inputBufferId: 'raw-0',
        countryCode: 'JPN',
        adminLevel: 1,
      },
    ];

    const inputs = buildExtract1InputsByTaskId({
      tasks,
      originByInputBufferId: new Map(),
      buildFallbackFeatureId: (task) => `${task.countryCode ?? 'UNK'}:ADM${task.adminLevel ?? 'X'}`,
    });

    const input = inputs.get('extract1-0');
    expect(input).toBeTruthy();
    expect(input?.featureId).toBe('JPN:ADM1');
  });
});

