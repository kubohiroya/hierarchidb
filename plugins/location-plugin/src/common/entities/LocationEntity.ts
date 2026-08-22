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
} from '@hierarchidb/location-api';
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
}
