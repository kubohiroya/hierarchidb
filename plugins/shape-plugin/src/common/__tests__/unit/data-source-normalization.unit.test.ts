import { describe, expect, it } from 'vitest';
import { DEFAULT_PROCESSING_CONFIG } from '../../../common/types/constants.js';
import {
  createDraftFromEntity,
  mapDraftToUpdates,
} from '../../../services/utils/utils.js';
import type { NodeId, ShapeEntity } from '../../../common/types/index.js';

const baseEntity = (dataSourceName: string, batchDataSource = dataSourceName): ShapeEntity => ({
  id: 'shape-node' as NodeId,
  nodeId: 'shape-node' as NodeId,
  name: 'Country Boundaries',
  description: 'template node',
  dataSourceName: dataSourceName as unknown as ShapeEntity['dataSourceName'],
  licenseAgreement: false,
  batchConfig: {
    ...DEFAULT_PROCESSING_CONFIG,
    dataSource: batchDataSource as ShapeEntity['batchConfig']['dataSource'],
  },
  checkboxState: [],
  selectedCountries: [],
  adminLevels: [],
  urlMetadata: [],
  processingStatus: 'idle',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  version: 1,
});

describe('data source normalization', () => {
  it('normalizes entity data sources when building working copies', () => {
    const entity = baseEntity('geoBoundaries', 'geoBoundaries');
    const draft = createDraftFromEntity(entity);
    expect(draft.draftData.dataSourceName).toBe('geoboundaries');
  });

  it('normalizes draft updates before persisting', () => {
    const draft = createDraftFromEntity(baseEntity('naturalearth', 'naturalearth'));
    const mutated = {
      ...draft,
      draftData: {
        ...draft.draftData,
        dataSourceName: 'GeoBoundaries',
        batchConfig: {
          ...draft.draftData.batchConfig,
          dataSource: 'GeoBoundaries',
        },
      },
    } as typeof draft;
    const updates = mapDraftToUpdates(mutated);
    expect(updates.dataSourceName).toBe('geoboundaries');
  });
});
