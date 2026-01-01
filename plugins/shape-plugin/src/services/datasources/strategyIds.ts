import type { DataSourceStrategyId } from './DataSourceStrategyFactory.js';

export const resolveStrategyIdFromDataSource = (source?: string): DataSourceStrategyId | null => {
  const key = (source ?? '').toLowerCase();
  if (key.includes('gadm')) return 'gadm-administrative-areas';
  if (key.includes('natural')) return 'natural-earth-shapes';
  if (key.includes('geo')) return 'geoboundaries-admin-areas';
  if (key.includes('osm') || key.includes('openstreet')) return 'openstreetmap-overpass';
  return null;
};
