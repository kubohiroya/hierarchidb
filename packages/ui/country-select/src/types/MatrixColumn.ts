/**
 * @fileoverview Matrix column definitions for different selection types
 * @module @hierarchidb/ui-country-select/types
 */

import type { SvgIconComponent } from '@mui/icons-material';

/** Base interface for matrix column definition */
export interface MatrixColumnBase {
  /** Unique identifier for the column */
  id: string;
  /** Display label */
  label: string;
  /** Optional description/tooltip */
  description?: string;
  /** Optional icon */
  icon?: SvgIconComponent;
  /** Column width (defaults to auto) */
  width?: number;
  /** Whether this column is enabled by default */
  defaultEnabled?: boolean;
  /** Whether this column is required (cannot be disabled) */
  required?: boolean;
}

/** Administrative level column */
export interface AdminLevelColumn extends MatrixColumnBase {
  type: 'admin-level';
  /** Administrative level (0-5, where 0 is country level) */
  level: number;
  /** Common examples of this admin level */
  examples?: string[];
}

/** Transportation hub column */
export interface TransportHubColumn extends MatrixColumnBase {
  type: 'transport-hub';
  /** Type of transportation hub */
  hubType: 'airport' | 'port' | 'station' | 'interchange';
  /** IATA/ICAO codes, port codes, etc. */
  codes?: string[];
}

/** Route type column */
export interface RouteTypeColumn extends MatrixColumnBase {
  type: 'route';
  /** Type of route */
  routeType: 'air' | 'sea' | 'road' | 'rail';
  /** Route classification (international, domestic, etc.) */
  classification?: 'international' | 'domestic' | 'regional' | 'local';
}

/** Generic custom column */
export interface CustomColumn extends MatrixColumnBase {
  type: 'custom';
  /** Custom data associated with this column */
  data?: Record<string, any>;
}

/** Union type for all column types */
export type MatrixColumn = AdminLevelColumn | TransportHubColumn | RouteTypeColumn | CustomColumn;

/** Predefined column sets for common use cases */
export type ColumnSetType = 'admin-levels' | 'transport-hubs' | 'route-types' | 'airports' | 'ports' | 'custom';

/** Column set definition */
export interface ColumnSet {
  type: ColumnSetType;
  name: string;
  description: string;
  columns: MatrixColumn[];
}

/** Selection state for matrix columns */
export interface MatrixSelection {
  /** Country code */
  countryCode: string;
  /** Column selections: columnId -> selected */
  selections: Record<string, boolean>;
}

/** Matrix configuration */
export interface MatrixConfig {
  /** Available columns */
  columns: MatrixColumn[];
  /** Whether to allow bulk selection operations */
  allowBulkSelect?: boolean;
  /** Whether to show column headers */
  showColumnHeaders?: boolean;
  /** Whether to show search/filter options */
  showFilters?: boolean;
  /** Virtual scrolling configuration */
  virtualization?: {
    /** Row height in pixels */
    rowHeight?: number;
    /** Overscan count for performance */
    overscan?: number;
  };
}