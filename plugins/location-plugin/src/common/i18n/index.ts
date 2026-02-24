import { i18n as globalI18n } from '@hierarchidb/ui-i18n';
import en from '~/ui/locales/en.json' with { type: 'json' };
import ja from '~/ui/locales/ja.json' with { type: 'json' };

type SupportedLocale = 'en' | 'ja';

type DeepPartial<T> = T extends Function ? T : T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T;

type TranslationMap = Record<string, string>;
type SelectionSettingsTranslations = {
  generic?: TranslationMap;
  airport?: TranslationMap;
  railway_station?: TranslationMap;
  railway?: TranslationMap;
};

type LocationTranslations = {
  basicInfo: {
    title: string;
    tagSuggestions?: string[];
  };
  errors: {
    nameRequired: string;
  };
  dialog: {
    dataSourceLabel: string;
    licenseAgreementLabel: string;
    dataSourceDescription: string;
    createTitle: string;
    editTitle: string;
    datasetDescription: string;
    displayNormal: string;
    displayMaximize: string;
    displayFullscreen: string;
    cancel: string;
    save: string;
    selectDataSourceFirst: string;
  };
  panel: {
    sampleName: string;
    refresh: string;
    edit: string;
    basicInfo: string;
    dataSource: string;
    licenseAgreement: string;
    licenseAgreed: string;
    licensePending: string;
    createdAt: string;
    updatedAt: string;
    processingSettings: string;
    concurrentDownloads: string;
  };
  selection: {
    title: string;
    filterTitle?: string;
    buildLabel?: string;
    typeDescriptions?: TranslationMap;
    settingsTitle?: string;
    settingsDescription?: string;
  };
  processing?: {
    description?: string;
    concurrentDownloadsLabel?: string;
    tilingZoomLabel?: string;
    minZoom?: string;
    maxZoom?: string;
    cleanupTitle?: string;
    deleteDownloads?: string;
    deleteCache?: string;
    deleteMetadata?: string;
    deleteDownloadsDone?: string;
    deleteCacheDone?: string;
    deleteMetadataDone?: string;
    displayConfig?: {
      title?: string;
      description?: string;
      representation?: {
        title?: string;
        description?: string;
        pointLabel?: string;
        polygonLabel?: string;
        iconLabel?: string;
        iconFixedLabel?: string;
      };
      icon?: {
        title?: string;
        description?: string;
        colorLabel?: string;
        iconLabel?: string;
        sizeLabel?: string;
        options?: TranslationMap;
      };
      label?: {
        title?: string;
        description?: string;
        colorLabel?: string;
        zoomRangeLabel?: string;
        sizeLabel?: string;
        zoomStartLabel?: string;
        zoomFixedLabel?: string;
      };
    };
  };
  // Added tileSettings to reflect i18n resource structure used in UI components
  tileSettings?: {
    label?: string;
    description?: string;
    workersLabel?: string;
    zoomLabel?: string;
    minZoom?: string;
    maxZoom?: string;
  };
  selectionSettings: SelectionSettingsTranslations;
  locationTypes?: TranslationMap;
  mapPreview: {
    title: string;
    loading?: string;
    description?: string;
    error?: string;
    tabs?: TranslationMap;
    metadataEmpty?: string;
    metadataLoading?: string;
    displayModeLabel: string;
    visibleCountLabel: string;
    centerLabel: string;
    searchPlaceholder?: string;
    visiblePointsLabel?: string;
    clustersLabel?: string;
    tooltips?: TranslationMap;
    menuSettings: string;
    menuAnalytics: string;
    dialogTitle: string;
    heatmapSettings: string;
    heatmapIntensityLabel: string;
    heatmapRadiusLabel: string;
    clusterSettings: string;
    clusterRadiusLabel: string;
    maxZoomLabel: string;
    close: string;
    details: TranslationMap;
    summary?: TranslationMap;
  };
  batch: {
    phases?: TranslationMap;
    stages?: TranslationMap;
    logsDefault?: string;
    dialogTitle?: string;
    elapsed?: string;
    remaining?: string;
    progressTitle?: string;
    logsTitle?: string;
    mapPreviewTitle?: string;
    dataTableTitle?: string;
    authRequired?: string;
    authFallback?: string;
    processedLabel?: string;
    processedTotal?: string;
    throughputLabel?: string;
    throughputUnit?: string;
    errorsLabel?: string;
    errorsUnit?: string;
    stageListTitle?: string;
    stageProgress?: string;
    stageErrors?: string;
    tasksTitle?: string;
    tasksEmpty?: string;
    tasksEmptyHint?: string;
    logsEmpty?: string;
    mapPlaceholder?: string;
    close?: string;
    ariaLabel?: string;
    resumeTooltip?: string;
    pauseTooltip?: string;
    cancelTooltip?: string;
    exportTooltip?: string;
  };
  common?: {
    close?: string;
  };
};

