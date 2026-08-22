import type { SvgIconComponent } from '@mui/icons-material';
import { Anchor, FlightTakeoff, ForkRight, LocationCity, Subway } from '@mui/icons-material';
import type { LocationType } from '~/common/types/index';

type LocationTypeStyle = {
  color: string;
  icon: SvgIconComponent;
  altIcon?: SvgIconComponent;
};

export const LOCATION_TYPE_STYLES: Record<LocationType, LocationTypeStyle> = {
  area_centroid: {
    color: '#1f77b4',
    icon: LocationCity,
  },
  airport: {
    color: '#ff7f0e',
    icon: FlightTakeoff,
  },
  port: {
    color: '#2ca02c',
    icon: Anchor,
  },
  railway_station: {
    color: '#d62728',
    icon: Subway,
  },
  interchange: {
    color: '#9467bd',
    icon: ForkRight,
  },
};

export const BASE_LOCATION_TYPES = [
  {
    id: 'area_centroid' as LocationType,
    ...LOCATION_TYPE_STYLES.area_centroid,
    estimatedCount: 20000,
  },
  { id: 'airport' as LocationType, ...LOCATION_TYPE_STYLES.airport, estimatedCount: 28000 },
  { id: 'port' as LocationType, ...LOCATION_TYPE_STYLES.port, estimatedCount: 12000 },
  {
    id: 'railway_station' as LocationType,
    ...LOCATION_TYPE_STYLES.railway_station,
    estimatedCount: 45000,
  },
  { id: 'interchange' as LocationType, ...LOCATION_TYPE_STYLES.interchange, estimatedCount: 15000 },
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
