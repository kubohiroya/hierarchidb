/**
  * Folder plugin constants - UIWorker
  */

/**
 * Folder validation constants
 */
export const FOLDER_VALIDATION = {
  NAME_MIN_LENGTH: 1,
  NAME_MAX_LENGTH: 255,
  DESCRIPTION_MAX_LENGTH: 1000,
  MAX_TAGS: 10,
  MAX_TAG_LENGTH: 50,
  MAX_DEPTH: 20,
  MAX_CHILDREN_DEFAULT: 1000,
  MAX_CHILDREN_ABSOLUTE: 10000,
} as const;

/**
 * Folder display constants
 */
export const FOLDER_DISPLAY = {
  ICON_COLORS: [
    '#1976d2', // Blue
    '#388e3c', // Green
    '#f57c00', // Orange
    '#d32f2f', // Red
    '#7b1fa2', // Purple
    '#455a64', // Blue Grey
    '#e64a19', // Deep Orange
    '#00796b', // Teal
    '#303f9f', // Indigo
    '#c2185b',  // Pink
  ] as const,

  DEFAULT_ICON_COLOR: '#FFC107',
  DEFAULT_ICON_TYPE: 'default' as const,

  SORT_ORDERS: ['name', 'date', 'type', 'custom'] as const,
  DEFAULT_SORT_ORDER: 'name' as const,
  DEFAULT_SORT_DIRECTION: 'asc' as const,

  VIEW_MODES: ['list', 'grid', 'console'] as const,
  DEFAULT_VIEW_MODE: 'list' as const,
} as const;

