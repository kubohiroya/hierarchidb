/**
  * Location Plugin Type Definitions
   */

//  @hierarchidb/_obsolate_common-type
import type { NodeId, TreeId } from '@hierarchidb/common-types';
export type { NodeId } from '@hierarchidb/common-types';
import type { TabularFilterRule, TabularSelectionConfig } from '@hierarchidb/ui-tabular-extract';

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
  LocationFeature,
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
  LocationFeature,
};

export interface LocationDraft extends Partial<LocationEntityDefinition> {
  treeNodeId: NodeId;
  /** console-level categorisation tags (persisted on the owning TreeNode). */
  tags?: string[];
  dataSource?: LocationDataSource;
  tabularSourceId?: string;
  extractConfig?: {
    filterRules?: TabularFilterRule[];
    selection?: TabularSelectionConfig;
  };
  draft: Partial<LocationEntityDefinition> & {
    name?: string;
    description?: string;
    tags?: string[];
    selectionMatrix?: boolean[][];
    concurrentDownloads?: number;
    licenseAgreement?: boolean;
    dataSource?: LocationDataSource;
    tabularSourceId?: string;
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
  treeId?: TreeId;
  open: boolean;
  onClose: () => void;
  onSuccess?: (entity: LocationDraft) => void;
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
