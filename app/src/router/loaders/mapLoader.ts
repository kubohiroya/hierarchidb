/**
 * Map Loader for TanStack Router
 * 
 * Handles parsing and formatting of map position (zxy) parameters
 */

export interface MapViewState {
  longitude: number;
  latitude: number;
  zoom: number;
}

// Default initial position (world view)
export const DEFAULT_VIEW_STATE: MapViewState = {
  longitude: 0,
  latitude: 0,
  zoom: 2,
};

/**
 * Parse zxy parameter from URL
 * Format: zxy=zoom,longitude,latitude
 * Example: zxy=3,135,40
 * 
 * @param zxy - The zxy parameter string from URL
 * @returns Parsed view state or null if invalid
 */
export function parseZxyParam(zxy: string | null): MapViewState | null {
  if (!zxy) return null;

  const parts = zxy.split(',');
  
  // BUG FIX: Changed from "parts.length === 3" to "parts.length !== 3"
  // The original condition would return null when we have exactly 3 parts,
  // which is the expected format!
  if (parts.length !== 3) return null;

  const zoom = parts[0] ? parseFloat(parts[0]) : 2;
  const longitude = parts[1] ? parseFloat(parts[1]) : 0;
  const latitude = parts[2] ? parseFloat(parts[2]) : 0;

  // Validate parsed values
  if (isNaN(zoom) || isNaN(longitude) || isNaN(latitude)) return null;
  if (zoom < 0 || zoom > 22) return null;
  if (longitude < -180 || longitude > 180) return null;
  if (latitude < -90 || latitude > 90) return null;

  return { zoom, longitude, latitude };
}

/**
 * Format view state to zxy parameter
 * 
 * @param viewState - The map view state to format
 * @returns Formatted zxy string
 */
export function formatZxyParam(viewState: MapViewState): string {
  // Round values for cleaner URLs
  const zoom = Math.round(viewState.zoom * 100) / 100;
  const longitude = Math.round(viewState.longitude * 10000) / 10000;
  const latitude = Math.round(viewState.latitude * 10000) / 10000;

  return `${zoom},${longitude},${latitude}`;
}

/**
 * Map loader for TanStack Router
 * 
 * @param search - Search params from route
 * @returns Initial view state for the map
 */
export function mapLoader(search: Record<string, unknown>): MapViewState {
  const zxy = typeof search.zxy === 'string' ? search.zxy : null;
  return parseZxyParam(zxy) || DEFAULT_VIEW_STATE;
}
