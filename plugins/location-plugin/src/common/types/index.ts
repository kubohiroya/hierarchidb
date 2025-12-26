/**
  * Location Plugin Type Definitions
   */

//  @hierarchidb/_obsolate_common-type
import type { NodeId, TreeId } from '@hierarchidb/common-types';
export type { NodeId } from '@hierarchidb/common-types';
import type { TabularFilterRule, TabularSelectionConfig } from '@hierarchidb/ui-tabular';

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
  LocationType,
  LocationSearchConfig,
} from '../entities/LocationEntity.js';
export type {
  LocationPoint,
  LocationPointProperties,
  LocationPointKind,
  LocationPointId,
} from '../entities/LocationPoint.js';

export type LocationEntity = LocationEntityDefinition;
export type {
  LocationDataSource,
  LocationType,
  LocationBatchConfig,
  LocationBatchFilterCriteria,
  LocationBatchProcessingOptions,
  LocationSearchConfig,
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
    selectedArrayByCountries?: Record<string, boolean[]>;
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
  selectedArrayByCountries?: Record<string, boolean[]>;
  concurrentDownloads?: number;
  licenseAgreement?: boolean;
  licenseAgreedAt?: Timestamp;
  batchSessionId?: string;
  lastProcessedAt?: number;
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
