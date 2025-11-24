import { describe, expect, it } from 'vitest';
import { DEFAULT_PROCESSING_CONFIG } from '../../../common/shared/constants.js';
import {
  createDraftFromEntity,
  mapDraftToUpdates,
} from '../../../common/shared/utils.js';
import type { NodeId, ShapeEntity } from '../../../common/shared/types.js';

const baseEntity = (dataSourceName: string): ShapeEntity => ({
  id: 'shape-node' as NodeId,
  nodeId: 'shape-node' as NodeId,
  name: 'Country Boundaries',
  description: 'template node',
  dataSourceName: dataSourceName as unknown as ShapeEntity['dataSourceName'],
  licenseAgreement: false,
  processingConfig: DEFAULT_PROCESSING_CONFIG,
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
    const entity = baseEntity('geoBoundaries');
    const draft = createDraftFromEntity(entity);
    expect(draft.dataSourceName).toBe('geoboundaries');
  });

  it('normalizes working copy updates before persisting', () => {
    const draft = createDraftFromEntity(baseEntity('naturalearth'));
    const mutated = { ...draft, dataSourceName: 'GeoBoundaries' } as typeof draft;
    const updates = mapDraftToUpdates(mutated);
    expect(updates.dataSourceName).toBe('geoboundaries');
  });
});
