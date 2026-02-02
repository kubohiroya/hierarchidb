import { Anchor, FlightTakeoff, ForkRight, LocationCity, Public, Subway } from '@mui/icons-material';
import type { SvgIconComponent } from '@mui/icons-material';
import type { LocationIconId, LocationType } from '../../../common/types/index.js';
import { LOCATION_TYPE_STYLES } from './locationTypes.js';

export const DEBUG_PREFIX = '[LocationPreview]';

export const KNOWN_LOCATION_TYPES: readonly LocationType[] = [
  'area_centroid',
  'airport',
  'port',
  'railway_station',
  'interchange',
];

export const DEFAULT_TYPE_COLORS: Record<LocationType, string> = {
  area_centroid: '#d62728',
  airport: LOCATION_TYPE_STYLES.airport.color,
  port: '#1f77b4',
  railway_station: '#2ca02c',
  interchange: LOCATION_TYPE_STYLES.interchange.color,
};

export const PREFETCH_MARGIN_PX = 64;
export const HOVER_RADIUS_PX = 8;
export const MAX_HOVER_RESULTS = 10;
export const CIRCLE_RADIUS_MIN = 2;
export const CIRCLE_RADIUS_MAX_ZOOM = 11;
export const CIRCLE_RADIUS_SLOPE = 0.6;
export const CIRCLE_RADIUS_AT_MAX = CIRCLE_RADIUS_MIN + CIRCLE_RADIUS_MAX_ZOOM * CIRCLE_RADIUS_SLOPE;

export const MAX_TILE_ID_ZOOM = 9;
export const MIN_ZOOM_LEVEL = 0;
export const MAX_ZOOM_LEVEL = 22;
export const DEFAULT_MAX_ZOOM = 12;
export const DEFAULT_ICON_SIZE_RANGE: [number, number] = [12, 28];
export const DEFAULT_LABEL_SIZE_RANGE: [number, number] = [10, 18];
export const LABEL_SIZE_SCALE = 1.3;
export const MIN_ICON_SIZE = 8;
export const MAX_ICON_SIZE = 48;
export const MIN_LABEL_SIZE = 8;
export const MAX_LABEL_SIZE = 32;
export const ICON_BASE_PX = 24;

export const LOCATION_ICON_COMPONENTS: Record<LocationIconId, SvgIconComponent> = {
  public: Public,
  location_city: LocationCity,
  flight_takeoff: FlightTakeoff,
  directions_boat: Anchor,
  train: Subway,
  fork_right: ForkRight,
};

export const DEFAULT_ICON_IDS: Record<LocationType, LocationIconId> = {
  area_centroid: 'location_city',
  airport: 'flight_takeoff',
  port: 'directions_boat',
  railway_station: 'train',
  interchange: 'fork_right',
};
