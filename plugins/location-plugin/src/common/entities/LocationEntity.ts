import type { ISO2, PeerEntity, Timestamp } from '@hierarchidb/core-types';
import type {
  IdeGsmSourceEntry,
  LocationBatchFilterCriteria,
  LocationBatchProcessingOptions,
  LocationDataSource,
  LocationIconConfig,
  LocationLabelConfig,
  LocationProcessingStatus,
  LocationRepresentationByZoomLevelConfig,
  LocationSearchConfig,
} from '@hierarchidb/location-api';

export type {
  LocationType,
  LocationDataSource,
  LocationProcessingStatus,
  LocationBatchFilterCriteria,
  LocationBatchProcessingOptions,
  LocationSearchOptions,
  LocationSearchConfig,
  LocationRepresentationByZoomLevelConfig,
  LocationIconConfig,
  LocationIconId,
  LocationLabelConfig,
  IdeGsmSourceEntry,
} from '@hierarchidb/location-api';

export interface LocationEntityPayload {
  dataSource: LocationDataSource;
  licenseAgreement: boolean;
  licenseAgreedAt?: Timestamp;
  ideGsmFileName?: string;
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

export interface LocationBatchConfig {
  searchConfigs: LocationSearchConfig[];
  concurrentDownloads?: number;
  processingOptions: LocationBatchProcessingOptions;
  filterCriteria?: LocationBatchFilterCriteria;
}
