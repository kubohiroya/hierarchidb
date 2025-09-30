/**
  * i18n Types for Location Plugin
 * i18n
  */

export type SupportedLocale = 'ja' | 'en';

export interface LocationPluginTranslations {
  common: {
    name: string;
    description: string;
    category: string;
    tags: string;
    required: string;
    optional: string;
    save: string;
    cancel: string;
    close: string;
    loading: string;
    error: string;
    success: string;
    warning: string;
    yes: string;
    no: string;
    enabled: string;
    disabled: string;
    points: string;
    items: string;
  };

  panel: {
    sampleName: string;
    sampleDescription: string;
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
    filtering: string;
    clustering: string;
    geocoding: string;
  };

  basicInfo: {
    title: string;
    subtitle: string;
    nameLabel: string;
    nameHelperText: string;
    nameRequired: string;
    descriptionLabel: string;
    descriptionHelperText: string;
    categoryLabel: string;
    categoryHelperText: string;
    tagsLabel: string;
    tagsHelperText: string;
    tagsPlaceholder: string;
    hint: string;
  };

  selection: {
    title: string;
    subtitle: string;
    alertMessage: string;
    matrixTitle: string;
    settingsTitle: string;
    searchPlaceholder: string;
    continentFilter: string;
    showSelectedOnly: string;
    selectAll: string;
    deselectAll: string;
    selectedCount: string;
    estimatedSize: string;
    typeDescriptions: Record<string, string>;
  };

  selectionMatrix: {
    selectedCountLabel: string;
    estimatedSizeLabel: string;
    processingTimeLabel: string;
    processingLessThanMinute: string;
    processingAboutMinutes: string;
    processingMinutesText: string;
    processingAboutHours: string;
    columnHeader: string;
    tooltipSelectAll: string;
    tooltipEstimated: string;
    tooltipData: string;
    noResults: string;
  };

  selectionSettings: {
    detailSettingsTitle: string;
    typeDetailTitle: string;
    airport: {
      includeHeliports: string;
      activeOnly: string;
      commercialOnly: string;
      minRunwayLengthLabel: string;
      minRunwayLengthShort: string;
      minRunwayLengthMedium: string;
      minRunwayLengthLong: string;
    };
    railwayStation: {
      includeMetro: string;
      includeAbandoned: string;
      intercityOnly: string;
      minPlatformsLabel: string;
    };
    port: {
      includeMarinas: string;
      cargoOnly: string;
      activeOnly: string;
      minDepthLabel: string;
    };
    administrative: {
      adminLevelLabel: string;
      adminLevelCountry: string;
      adminLevelState: string;
      adminLevelCity: string;
      adminLevelDistrict: string;
      minPopulationLabel: string;
      capitalOnly: string;
      includeHistorical: string;
    };
    interchange: {
      includeInterchanges: string;
      namedOnly: string;
      excludeServiceAreas: string;
    };
  };

  batch: {
    progressTitle: string;
    logsTitle: string;
    mapPreviewTitle: string;
    dataTableTitle: string;
    pause: string;
    resume: string;
    cancel: string;
    download: string;
    exportLogs: string;
    dialogTitle: string;
    elapsed: string;
    remaining: string;
    processedLabel: string;
    throughputLabel: string;
    throughputUnit: string;
    errorsLabel: string;
    errorCountUnit: string;
    processedTotal: string;
    errorsUnit: string;
    stageProgress: string;
    stageErrors: string;
    stageListTitle: string;
    tasksTitle: string;
    authRequired: string;
    authFallback: string;
    logsEmpty: string;
    logsDefault: string;
    mapPlaceholder: string;
    close: string;
    ariaLabel: string;
    resumeTooltip: string;
    pauseTooltip: string;
    cancelTooltip: string;
    exportTooltip: string;
    stages: {
      download: string;
      filtering: string;
      clustering: string;
      indexing: string;
    };
    tasksEmpty: string;
    tasksEmptyHint: string;
    phases: {
      running: string;
      queued: string;
      completed: string;
      failed: string;
      paused: string;
      cancelled: string;
    };
  };

  mapPreview: {
    searchPlaceholder: string;
    visiblePointsLabel: string;
    clustersLabel: string;
    title: string;
    displayModeLabel: string;
    visibleCountLabel: string;
    centerLabel: string;
    zoomLabel: string;
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
    details: {
      englishName: string;
      countryCode: string;
      latitude: string;
      longitude: string;
    };
    tooltips: {
      zoomIn: string;
      zoomOut: string;
      fitToData: string;
      currentLocation: string;
      settings: string;
    };
  };

  dialog: {
    createTitle: string;
    editTitle: string;
    stepLabel: string;
    nameLabel: string;
    descriptionLabel: string;
    dataSourceLabel: string;
    licenseAgreementLabel: string;
    save: string;
    cancel: string;
  };

  locationTypes: {
    airport: string;
    railway_station: string;
    bus_stop: string;
    port: string;
    hospital: string;
    school: string;
    university: string;
    tourist_attraction: string;
    hotel: string;
    restaurant: string;
    shopping: string;
    park: string;
    library: string;
    museum: string;
    bank: string;
    post_office: string;
    fire_station: string;
    police: string;
    government: string;
    religious: string;
    interchange?: string;
  };

  categories: {
    transportation: string;
    administrative: string;
    infrastructure: string;
  };

  errors: {
    nameRequired: string;
    invalidSelection: string;
    processingFailed: string;
    networkError: string;
    dataNotFound: string;
  };
}
