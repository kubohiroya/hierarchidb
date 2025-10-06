/**
  * Location Plugin Type Definitions
   */

//  @hierarchidb/common-type
import type { NodeId } from '@hierarchidb/common-type';
export type { NodeId } from '@hierarchidb/common-type';

// ================================
// Entity Types
// ================================

import type { Timestamp } from '@hierarchidb/common-type';
import type { WorkingCopyDraft } from '@hierarchidb/plugins-base-plugin';
import type {
  LocationEntity as LocationEntityDefinition,
  LocationDataSource,
  LocationBatchConfig,
  LocationBatchFilterCriteria,
  LocationBatchProcessingOptions,
  LocationCategory,
  LocationType,
  LocationSearchConfig,
  LocationAddress,
  LocationAttributes,
} from '../entities/LocationEntity.js';
export type {
  LocationPoint,
  LocationPointProperties,
  LocationPointKind,
  LocationPointSource,
} from '../entities/LocationPoint.js';

export type LocationEntity = LocationEntityDefinition;
export type {
  LocationDataSource,
  LocationCategory,
  LocationType,
  LocationBatchConfig,
  LocationBatchFilterCriteria,
  LocationBatchProcessingOptions,
  LocationSearchConfig,
  LocationAddress,
  LocationAttributes,
};

export type LocationWorkingCopy = WorkingCopyDraft<LocationEntityDefinition> & {
  dataSource?: LocationDataSource;
  selectionMatrix?: boolean[][];
  concurrentDownloads?: number;
  licenseAgreement?: boolean;
  licenseAgreedAt?: Timestamp;
  category?: LocationCategory;
  type?: LocationType;
  tilesMinZoom?: number;
  tilesMaxZoom?: number;
  tags?: string[];
  name?: string;
  description?: string;
};

export interface UpdateLocationData {
  dataSource?: LocationDataSource;
  selectionMatrix?: boolean[][];
  concurrentDownloads?: number;
  licenseAgreement?: boolean;
  licenseAgreedAt?: number;
  batchSessionId?: string;
  lastProcessedAt?: number;
  category?: LocationCategory;
  type?: LocationType;
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
  onSuccess?: (entity: LocationWorkingCopy) => void;
  onError?: (error: Error) => void;
}

// Worker entity metadata types
export type {
  LocationPeerData,
  LocationGroupItemData,
  LocationRelationMeta,
} from './entities.js';
export type {
  OsmPointPayload,
  OverpassPointPayload,
  GeoNamesPointPayload,
  WikidataPointPayload,
  CustomPointPayload,
  LocationPointPayloadBySource,
  LocationPointPayloadUnion,
} from './payloads.js';
