/**
 * Shared types for Folder plugin - UI-Worker共通型定義
 */

import type { NodeId, Timestamp } from '@hierarchidb/common-core';
import type { FolderEntity } from '../entities/FolderEntity';

// Re-export existing types from the entities directory
export type {
  FolderEntity,
  FolderBookmark,
  FolderTemplate,
  FolderStructureNode,
  FolderWorkingCopy,
  FolderOperationResult,
  FolderSearchQuery,
  FolderStatsSummary
} from '../entities/FolderEntity';

/**
 * Create/Update data types for API operations
 */
export interface CreateFolderData {
  name: string;
  description?: string;
  settings?: FolderSettings;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface UpdateFolderData {
  name?: string;
  description?: string;
  settings?: Partial<FolderSettings>;
  tags?: string[];
  metadata?: Record<string, any>;
}

/**
 * Folder settings interface
 */
export interface FolderSettings {
  // Display settings
  displayOptions?: {
    iconColor?: string;
    iconType?: 'default' | 'custom';
    customIcon?: string;
    sortOrder?: 'name' | 'date' | 'type' | 'custom';
    sortDirection?: 'asc' | 'desc';
    viewMode?: 'list' | 'grid' | 'tree';
  };
  
  // Access control
  permissions?: {
    isPublic?: boolean;
    isReadOnly?: boolean;
    allowedUsers?: string[];
    deniedUsers?: string[];
  };
  
  // Folder rules
  rules?: {
    maxChildren?: number;
    allowedChildTypes?: string[];
    autoArchiveAfterDays?: number;
    requireApprovalForChanges?: boolean;
  };
}

/**
 * Folder statistics interface
 */
export interface FolderStatistics {
  childCount: number;
  descendantCount: number;
  totalSize?: number;
  lastAccessedAt?: Timestamp;
  accessCount?: number;
}

/**
 * Form data types for UI components
 */
export interface FolderFormData {
  name: string;
  description?: string;
  iconColor?: string;
  isPublic?: boolean;
  isReadOnly?: boolean;
  maxChildren?: number;
  allowedChildTypes?: string[];
  tags?: string[];
}

/**
 * Display data for UI components
 */
export interface FolderDisplayData {
  id: NodeId;
  name: string;
  description?: string;
  iconColor?: string;
  hasChildren: boolean;
  childCount: number;
  isReadOnly: boolean;
  isPublic: boolean;
  tags: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastAccessedAt?: Timestamp;
  accessCount?: number;
}

/**
 * Navigation breadcrumb data
 */
export interface FolderBreadcrumb {
  nodeId: NodeId;
  name: string;
  isRoot: boolean;
  isClickable: boolean;
}

/**
 * Folder tree node for hierarchical display
 */
export interface FolderTreeNode {
  nodeId: NodeId;
  name: string;
  parentNodeId?: NodeId;
  children: FolderTreeNode[];
  hasChildren: boolean;
  isExpanded: boolean;
  isSelected: boolean;
  level: number;
  iconColor?: string;
  isReadOnly: boolean;
}

/**
 * Error types
 */
export enum FolderErrorType {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  NOT_FOUND = 'NOT_FOUND',
  DUPLICATE_NAME = 'DUPLICATE_NAME',
  CIRCULAR_REFERENCE = 'CIRCULAR_REFERENCE',
  EXCEEDS_MAX_DEPTH = 'EXCEEDS_MAX_DEPTH',
  EXCEEDS_MAX_CHILDREN = 'EXCEEDS_MAX_CHILDREN',
  DATABASE_ERROR = 'DATABASE_ERROR'
}

export class FolderError extends Error {
  constructor(
    public type: FolderErrorType,
    message: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'FolderError';
  }
}

/**
 * Constants
 */
export const FOLDER_CONSTANTS = {
  MAX_NAME_LENGTH: 255,
  MAX_DESCRIPTION_LENGTH: 1000,
  MAX_DEPTH: 20,
  MAX_CHILDREN_DEFAULT: 1000,
  MAX_TAGS: 10,
  MAX_TAG_LENGTH: 50,
  ICON_COLORS: [
    '#1976d2', '#388e3c', '#f57c00', '#d32f2f', '#7b1fa2',
    '#455a64', '#e64a19', '#00796b', '#303f9f', '#c2185b'
  ] as const,
  SORT_ORDERS: ['name', 'date', 'type', 'custom'] as const,
  VIEW_MODES: ['list', 'grid', 'tree'] as const,
} as const;

/**
 * Type guards
 */
export function isFolderEntity(obj: any): obj is FolderEntity {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.nodeId === 'string' &&
    typeof obj.name === 'string' &&
    typeof obj.createdAt === 'number' &&
    typeof obj.updatedAt === 'number' &&
    typeof obj.version === 'number'
  );
}

export function isValidFolderName(name: string): boolean {
  return (
    typeof name === 'string' &&
    name.trim().length > 0 &&
    name.length <= FOLDER_CONSTANTS.MAX_NAME_LENGTH &&
    !/[<>:"/\\|?*]/.test(name) // Exclude filesystem-unsafe characters
  );
}



