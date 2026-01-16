import type { DomainType } from './types.js';

export const SHAPE_DOMAIN: DomainType = 'shape';

export const bandIdToZBase = (bandId: number): number => {
  switch (bandId) {
    case 0:
      return 0;
    case 1:
      return 3;
    case 2:
      return 6;
    case 3:
      return 9;
    default:
      throw new Error(`Unsupported bandId: ${bandId}`);
  }
};

export const buildFetchCacheRecordId = (nodeId: string, sourceKey: string): string => {
  return `${nodeId}-${SHAPE_DOMAIN}-${sourceKey}`;
};

export const buildTransformCacheRecordId = (nodeId: string, bandId: number, sourceKey: string): string => {
  return `${nodeId}-b${bandId}-${SHAPE_DOMAIN}-${sourceKey}`;
};
