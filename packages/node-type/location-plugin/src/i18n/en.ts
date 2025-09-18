/**
 * English translations for Location Plugin
 */

import type { LocationPluginTranslations } from './types.js';

export const en: LocationPluginTranslations = {
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

  // Basic info step
  basicInfo: {
    title: 'Basic Information',
    subtitle: 'Configure basic settings for location data. Use tags and categories to classify and search locations easily.',
    nameLabel: 'Location Data Name',
    nameHelperText: 'Enter a clear and descriptive dataset name',
    nameRequired: 'Location data name is required',
    descriptionLabel: 'Description',
    descriptionHelperText: 'Describe the purpose and content of the dataset (optional)',
    categoryLabel: 'Category',
    categoryHelperText: 'Select the category for location data',
    tagsLabel: 'Tags',
    tagsHelperText: 'Enter tags for search and filtering, separated by commas (optional)',
    tagsPlaceholder: 'tag1, tag2, tag3',
    hint: '💡 Tip: Setting appropriate names and tags makes data easier to find later',
  },

  // Selection step
  selection: {
    title: 'Location Selection',
    subtitle: 'Select the location data to retrieve. You can specify data by country and location type combinations.',
    alertMessage: 'Select the location data to retrieve. You can specify data by country and location type combinations.',
    matrixTitle: 'Selection Matrix',
    settingsTitle: 'Detailed Settings by Location Type',
    searchPlaceholder: 'Search by country name...',
    continentFilter: 'Continent Filter',
    showSelectedOnly: 'Show Selected Only',
    selectAll: 'Select All',
    deselectAll: 'Deselect All',
    selectedCount: 'Selected Count',
    estimatedSize: 'Estimated Data Size',
  },

  // Batch processing
  batch: {
    progressTitle: 'Progress',
    logsTitle: 'Logs',
    mapPreviewTitle: 'Map Preview',
    dataTableTitle: 'Data Table',
    pause: 'Pause',
    resume: 'Resume',
    cancel: 'Cancel',
    download: 'Download',
    exportLogs: 'Export Logs',
    stages: {
      download: 'Download',
      filtering: 'Filtering',
      clustering: 'Clustering',
      indexing: 'Indexing',
    },
  },

  // Location types
  locationTypes: {
    airport: 'Airport',
    railway_station: 'Railway Station',
    bus_stop: 'Bus Stop',
    port: 'Port',
    hospital: 'Hospital',
    school: 'School',
    university: 'University',
    tourist_attraction: 'Tourist Attraction',
    hotel: 'Hotel',
    restaurant: 'Restaurant',
    shopping: 'Shopping',
    park: 'Park',
    library: 'Library',
    museum: 'Museum',
    bank: 'Bank',
    post_office: 'Post Office',
    fire_station: 'Fire Station',
    police: 'Police',
    government: 'Government',
    religious: 'Religious',
  },

  // Categories
  categories: {
    transportation: 'Transportation',
    administrative: 'Administrative',
    infrastructure: 'Infrastructure',
  },

  // Error messages
  errors: {
    nameRequired: 'Name is required',
    invalidSelection: 'Invalid selection',
    processingFailed: 'Processing failed',
    networkError: 'Network error occurred',
    dataNotFound: 'Data not found',
  },
};