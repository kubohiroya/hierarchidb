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
    stages: {
      download: string;
      filtering: string;
      clustering: string;
      indexing: string;
    };
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