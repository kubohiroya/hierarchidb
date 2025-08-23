/**
 * Folder plugin constants - UI・Worker共通定数
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
  MAX_CHILDREN_ABSOLUTE: 10000
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
    '#c2185b'  // Pink
  ] as const,
  
  DEFAULT_ICON_COLOR: '#FFC107',
  DEFAULT_ICON_TYPE: 'default' as const,
  
  SORT_ORDERS: ['name', 'date', 'type', 'custom'] as const,
  DEFAULT_SORT_ORDER: 'name' as const,
  DEFAULT_SORT_DIRECTION: 'asc' as const,
  
  VIEW_MODES: ['list', 'grid', 'tree'] as const,
  DEFAULT_VIEW_MODE: 'list' as const
} as const;

/**
 * Folder permission constants
 */
export const FOLDER_PERMISSIONS = {
  OPERATIONS: [
    'read',
    'write', 
    'delete',
    'move',
    'create_child',
    'modify_permissions',
    'access_statistics'
  ] as const,
  
  DEFAULT_PERMISSIONS: {
    isPublic: false,
    isReadOnly: false,
    allowedUsers: [],
    deniedUsers: []
  }
} as const;

/**
 * Folder search constants
 */
export const FOLDER_SEARCH = {
  DEFAULT_LIMIT: 50,
  MAX_LIMIT: 500,
  MIN_SEARCH_LENGTH: 1,
  SEARCH_DEBOUNCE_MS: 300,
  
  SEARCHABLE_FIELDS: [
    'name',
    'description', 
    'tags',
    'metadata'
  ] as const
} as const;

/**
 * Folder statistics constants
 */
export const FOLDER_STATISTICS = {
  CACHE_TTL: 5 * 60 * 1000, // 5 minutes
  BATCH_SIZE: 100,
  MAX_ANALYTICS_POINTS: 365, // 1 year of daily data
  
  METRICS: [
    'childCount',
    'descendantCount',
    'totalSize',
    'accessCount',
    'lastAccessedAt'
  ] as const
} as const;

/**
 * Folder template constants
 */
export const FOLDER_TEMPLATES = {
  MAX_TEMPLATES_PER_USER: 50,
  MAX_TEMPLATE_DEPTH: 10,
  MAX_TEMPLATE_NODES: 100,
  
  BUILT_IN_TEMPLATES: [
    {
      id: 'project-basic',
      name: 'Basic Project',
      description: 'Standard project folder structure',
      category: 'project'
    },
    {
      id: 'documentation',
      name: 'Documentation',
      description: 'Documentation folder structure',
      category: 'content'
    },
    {
      id: 'research',
      name: 'Research',
      description: 'Research project organization',
      category: 'academic'
    }
  ] as const
} as const;

/**
 * Folder bookmark constants
 */
export const FOLDER_BOOKMARKS = {
  MAX_BOOKMARKS_PER_USER: 100,
  DEFAULT_COLOR: '#FFC107',
  
  QUICK_ACCESS_LIMIT: 10,
  RECENT_LIMIT: 20
} as const;

/**
 * UI constants
 */
export const FOLDER_UI = {
  DIALOG_MAX_WIDTH: 'sm' as const,
  DIALOG_MIN_HEIGHT: 400,
  
  TREE_INDENT_SIZE: 20,
  TREE_ITEM_HEIGHT: 32,
  TREE_VIRTUAL_THRESHOLD: 100,
  
  GRID_MIN_ITEM_WIDTH: 120,
  GRID_MAX_ITEM_WIDTH: 200,
  GRID_GAP: 16,
  
  LIST_ITEM_HEIGHT: 48,
  LIST_AVATAR_SIZE: 32,
  
  BREADCRUMB_MAX_ITEMS: 5,
  
  // Animation durations
  ANIMATION_DURATION: 200,
  HOVER_DELAY: 300,
  
  // Color coding
  COLOR_OPACITY_DEFAULT: 0.1,
  COLOR_OPACITY_HOVER: 0.2,
  COLOR_OPACITY_SELECTED: 0.3
} as const;