const baseTranslations: LocationTranslations = {
  basicInfo: {
    title: 'Basic Information',
    tagSuggestions: [],
  },
  errors: {
    nameRequired: 'Name is required.',
  },
  dialog: {
    dataSourceLabel: 'Data Source',
    licenseAgreementLabel: 'License Agreement',
    dataSourceDescription: 'Choose openstreetmap for OSRM/Overpass or custom for tabular import',
    createTitle: 'Create Location',
    editTitle: 'Edit Location',
    datasetDescription: 'Define the location dataset.',
    displayNormal: 'Normal',
    displayMaximize: 'Maximize',
    displayFullscreen: 'Fullscreen',
    cancel: 'Cancel',
    save: 'Save',
    selectDataSourceFirst: 'Please select a data source first.',
  },
  panel: {
    sampleName: 'Sample Location Dataset',
    refresh: 'Refresh',
    edit: 'Edit',
    basicInfo: 'Basic Information',
    dataSource: 'Data source',
    licenseAgreement: 'License agreement',
    licenseAgreed: 'Agreed',
    licensePending: 'Pending',
    createdAt: 'Created at',
    updatedAt: 'Updated at',
    processingSettings: 'Settings',
    concurrentDownloads: 'Concurrent downloads',
  },
  selection: {
    title: 'Location Selection',
    filterTitle: 'Filter & Preview',
    buildLabel: 'Build',
    settingsTitle: 'Location type settings',
    settingsDescription: 'Refine location filters for each type.',
  },
  processing: {
    description: 'Configure download and tiling parameters for build processing.',
    concurrentDownloadsLabel: 'Concurrent Downloads',
    tilingZoomLabel: 'Tile Zoom Range',
    minZoom: 'Min zoom',
    maxZoom: 'Max zoom',
    cleanupTitle: 'Cleanup',
    deleteDownloads: 'Delete downloaded points ({count})',
    deleteCache: 'Delete cached data ({count})',
    deleteMetadata: 'Delete metadata ({count})',
    deleteDownloadsDone: 'Deleted downloaded points',
    deleteCacheDone: 'Deleted cached intermediate data',
    deleteMetadataDone: 'Deleted metadata',
    displayConfig: {
      title: 'Display Settings',
      description: 'Configure representation, icon, and label settings for each location type.',
      representation: {
        title: 'Representation by Zoom Level',
        description: 'Adjust when points, polygons, and icons appear as you zoom.',
        pointLabel: 'Point rendering (1px) starts from this zoom.',
        polygonLabel: 'Scaled polygon rendering starts from this zoom.',
        iconLabel: 'Scaled SVG icon rendering starts from this zoom.',
        iconFixedLabel: 'Icons stop scaling and become fixed size from this zoom.',
      },
      icon: {
        title: 'Icon Settings',
        description: 'Configure icon colors, symbols, and size range.',
        colorLabel: 'Icon color',
        iconLabel: 'Icon',
        sizeLabel: 'Icon size range',
        options: {
          public: 'Public',
          location_city: 'City',
          flight_takeoff: 'Flight Takeoff',
          directions_boat: 'Boat',
          train: 'Train',
          fork_right: 'Interchange',
        },
      },
      label: {
        title: 'Label Settings',
        description: 'Configure label colors, size range, and zoom thresholds.',
        colorLabel: 'Label color',
        zoomRangeLabel: 'Label zoom range',
        sizeLabel: 'Label size range',
        zoomStartLabel: 'Scaled label rendering starts from the first zoom value.',
        zoomFixedLabel: 'Labels become fixed size from the second zoom value.',
      },
    },
  },
  // Provide default tileSettings translations so components referencing translations.tileSettings won't be undefined
  tileSettings: {
    label: 'Vector Tile Settings',
    description: 'Configure vector tile generation parameters.',
    workersLabel: 'Vector tile workers',
    zoomLabel: 'Tile Zoom Range',
    minZoom: 'Min zoom',
    maxZoom: 'Max zoom',
  },
  selectionSettings: {
    generic: {
      advancedFilters: 'Configure advanced filters for this type.',
    },
    airport: {
      includeHeliports: 'Include heliports',
      activeOnly: 'Active airports only',
      commercialOnly: 'Commercial airports only',
      minRunwayLengthLabel: 'Minimum runway length: {value} m',
    },
    railway_station: {
      includeMetro: 'Include metro/light rail',
      includeAbandoned: 'Include abandoned lines',
      intercityOnly: 'Intercity only',
      minPlatformsLabel: 'Minimum platforms',
    },
    railway: {
      includeMetro: 'Include metro/light rail',
      includeAbandoned: 'Include abandoned lines',
      intercityOnly: 'Intercity only',
      minPlatformsLabel: 'Minimum platforms',
    },
  },
  mapPreview: {
    title: 'Map Preview',
    loading: 'Loading map preview...',
    error: 'Failed to load map preview.',
    description: 'Preview the generated points on the map.',
    tabs: {
      map: 'Map',
      metadata: 'Metadata',
    },
    metadataEmpty: 'No metadata available yet.',
    metadataLoading: 'Loading metadata...',
    displayModeLabel: 'Display: {mode}',
    visibleCountLabel: 'Visible: {visible}/{total}',
    centerLabel: 'Center: {lat}, {lon}',
    searchPlaceholder: 'Search locations...',
    visiblePointsLabel: 'Visible: {visible} / {total}',
    clustersLabel: 'Clusters: {count}',
    tooltips: {
      zoomIn: 'Zoom in',
      zoomOut: 'Zoom out',
      fitToData: 'Fit to data',
      currentLocation: 'Current location',
      settings: 'Settings',
    },
    menuSettings: 'Settings',
    menuAnalytics: 'Analytics',
    dialogTitle: 'Map Preview Settings',
    heatmapSettings: 'Heatmap Settings',
    heatmapIntensityLabel: 'Intensity: {value}',
    heatmapRadiusLabel: 'Radius: {value}',
    clusterSettings: 'Cluster Settings',
    clusterRadiusLabel: 'Cluster radius: {value}',
    maxZoomLabel: 'Max zoom: {value}',
    close: 'Close',
    details: {
      englishName: 'English name',
      countryCode: 'Country code',
      latitude: 'Latitude',
      longitude: 'Longitude',
    },
    summary: {
      noData: 'No vector tiles generated yet.',
      zoomRange: 'Zoom range: {min} - {max}',
      size: 'Data size: {size}',
      tiles: 'Tiles: {count}',
      layers: 'Layers: {layers}',
    },
  },
  batch: {
    logsDefault: 'Running',
    dialogTitle: 'Build Progress',
    elapsed: 'Elapsed',
    remaining: 'Remaining',
    progressTitle: 'Progress',
    logsTitle: 'Logs',
    mapPreviewTitle: 'Map Preview',
    dataTableTitle: 'Data Table',
    authRequired: 'Authentication required — {message}',
    authFallback: 'Authentication required to continue',
    processedLabel: 'Processed',
    processedTotal: '/ {total} items',
    throughputLabel: 'Throughput',
    throughputUnit: 'points/s ({rate}/s)',
    errorsLabel: 'Errors',
    errorsUnit: 'items',
    stageListTitle: 'Processing Stages',
    stageProgress: '{completed} / {total} completed',
    stageErrors: 'Errors: {count}',
    tasksTitle: 'Active Tasks',
    tasksEmpty: 'No active tasks at the moment',
    tasksEmptyHint: 'Tasks will appear here while the build is running',
    logsEmpty: 'No log entries yet',
    mapPlaceholder: 'Map preview will be added in a future implementation',
    close: 'Close',
    ariaLabel: 'Build actions',
    resumeTooltip: 'Resume',
    pauseTooltip: 'Pause',
    cancelTooltip: 'Cancel',
    exportTooltip: 'Export logs',
    stages: {
      download: 'Download',
      filtering: 'Filtering',
      clustering: 'Clustering',
      indexing: 'Indexing',
    },
  },
  common: {
    close: 'Close',
  },
};

