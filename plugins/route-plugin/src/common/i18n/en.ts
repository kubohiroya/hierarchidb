/**
 * English translations for Route Plugin
 */

import type { RoutePluginTranslations } from './types.js';

export const en: RoutePluginTranslations = {
  // Common
  common: {
    name: 'Name',
    description: 'Description',
    category: 'Category',
    tags: 'Tags',
    required: 'Required',
    optional: 'Optional',
    save: 'Save',
    cancel: 'Cancel',
    close: 'Close',
    loading: 'Loading...',
    error: 'Error',
    success: 'Success',
    warning: 'Warning',
  },

  dataSource: {
    title: 'Data Source',
    description: 'Choose the primary dataset or service that provides route geometry.',
    selectionTitle: 'Data Source',
    detailsTitle: 'Data Source Details',
    licenseRequired: 'License agreement is required to proceed.',
    clearCache: 'Clear cache for selected data source',
    cacheCleared: 'Cleared cache for selected data source.',
    cacheClearFailed: 'Failed to clear data source cache.',
    cacheMissing: 'Select a data source first.',
    cacheMissingNode: 'NodeId is missing.',
  },

  // Basic info
  basicInfo: {
    title: 'Route Basic Information',
    subtitle: 'Configure basic settings for route information. Specify route types and transportation modes to classify routes.',
    nameLabel: 'Route Name',
    nameHelperText: 'Enter a clear and descriptive route name',
    nameRequired: 'Route name is required',
    descriptionLabel: 'Description',
    descriptionHelperText: 'Describe the purpose and characteristics of the route (optional)',
    routeTypeLabel: 'Route Type',
    routeTypeHelperText: 'Select the type of route',
    transportModesLabel: 'Supported Transport Modes',
    transportModesHelperText: 'Select transportation modes available for this route',
    categoryLabel: 'Category',
    categoryHelperText: 'Select the route category',
    tagsLabel: 'Tags',
    tagsHelperText: 'Enter tags for search and filtering, separated by commas (optional)',
    tagsPlaceholder: 'tag1, tag2, tag3',
    hint: '💡 Tip: Setting appropriate route types and transportation modes helps users find routes that match their needs',
  },

  // Route selection
  routeSelection: {
    title: 'Route Selection & Configuration',
    subtitle: 'Configure conditions for routes to retrieve or generate. You can specify routes by region, route type, and transportation mode combinations.',
    alertMessage: 'Configure conditions for routes to retrieve or generate. You can specify routes by region, route type, and transportation mode combinations.',
    routeTypeSettings: 'Route Type Settings',
    transportModeSettings: 'Transport Mode Settings',
    parametersTitle: 'Route Parameters',
    maxDistance: 'Max Distance (km)',
    maxDuration: 'Max Duration (min)',
    elevationGain: 'Elevation Gain (m)',
    surfaceTypes: 'Surface Types',
    difficultyLevel: 'Difficulty Level',
    accessibility: 'Accessibility',
  },

  // Build processing
  build: {
    progressTitle: 'Progress',
    logsTitle: 'Logs',
    mapPreviewTitle: 'Route Preview',
    routeTableTitle: 'Route Table',
    pause: 'Pause',
    resume: 'Resume',
    cancel: 'Cancel',
    download: 'Download',
    exportRoutes: 'Export Routes',
    pauseTooltip: 'Pause processing',
    resumeTooltip: 'Resume processing',
    cancelTooltip: 'Cancel build',
    stages: {
      planning: 'Route Planning',
      routing: 'Route Generation',
      optimization: 'Optimization',
      validation: 'Validation',
      resolving_locations: 'Resolving Locations',
      generating_routes: 'Generating Routes',
      validating: 'Validating Results',
      optimizing: 'Optimization',
      download: 'Download',
      extract1: 'Extracting Geometry',
      extract2: 'Validating Geometry',
      tileEmit: 'TileEmit Generation',
    },
    phases: {
      running: 'Running',
      queued: 'Queued',
      completed: 'Completed',
      failed: 'Failed',
      paused: 'Paused',
    },
    summary: {
      completedLabel: 'Completed',
      totalLabel: 'Total',
      failedLabel: 'Failed',
      resultsLabel: 'Results',
      lastErrorLabel: 'Last error',
      noneLabel: 'None',
    },
  },

  // Route types
  routeTypes: {
    road: 'Road',
    railway: 'Railway',
    waterway: 'Waterway',
    airway: 'Airway',
    walking: 'Walking',
    cycling: 'Cycling',
    hiking: 'Hiking',
    shipping: 'Shipping',
    pipeline: 'Pipeline',
    powerline: 'Power Line',
  },

  // Transport modes
  transportModes: {
    car: 'Car',
    truck: 'Truck',
    bus: 'Bus',
    train: 'Train',
    subway: 'Subway',
    tram: 'Tram',
    ferry: 'Ferry',
    airplane: 'Airplane',
    bicycle: 'Bicycle',
    pedestrian: 'Pedestrian',
    motorcycle: 'Motorcycle',
  },

  // Categories
  categories: {
    transportation: 'Transportation',
    recreation: 'Recreation',
    logistics: 'Logistics',
    emergency: 'Emergency',
  },

  // Surface types
  surfaceTypes: {
    paved: 'Paved',
    unpaved: 'Unpaved',
    gravel: 'Gravel',
    dirt: 'Dirt',
    sand: 'Sand',
    grass: 'Grass',
    concrete: 'Concrete',
    asphalt: 'Asphalt',
  },

  // Difficulty levels
  difficultyLevels: {
    easy: 'Easy',
    moderate: 'Moderate',
    difficult: 'Difficult',
    expert: 'Expert',
  },

  // Accessibility features
  accessibilityFeatures: {
    wheelchair_accessible: 'Wheelchair Accessible',
    elevator_access: 'Elevator Access',
    audio_guidance: 'Audio Guidance',
    braille_signs: 'Braille Signs',
    low_slope: 'Low Slope',
  },

  // Error messages
  errors: {
    nameRequired: 'Route name is required',
    routeTypeRequired: 'Route type is required',
    transportModeRequired: 'At least one transport mode must be selected',
    invalidRouteData: 'Invalid route data',
    routingFailed: 'Route generation failed',
    networkError: 'Network error occurred',
    dataNotFound: 'Data not found',
  },
};
