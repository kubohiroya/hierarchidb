/**
  * Location Plugin Type Definitions
   */

//  @hierarchidb/_obsolate_common-type
import type { ISO2, NodeId, TreeId } from '@hierarchidb/core-types';
export type { NodeId } from '@hierarchidb/core-types';
import type { TabularFilterRule, TabularSelectionConfig } from '@hierarchidb/ui-tabular';

// ================================
// Entity Types
// ================================

import type { Timestamp } from '@hierarchidb/core-types';
import type {
  LocationEntity as LocationEntityDefinition,
  LocationDataSource,
  LocationBuildConfig,
  LocationBuildFilterCriteria,
  LocationBuildProcessingOptions,
  LocationType,
  LocationSearchConfig,
  LocationIconConfig,
  LocationIconId,
  LocationLabelConfig,
  LocationRepresentationByZoomLevelConfig,
} from '../entities/LocationEntity.js';
import type {
  LocationPointProperties,
  LocationPointKind,
  LocationPointId,
} from '../entities/LocationPoint.js';

export type LocationEntity = LocationEntityDefinition;
export type {
  LocationDataSource,
  LocationType,
  LocationBuildConfig,
  LocationBuildFilterCriteria,
  LocationBuildProcessingOptions,
  LocationSearchConfig,
  LocationPointProperties,
  LocationPointKind,
  LocationPointId,
  LocationIconConfig,
  LocationIconId,
  LocationLabelConfig,
  LocationRepresentationByZoomLevelConfig,
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
} from '@hierarchidb/location-api';
export type { LocationPeerData, LocationGroupItemData, LocationRelationMeta };
