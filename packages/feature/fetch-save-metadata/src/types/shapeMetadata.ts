/**
 * Country metadata structure
 */
export interface ShapeMetadata {
  id: string;
  name: string;
  countryName: string;
  countryCode: string;
  iso2: string;
  iso3: string;
  continent: string;
  region: string;
  subregion: string;
  adminLevels: number[];
  numAdminLevels: number;
  bbox: [number, number, number, number];
  population?: number;
  area?: number;
}

export type ShapeDataSourceName = 'GADM' | 'GeoBoundaries' | 'NaturalEarth' | 'OpenStreetMap';
