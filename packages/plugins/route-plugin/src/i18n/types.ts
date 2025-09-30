/**
  * i18n Types for Route Plugin
 * i18n
  */

export type SupportedLocale = 'ja' | 'en';

export interface RoutePluginTranslations {
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
    routeTypeLabel: string;
    routeTypeHelperText: string;
    transportModesLabel: string;
    transportModesHelperText: string;
    categoryLabel: string;
    categoryHelperText: string;
    tagsLabel: string;
    tagsHelperText: string;
    tagsPlaceholder: string;
    hint: string;
  };

  routeSelection: {
    title: string;
    subtitle: string;
    alertMessage: string;
    routeTypeSettings: string;
    transportModeSettings: string;
    parametersTitle: string;
    maxDistance: string;
    maxDuration: string;
    elevationGain: string;
    surfaceTypes: string;
    difficultyLevel: string;
    accessibility: string;
  };

  batch: {
    progressTitle: string;
    logsTitle: string;
    mapPreviewTitle: string;
    routeTableTitle: string;
    pause: string;
    resume: string;
    cancel: string;
    download: string;
    exportRoutes: string;
    pauseTooltip: string;
    resumeTooltip: string;
    cancelTooltip: string;
    stages: {
      planning: string;
      routing: string;
      optimization: string;
      validation: string;
      [stageKey: string]: string;
    };
    phases: {
      running: string;
      queued: string;
      completed: string;
      failed: string;
      paused: string;
      cancelled: string;
    };
    summary: {
      completedLabel: string;
      totalLabel: string;
      failedLabel: string;
      resultsLabel: string;
      lastErrorLabel: string;
      noneLabel: string;
    };
  };

  routeTypes: {
    road: string;
    railway: string;
    waterway: string;
    airway: string;
    walking: string;
    cycling: string;
    hiking: string;
    shipping: string;
    pipeline: string;
    powerline: string;
  };

  transportModes: {
    car: string;
    truck: string;
    bus: string;
    train: string;
    subway: string;
    tram: string;
    ferry: string;
    airplane: string;
    bicycle: string;
    pedestrian: string;
    motorcycle: string;
  };

  categories: {
    transportation: string;
    recreation: string;
    logistics: string;
    emergency: string;
  };

  surfaceTypes: {
    paved: string;
    unpaved: string;
    gravel: string;
    dirt: string;
    sand: string;
    grass: string;
    concrete: string;
    asphalt: string;
  };

  difficultyLevels: {
    easy: string;
    moderate: string;
    difficult: string;
    expert: string;
  };

  accessibilityFeatures: {
    wheelchair_accessible: string;
    elevator_access: string;
    audio_guidance: string;
    braille_signs: string;
    low_slope: string;
  };

  errors: {
    nameRequired: string;
    routeTypeRequired: string;
    transportModeRequired: string;
    invalidRouteData: string;
    routingFailed: string;
    networkError: string;
    dataNotFound: string;
  };
}