const bundles: Record<SupportedLocale, DeepPartial<LocationTranslations>> = {
  en,
  ja,
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const mergeTranslations = <T extends Record<string, unknown>>(base: T, override?: DeepPartial<T>): T => {
  const result: Record<string, unknown> = { ...base };
  if (!override) return result as T;
  Object.entries(override as Record<string, unknown>).forEach(([key, value]) => {
    if (value === undefined) return;
    const baseValue = result[key];
    if (isPlainObject(baseValue) && isPlainObject(value)) {
      result[key] = mergeTranslations(baseValue as Record<string, unknown>, value);
      return;
    }
    result[key] = value;
  });
  return result as T;
};

const detectLocale = (): SupportedLocale => {
  const lng = globalI18n.language || 'en';
  if (lng.toLowerCase().startsWith('ja')) return 'ja';
  return 'en';
};

export const useTranslation = (ns: string = 'location-plugin') => {
  const locale = detectLocale();
  const translations = mergeTranslations<LocationTranslations>(
    baseTranslations,
    bundles[locale] ?? bundles.en,
  );
  const t = (key: string, fallback?: string) =>
    String(globalI18n.t(key, { ns, defaultValue: fallback ?? key }));
  return { t, translations, locale };
};

export const formatBytes = (bytes: number, locale: SupportedLocale = detectLocale()): string => {
  if (!Number.isFinite(bytes)) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const formatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  return `${formatter.format(value)} ${units[unitIndex]}`;
};

export const formatNumber = (value: number, locale: SupportedLocale = detectLocale()): string => {
  return new Intl.NumberFormat(locale).format(value);
};
