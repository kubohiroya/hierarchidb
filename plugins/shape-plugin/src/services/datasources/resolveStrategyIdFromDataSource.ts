import type { DataSourceName } from '~/common/types/index';
import type { DataSourceStrategyId } from './DataSourceStrategyFactory.js';

export const resolveStrategyIdFromDataSource = (
  source?: DataSourceName
): DataSourceStrategyId | null => {
  switch (source) {
    case 'gadm':
      return 'gadm-administrative-areas';
    case 'naturalearth':
      return 'natural-earth-shapes';
    case 'geoboundaries':
      return 'geoboundaries-admin-areas';
    case 'geoboundaries-topojson':
      return 'geoboundaries-admin-areas';
    default:
      return null;
  }
};
