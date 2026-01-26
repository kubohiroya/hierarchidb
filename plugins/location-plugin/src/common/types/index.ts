/**
  * Location Plugin Type Definitions
   */

//  @hierarchidb/_obsolate_common-type
import type { ISO2, NodeId, TreeId } from '@hierarchidb/common-types';
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
  LocationPoint,
  LocationPointProperties,
  LocationPointKind,
  LocationPointId,
  LocationIconConfig,
  LocationIconId,
  LocationLabelConfig,
  LocationRepresentationByZoomLevelConfig
} from '@hierarchidb/location-store';

export type LocationEntity = LocationEntityDefinition;
export type {
  LocationDataSource,
  LocationType,
  LocationBatchConfig,
  LocationBatchFilterCriteria,
  LocationBatchProcessingOptions,
  LocationSearchConfig,
  LocationPoint,
  LocationPointProperties,
  LocationPointKind,
  LocationPointId,
  LocationIconConfig,
  LocationIconId,
  LocationLabelConfig,
  LocationRepresentationByZoomLevelConfig,
};
export type { BatchConfig, UnifiedLocationBatchConfig } from '@hierarchidb/location-store';

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
    selectedArrayByCountries?: Record<ISO2, boolean[]>;
    concurrentDownloads?: number;
    tileWorkers?: number;
    licenseAgreement?: boolean;
    dataSource?: LocationDataSource;
    tabularSourceId?: string;
    tilesMinZoom?: number;
    tilesMaxZoom?: number;
  };
}

export interface UpdateLocationData {
  dataSource?: LocationDataSource;
  selectedArrayByCountries?: Record<ISO2, boolean[]>;
  concurrentDownloads?: number;
  tileWorkers?: number;
  licenseAgreement?: boolean;
  licenseAgreedAt?: Timestamp;
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
import type {
  LocationPeerData,
  LocationGroupItemData,
  LocationRelationMeta,
} from '@hierarchidb/location-store';
export type { LocationPeerData, LocationGroupItemData, LocationRelationMeta };
