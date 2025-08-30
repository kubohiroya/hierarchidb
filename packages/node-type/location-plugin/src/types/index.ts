/**
 * Location Plugin Type Definitions
 * 地点情報プラグインの型定義
 */

// 簡素化された型定義（実際は@hierarchidb/common-typeから取得）
export type NodeId = string & { readonly __brand: 'NodeId' };
export type EntityId = string & { readonly __brand: 'EntityId' };
export type TagId = string & { readonly __brand: 'TagId' };

// Location Category Type
export type LocationCategory = 'transportation' | 'administrative' | 'infrastructure';

// ================================
// Location Types
// ================================

export enum LocationType {
  AIRPORT = 'airport',
  RAILWAY_STATION = 'railway_station',
  BUS_STOP = 'bus_stop',
  PORT = 'port',
  HOSPITAL = 'hospital',
  SCHOOL = 'school',
  UNIVERSITY = 'university',
  TOURIST_ATTRACTION = 'tourist_attraction',
  HOTEL = 'hotel',
  RESTAURANT = 'restaurant',
  SHOPPING = 'shopping',
  PARK = 'park',
  LIBRARY = 'library',
  MUSEUM = 'museum',
  BANK = 'bank',
  POST_OFFICE = 'post_office',
  FIRE_STATION = 'fire_station',
  POLICE = 'police',
  GOVERNMENT = 'government',
  RELIGIOUS = 'religious'
}

// ================================
// Entity Types
// ================================

export interface LocationEntity {
  id: EntityId;
  nodeId: NodeId;
  
  // Basic Information
  name: string;
  description?: string;
  tags?: TagId[];
  category?: LocationCategory;
  
  // Map Position
  zxy?: [number, number, number]; // [zoom, x(longitude), y(latitude)]
  
  // Data Source
  dataSourceName: 'openstreetmap' | 'geonames' | 'wikidata' | 'overpass';
  
  // License Agreement
  licenseAgreement: boolean;
  licenseAgreedAt?: string;
  
  // Processing Configuration
  processingConfig: LocationProcessingConfig;
  
  // Processing Status
  batchSessionId?: string;
  processingStatus?: 'idle' | 'processing' | 'completed' | 'failed';
  
  // Metadata
  createdAt: number;
  updatedAt: number;
  version: number;
}

export interface LocationWorkingCopy extends LocationEntity {
  isDraft?: boolean;
  checkboxState: Record<string, Record<LocationType, boolean>>;
  selectedCountries: string[];
  locationTypes: LocationType[];
}

// ================================
// Processing Configuration
// ================================

export interface LocationProcessingConfig {
  concurrentDownloads: number;
  corsProxyBaseURL?: string;
  enableLocationFiltering: boolean;
  enableClustering: boolean;
  enableGeocoding: boolean;
  maxLocationsPerType?: number;
  bufferRadius?: number;
  clusteringRadius?: number;
  minClusterSize?: number;
  geocodingLanguage?: string;
}

// ================================
// Statistics Types
// ================================

export interface LocationStatistics {
  totalLocations: number;
  locationsByType: Record<string, number>;
  locationsByCountry: Record<string, number>;
  averageElevation?: number;
  totalCapacity?: number;
}

// ================================
// Create/Update Data Types
// ================================

export interface UpdateLocationData {
  name?: string;
  description?: string;
  processingConfig?: LocationProcessingConfig;
}

// ================================
// UI State Types
// ================================

export interface LocationDialogProps {
  mode: 'create' | 'edit';
  nodeId?: NodeId;
  parentId?: NodeId;
  open: boolean;
  onClose: () => void;
}