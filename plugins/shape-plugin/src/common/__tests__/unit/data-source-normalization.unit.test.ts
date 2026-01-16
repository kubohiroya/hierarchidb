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
  buildConfig: {
    ...DEFAULT_BUILD_CONFIG,
    dataSourceName: batchDataSource as ShapeEntity['buildConfig']['dataSourceName'],
  },
  selectedArrayByCountries: {},
  processingStatus: 'idle',
});

describe('data source normalization', () => {
  it('normalizes entity data sources when building working copies', () => {
    const entity = baseEntity('naturalearth');
    const draft = createDraftFromEntity(entity);
    expect(draft.draftData.buildConfig?.dataSourceName).toBe('naturalearth');
  });

  it('normalizes draft updates before persisting', () => {
    const draft = createDraftFromEntity(baseEntity('naturalearth'));
    const mutated = {
      ...draft,
      draftData: {
        ...draft.draftData,
        buildConfig: {
          ...draft.draftData.buildConfig,
          dataSourceName: 'naturalearth',
        },
      },
    } as typeof draft;
    const updates = mapDraftToUpdates(mutated);
    expect(updates.buildConfig?.dataSourceName).toBe('naturalearth');
  });
});
