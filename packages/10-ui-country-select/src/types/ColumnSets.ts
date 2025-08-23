/**
 * @fileoverview Predefined column sets for common selection scenarios
 * @module @hierarchidb/ui-country-select/types
 */

import {
  AdminPanelSettings,
  LocationCity,
  Business,
  Home,
  Flight,
  DirectionsBoat,
  Train,
  DirectionsCar,
  Public,
  LocalShipping,
} from '@mui/icons-material';

import type { ColumnSet, AdminLevelColumn, TransportHubColumn, RouteTypeColumn } from './MatrixColumn';

/** Administrative levels column set (for shapes/boundaries) */
export const ADMIN_LEVELS_COLUMN_SET: ColumnSet = {
  type: 'admin-levels',
  name: 'Administrative Levels',
  description: 'Country administrative divisions (federal, state/province, county, city, etc.)',
  columns: [
    {
      type: 'admin-level',
      id: 'admin-0',
      label: 'Country',
      description: 'National level boundaries',
      icon: AdminPanelSettings,
      level: 0,
      examples: ['Countries', 'Nations'],
      defaultEnabled: true,
      required: true,
    },
    {
      type: 'admin-level',
      id: 'admin-1',
      label: 'State/Province',
      description: 'First-level administrative divisions',
      icon: Business,
      level: 1,
      examples: ['States (US)', 'Provinces (CA)', 'Länder (DE)', 'Prefectures (JP)'],
      defaultEnabled: true,
    },
    {
      type: 'admin-level',
      id: 'admin-2',
      label: 'County/Region',
      description: 'Second-level administrative divisions',
      icon: LocationCity,
      level: 2,
      examples: ['Counties (US)', 'Départements (FR)', 'Kreis (DE)', 'Districts (IN)'],
      defaultEnabled: false,
    },
    {
      type: 'admin-level',
      id: 'admin-3',
      label: 'Municipality',
      description: 'Third-level administrative divisions',
      icon: Home,
      level: 3,
      examples: ['Municipalities', 'Communes', 'Cities', 'Towns'],
      defaultEnabled: false,
    },
  ] as AdminLevelColumn[],
};

/** Transportation hubs column set (for location/POI data) */
export const TRANSPORT_HUBS_COLUMN_SET: ColumnSet = {
  type: 'transport-hubs',
  name: 'Transportation Hubs',
  description: 'Major transportation infrastructure and hubs',
  columns: [
    {
      type: 'transport-hub',
      id: 'airports',
      label: 'Airports',
      description: 'International and domestic airports',
      icon: Flight,
      hubType: 'airport',
      codes: ['IATA', 'ICAO'],
      defaultEnabled: true,
    },
    {
      type: 'transport-hub',
      id: 'ports',
      label: 'Ports',
      description: 'Seaports and harbors',
      icon: DirectionsBoat,
      hubType: 'port',
      codes: ['UN/LOCODE'],
      defaultEnabled: true,
    },
    {
      type: 'transport-hub',
      id: 'stations',
      label: 'Railway Stations',
      description: 'Major railway stations and terminals',
      icon: Train,
      hubType: 'station',
      defaultEnabled: false,
    },
    {
      type: 'transport-hub',
      id: 'interchanges',
      label: 'Highway Interchanges',
      description: 'Major highway interchanges and junctions',
      icon: DirectionsCar,
      hubType: 'interchange',
      defaultEnabled: false,
    },
  ] as TransportHubColumn[],
};

/** Route types column set (for route/connection data) */
export const ROUTE_TYPES_COLUMN_SET: ColumnSet = {
  type: 'route-types',
  name: 'Route Types',
  description: 'Different types of transportation routes and connections',
  columns: [
    {
      type: 'route',
      id: 'air-routes',
      label: 'Air Routes',
      description: 'Flight connections and air routes',
      icon: Flight,
      routeType: 'air',
      classification: 'international',
      defaultEnabled: true,
    },
    {
      type: 'route',
      id: 'sea-routes',
      label: 'Sea Routes',
      description: 'Maritime shipping routes',
      icon: DirectionsBoat,
      routeType: 'sea',
      classification: 'international',
      defaultEnabled: true,
    },
    {
      type: 'route',
      id: 'rail-routes',
      label: 'Rail Routes',
      description: 'Railway connections and routes',
      icon: Train,
      routeType: 'rail',
      classification: 'regional',
      defaultEnabled: false,
    },
    {
      type: 'route',
      id: 'road-routes',
      label: 'Road Routes',
      description: 'Highway and road connections',
      icon: DirectionsCar,
      routeType: 'road',
      classification: 'domestic',
      defaultEnabled: false,
    },
  ] as RouteTypeColumn[],
};

/** Airports only column set (simplified for airport-specific plugins) */
export const AIRPORTS_COLUMN_SET: ColumnSet = {
  type: 'airports',
  name: 'Airport Categories',
  description: 'Different categories and sizes of airports',
  columns: [
    {
      type: 'transport-hub',
      id: 'major-airports',
      label: 'Major Airports',
      description: 'International airports with >1M passengers/year',
      icon: Flight,
      hubType: 'airport',
      defaultEnabled: true,
    },
    {
      type: 'transport-hub',
      id: 'regional-airports',
      label: 'Regional Airports',
      description: 'Regional airports with regular scheduled service',
      icon: Public,
      hubType: 'airport',
      defaultEnabled: false,
    },
    {
      type: 'transport-hub',
      id: 'cargo-airports',
      label: 'Cargo Airports',
      description: 'Airports primarily for cargo operations',
      icon: LocalShipping,
      hubType: 'airport',
      defaultEnabled: false,
    },
  ] as TransportHubColumn[],
};

/** Ports only column set (simplified for maritime plugins) */
export const PORTS_COLUMN_SET: ColumnSet = {
  type: 'ports',
  name: 'Port Categories',
  description: 'Different categories and types of ports',
  columns: [
    {
      type: 'transport-hub',
      id: 'major-ports',
      label: 'Major Ports',
      description: 'Large container and cargo ports',
      icon: DirectionsBoat,
      hubType: 'port',
      defaultEnabled: true,
    },
    {
      type: 'transport-hub',
      id: 'passenger-ports',
      label: 'Passenger Ports',
      description: 'Ports with ferry and cruise services',
      icon: Public,
      hubType: 'port',
      defaultEnabled: false,
    },
    {
      type: 'transport-hub',
      id: 'fishing-ports',
      label: 'Fishing Ports',
      description: 'Ports primarily for fishing operations',
      icon: LocalShipping,
      hubType: 'port',
      defaultEnabled: false,
    },
  ] as TransportHubColumn[],
};

/** All predefined column sets */
export const COLUMN_SETS: Record<string, ColumnSet> = {
  'admin-levels': ADMIN_LEVELS_COLUMN_SET,
  'transport-hubs': TRANSPORT_HUBS_COLUMN_SET,
  'route-types': ROUTE_TYPES_COLUMN_SET,
  'airports': AIRPORTS_COLUMN_SET,
  'ports': PORTS_COLUMN_SET,
};

/** Get column set by type */
export function getColumnSet(type: string): ColumnSet | undefined {
  return COLUMN_SETS[type];
}

/** Get all available column set types */
export function getColumnSetTypes(): string[] {
  return Object.keys(COLUMN_SETS);
}