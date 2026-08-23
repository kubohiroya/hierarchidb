import type { ISO2, PeerEntity, Timestamp } from '@hierarchidb/core-types';
import type {
  IdeGsmSourceEntry,
  LocationBuildFilterCriteria,
  LocationBuildProcessingOptions,
  LocationDataSource,
  LocationIconConfig,
  LocationLabelConfig,
  LocationProcessingStatus,
  LocationRepresentationByZoomLevelConfig,
  LocationSearchConfig,
  LocationType,
} from '@hierarchidb/location-api';
import type { TileEmitConfig } from '@hierarchidb/gis-sdk';
import type { NodePayload } from '@hierarchidb/tree-api';

export type {
  IdeGsmSourceEntry,
  LocationBuildFilterCriteria,
  LocationBuildProcessingOptions,
  LocationDataSource,
  LocationIconConfig,
  LocationIconId,
  LocationLabelConfig,
  LocationProcessingStatus,
  LocationRepresentationByZoomLevelConfig,
  LocationSearchConfig,
  LocationSearchOptions,
  LocationType,
} from '@hierarchidb/location-api';

export interface LocationMvtZoomBandConfig {
  id: string;
  minZoom: number;
  maxZoom: number;
  types: LocationType[];
  maxRenderRank?: number;
  minImportance?: number;
}

export interface LocationMvtBuildConfig {
  schemaVersion: 1;
  sourceLayer: 'location_points';
  encoderVersion: string;
  zoomBands: LocationMvtZoomBandConfig[];
  tileEmitConfig: TileEmitConfig;
}

export interface LocationEntityPayload extends NodePayload {
  dataSource: LocationDataSource;
  licenseAgreement: boolean;
  licenseAgreedAt?: Timestamp;
  ideGsmFileName?: string;
  ideGsmFileSizeBytes?: number;
  ideGsmSourceUrl?: string;
  ideGsmSources?: IdeGsmSourceEntry[];
  ideGsmSelectionHash?: string;
  selectedArrayByCountries: Record<ISO2, boolean[]>;
  tilesMinZoom?: number;
  tilesMaxZoom?: number;
  concurrentDownloads: number;
  lastProcessedAt?: Timestamp;
  processingStatus?: LocationProcessingStatus;
  processedAt?: Timestamp;
  tabularSourceId?: string;
  extractConfig?: Record<string, unknown>;
  representationByZoomLevelConfig?: LocationRepresentationByZoomLevelConfig;
  iconConfig?: LocationIconConfig;
  labelConfig?: LocationLabelConfig;
}

export type LocationEntity = PeerEntity<LocationEntityPayload>;

export interface LocationBuildConfig {
  searchConfigs: LocationSearchConfig[];
  concurrentDownloads?: number;
  processingOptions: LocationBuildProcessingOptions;
  filterCriteria?: LocationBuildFilterCriteria;
  mvt: LocationMvtBuildConfig;
}
