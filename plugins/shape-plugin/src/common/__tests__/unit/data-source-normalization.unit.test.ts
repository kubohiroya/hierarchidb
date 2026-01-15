import { describe, expect, it } from 'vitest';
import { DEFAULT_BUILD_CONFIG } from '../../../common/types/constants.js';
import {
  createDraftFromEntity,
  mapDraftToUpdates,
} from '../../../services/utils/utils.js';
import type { NodeId, ShapeEntity } from '../../../common/types/index.js';

const baseEntity = (batchDataSource: string): ShapeEntity => ({
  id: 'shape-node' as NodeId,
  nodeId: 'shape-node' as NodeId,
  licenseAgreement: false,
  batchConfig: {
    ...DEFAULT_BUILD_CONFIG,
    dataSource: batchDataSource as ShapeEntity['batchConfig']['dataSource'],
  },
  selectedArrayByCountries: {},
  processingStatus: 'idle',
});

describe('data source normalization', () => {
  it('normalizes entity data sources when building working copies', () => {
    const entity = baseEntity('naturalearth');
    const draft = createDraftFromEntity(entity);
    expect(draft.draftData.buildConfig?.dataSource).toBe('naturalearth');
  });

  it('normalizes draft updates before persisting', () => {
    const draft = createDraftFromEntity(baseEntity('naturalearth'));
    const mutated = {
      ...draft,
      draftData: {
        ...draft.draftData,
        batchConfig: {
          ...draft.draftData.buildConfig,
          dataSource: 'naturalearth',
        },
      },
    } as typeof draft;
    const updates = mapDraftToUpdates(mutated);
    expect(updates.buildConfig?.dataSource).toBe('naturalearth');
  });
});
