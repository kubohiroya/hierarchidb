import type { MapToggleOption } from '@hierarchidb/ui-plugin-shell/ui-map';
import type { LocationType } from '@hierarchidb/location-store';
import { ROUTE_MODES, type RouteMode } from '@hierarchidb/route-store';
import type { MapSearchTargetId } from '../../../state/mapSearch.atoms.js';
import type { MapStyle } from './types.js';
import {
  DirectionsBoat as DirectionsBoatIcon,
  DirectionsCar as DirectionsCarIcon,
  Flight as FlightIcon,
  FlightTakeoff as FlightTakeoffIcon,
  ForkRight as ForkRightIcon,
  LocationCity as LocationCityIcon,
  Speed as SpeedIcon,
  Train as TrainIcon,
} from '@mui/icons-material';

export type RouteModeOption = MapToggleOption & { modes: RouteMode[] };

export const LOCATION_TYPE_OPTIONS = [
  { id: 'area_centroid' as LocationType, label: 'Admin Center', icon: <LocationCityIcon fontSize="small" /> },
  { id: 'airport' as LocationType, label: 'Airport', icon: <FlightTakeoffIcon fontSize="small" /> },
  { id: 'port' as LocationType, label: 'Port', icon: <DirectionsBoatIcon fontSize="small" /> },
  { id: 'railway_station' as LocationType, label: 'Station', icon: <TrainIcon fontSize="small" /> },
  { id: 'interchange' as LocationType, label: 'Interchange', icon: <ForkRightIcon fontSize="small" /> },
] satisfies MapToggleOption[];

export const ROUTE_MODE_OPTIONS = [
  { id: ROUTE_MODES.AIRWAY, label: 'Air', icon: <FlightIcon fontSize="small" />, modes: [ROUTE_MODES.AIRWAY] },
  { id: ROUTE_MODES.WATERWAY, label: 'Sea', icon: <DirectionsBoatIcon fontSize="small" />, modes: [ROUTE_MODES.WATERWAY] },
  { id: ROUTE_MODES.RAILWAY, label: 'Rail', icon: <TrainIcon fontSize="small" />, modes: [ROUTE_MODES.RAILWAY] },
  {
    id: ROUTE_MODES.H_RAILWAY,
    label: 'High-speed Rail',
    icon: <SpeedIcon fontSize="small" />,
    modes: [ROUTE_MODES.H_RAILWAY],
  },
  {
    id: ROUTE_MODES.ROAD,
    label: 'Road',
    icon: <DirectionsCarIcon fontSize="small" />,
    modes: [ROUTE_MODES.ROAD, ROUTE_MODES.HIGHWAY],
  },
] satisfies RouteModeOption[];

export const BUILT_IN_STYLE_URLS: Record<Exclude<MapStyle['style'], 'custom'>, string> = {
  streets: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
  satellite: 'https://demotiles.maplibre.org/style.json',
  terrain: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  light: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
};

export const SEARCH_TARGET_DEFINITIONS: Record<
  MapSearchTargetId,
  { label: string; group: 'point' | 'route' | 'shape'; keys: string[] }
> = {
  pointName: { label: '名前', group: 'point', keys: ['name', 'NAME', 'label'] },
  pointAirportCode: {
    label: '空港コード',
    group: 'point',
    keys: ['airportCode', 'iataCode', 'icaoCode', 'iata', 'icao', 'ident', 'metadata.airportCode', 'metadata.iataCode', 'metadata.icaoCode'],
  },
  pointPortCode: {
    label: '港コード',
    group: 'point',
    keys: ['portCode', 'unlocode', 'locode', 'metadata.portCode', 'metadata.unlocode'],
  },
  pointStationCode: {
    label: '駅コード',
    group: 'point',
    keys: ['stationCode', 'station_code', 'metadata.stationCode', 'metadata.station_code'],
  },
  routeName: { label: '名前', group: 'route', keys: ['name', 'routeName', 'route_name'] },
  shapeRegionName: {
    label: '地域名',
    group: 'shape',
    keys: ['adminName', 'name', 'NAME', 'name_en', 'NAME_EN', 'shapeName', 'NAME_1', 'NAME_2', 'NAME_3', 'NAME_4', 'NAME_5'],
  },
  shapeCountryName: {
    label: '国名',
    group: 'shape',
    keys: ['countryName', 'country', 'COUNTRY', 'COUNTRY_NAME', 'NAME_0', 'ADMIN', 'SOVEREIGNT'],
  },
  shapeRegionCode: {
    label: '地域コード',
    group: 'shape',
    keys: ['adminCode', 'ADM1_CODE', 'ADM2_CODE', 'GID_1', 'GID_2', 'GID_3', 'shapeID', 'code'],
  },
  shapeCountryCode: {
    label: '国コード',
    group: 'shape',
    keys: ['countryCode', 'ISO_A2', 'ISO2', 'ISO_2', 'ISO_A3', 'ADM0_A3', 'ISO3', 'shapeISO'],
  },
};

export const SEARCH_TARGET_GROUPS: Array<{ title: string; targetIds: MapSearchTargetId[] }> = [
  {
    title: '地点 (point)',
    targetIds: ['pointName', 'pointAirportCode', 'pointPortCode', 'pointStationCode'],
  },
  {
    title: '経路 (lineString)',
    targetIds: ['routeName'],
  },
  {
    title: 'シェイプ (multiPolygon)',
    targetIds: ['shapeRegionName', 'shapeCountryName', 'shapeRegionCode', 'shapeCountryCode'],
  },
];
