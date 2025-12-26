import type { LocationType } from '../../../common/types/index.js';

export const BASE_LOCATION_TYPES = [
  { id: 'area_centroid' as LocationType, icon: '🎯', color: '#6A5ACD', estimatedCount: 20000 },
  { id: 'airport' as LocationType, icon: '✈️', color: '#2196F3', estimatedCount: 28000 },
  { id: 'port' as LocationType, icon: '🚢', color: '#FF9800', estimatedCount: 12000 },
  { id: 'railway_station' as LocationType, icon: '🚉', color: '#4CAF50', estimatedCount: 45000 },
  { id: 'interchange' as LocationType, icon: '🛣️', color: '#607D8B', estimatedCount: 15000 },
] as const;

export const LOCATION_TYPES_BY_SOURCE: Record<string, LocationType[]> = {
  ourairports: ['airport'],
  openflights: ['airport'],
  'world-port-index': ['port'],
  'natural-earth': ['area_centroid', 'airport', 'port'],
  geonames: ['area_centroid', 'airport', 'port'],
  openstreetmap: BASE_LOCATION_TYPES.map((t) => t.id),
  overpass: BASE_LOCATION_TYPES.map((t) => t.id),
  'ide-gsm': BASE_LOCATION_TYPES.map((t) => t.id),
};

export const resolveTypesForSource = (sourceId: string): LocationType[] => {
  const explicit = LOCATION_TYPES_BY_SOURCE[sourceId];
  if (explicit && explicit.length > 0) return explicit;
  return BASE_LOCATION_TYPES.map((t) => t.id);
};