/**
 * Performance constants
 */
export const FOLDER_PERFORMANCE = {
  DEBOUNCE_DELAY: 300,
  THROTTLE_DELAY: 100,
  
  BATCH_SIZE: 50,
  MAX_CONCURRENT_OPERATIONS: 3,
  
  VIRTUAL_SCROLL_THRESHOLD: 100,
  VIRTUAL_ITEM_HEIGHT: 48,
  VIRTUAL_OVERSCAN: 5,
  
  CACHE_SIZE: 1000,
  CACHE_TTL: 15 * 60 * 1000, // 15 minutes
  
  // Statistics refresh intervals
  STATS_REFRESH_INTERVAL: 5 * 60 * 1000, // 5 minutes
  ANALYTICS_BATCH_INTERVAL: 60 * 1000 // 1 minute
} as const;

/**
 * Error messages
 */
export const FOLDER_ERRORS = {
  VALIDATION: {
    NAME_REQUIRED: 'Folder name is required',
    NAME_TOO_LONG: `Folder name must be less than ${FOLDER_VALIDATION.NAME_MAX_LENGTH} characters`,
    NAME_INVALID_CHARS: 'Folder name contains invalid characters',
    DESCRIPTION_TOO_LONG: `Description must be less than ${FOLDER_VALIDATION.DESCRIPTION_MAX_LENGTH} characters`,
    TOO_MANY_TAGS: `Maximum ${FOLDER_VALIDATION.MAX_TAGS} tags allowed`,
    TAG_TOO_LONG: `Tag must be less than ${FOLDER_VALIDATION.MAX_TAG_LENGTH} characters`,
    INVALID_ICON_COLOR: 'Invalid icon color',
    INVALID_SORT_ORDER: 'Invalid sort order',
    INVALID_VIEW_MODE: 'Invalid view mode',
    INVALID_MAX_CHILDREN: 'Invalid maximum children setting'
  },
  
  OPERATIONS: {
    NOT_FOUND: 'Folder not found',
    PERMISSION_DENIED: 'Permission denied',
    DUPLICATE_NAME: 'A folder with this name already exists',
    CIRCULAR_REFERENCE: 'Cannot move folder into itself or its descendants',
    EXCEEDS_MAX_DEPTH: `Maximum folder depth (${FOLDER_VALIDATION.MAX_DEPTH}) exceeded`,
    EXCEEDS_MAX_CHILDREN: 'Maximum number of children exceeded',
    PARENT_NOT_FOUND: 'Parent folder not found',
    CANNOT_DELETE_NON_EMPTY: 'Cannot delete non-empty folder',
    TEMPLATE_NOT_FOUND: 'Template not found',
    BOOKMARK_NOT_FOUND: 'Bookmark not found'
  },
  
  SYSTEM: {
    DATABASE_ERROR: 'Database operation failed',
    NETWORK_ERROR: 'Network error occurred',
    UNKNOWN_ERROR: 'An unknown error occurred'
  }
} as const;

/**
 * Success messages
 */
export const FOLDER_MESSAGES = {
  CREATED: 'Folder created successfully',
  UPDATED: 'Folder updated successfully',
  DELETED: 'Folder deleted successfully',
  MOVED: 'Folder moved successfully',
  COPIED: 'Folder copied successfully',
  DUPLICATED: 'Folder duplicated successfully',
  
  BOOKMARK_CREATED: 'Bookmark created successfully',
  BOOKMARK_UPDATED: 'Bookmark updated successfully',
  BOOKMARK_DELETED: 'Bookmark removed successfully',
  
  TEMPLATE_CREATED: 'Template created successfully',
  TEMPLATE_APPLIED: 'Template applied successfully',
  TEMPLATE_UPDATED: 'Template updated successfully',
  TEMPLATE_DELETED: 'Template deleted successfully',
  
  PERMISSIONS_UPDATED: 'Permissions updated successfully',
  SETTINGS_UPDATED: 'Settings updated successfully',
  STATISTICS_REFRESHED: 'Statistics refreshed successfully'
} as const;