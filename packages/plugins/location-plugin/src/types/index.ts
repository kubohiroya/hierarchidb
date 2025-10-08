/**
  * Location Plugin Type Definitions
   */

//  @hierarchidb/common-type
import type { NodeId } from '@hierarchidb/common-types';
export type { NodeId } from '@hierarchidb/common-types';

// ================================
// Entity Types
// ================================

import type { Timestamp } from '@hierarchidb/common-types';
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

export interface LocationWorkingCopy extends WorkingCopyDraft<LocationEntityDefinition> {
  /** Tree-level categorisation tags (persisted on the owning TreeNode). */
  tags?: string[];
  draft: WorkingCopyDraft<LocationEntityDefinition>['draft'] & {
    tilesMinZoom?: number;
    tilesMaxZoom?: number;
  };
}

export interface UpdateLocationData {
  dataSource?: LocationDataSource;
  selectionMatrix?: boolean[][];
  concurrentDownloads?: number;
  licenseAgreement?: boolean;
  licenseAgreedAt?: Timestamp;
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
