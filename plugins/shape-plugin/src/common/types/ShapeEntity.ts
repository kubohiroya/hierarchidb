import type { NodeId } from '@hierarchidb/common-types';
import type { Geometry } from 'geojson';
import type { TabularTableMetadata } from '@hierarchidb/tabular-store';
import type { TabularDataResult } from '@hierarchidb/ui-tabular';
import type { BatchConfig, DataSourceName } from '@hierarchidb/shape-plugin';
import type { ISO2 } from '@hierarchidb/common-types';

export interface ShapeEntity {
  // Identifiers
  id?: string;
  nodeId?: NodeId;

  // Geometry / properties
  geometry?: Geometry;
  properties?: Record<string, unknown>;

  tabularMetadataId?: string;
  tabularFilters?: unknown; // kept broad; concrete type in data-source module
  tabularMetadata?: TabularTableMetadata | null;
//tabularFile?: TabularFileSummary;
  tabularLastPreview?: TabularDataResult;

  // License Agreement
  licenseAgreement?: boolean;
  licenseAgreedAt?: string;

  // Data source (legacy, derived from batchConfig.dataSource)
  dataSourceName?: DataSourceName;

// Processing Configuration
  batchConfig?: BatchConfig;

// Country & Admin Selection
  selectedArrayByCountries?: SelectedArrayByCountries;
  // Processing Status
  batchSessionId?: string;
  processingStatus?: 'idle' | 'processing' | 'paused' | 'completed' | 'failed';
  tileSummary?: { tiles: number; totalBytes: number; zoomMin?: number; zoomMax?: number };
  buildStartedAt?: number;
  buildFinishedAt?: number;
}

export type SelectedArrayByCountries = Record<ISO2, boolean[]>;
