/**
 * Utility functions for Project plugin
 */

import type { ProjectEntity, ProjectWorkingCopy } from '../types/project-types';
import type { NodeId, NodeType } from '@hierarchidb/common-type';

/**
 * Create a working copy from an entity
 */
export function createWorkingCopyFromEntity(entity: ProjectEntity): ProjectWorkingCopy {
  return {
    ...entity,
    id: entity.nodeId as NodeId,  // Convert to NodeId for TreeNode compatibility
    parentId: 'root' as NodeId,  // Default parent, should be set by caller
    nodeType: 'project' as NodeType,
    depth: 0,  // Default depth, should be set by caller
    isWorkingCopy: true,
    originalId: entity.id,
    isDirty: false,
    copiedAt: Date.now(),
  };
}

/**
 * Map working copy changes to entity updates
 */
export function mapWorkingCopyToUpdates(workingCopy: ProjectWorkingCopy): Partial<ProjectEntity> {
  // Remove working copy specific fields and TreeNode fields
  const { 
    isWorkingCopy, 
    originalId, 
    isDirty, 
    copiedAt,
    id,  // TreeNode id (NodeId)
    parentId,  // TreeNode field
    nodeType,  // TreeNode field  
    depth,  // TreeNode field
    originalNodeId,  // WorkingCopyProperties
    ...updates 
  } = workingCopy;

  // Convert id back to EntityId if needed
  const entityUpdates: Partial<ProjectEntity> = {
    ...updates,
    updatedAt: Date.now(),
    updatedBy: 'system',
  };

  return entityUpdates;
}

/**
 * Format date for display
 */
export function formatDate(date: Date | number): string {
  const d = date instanceof Date ? date : new Date(date);
  return d.toISOString().split('T')[0] || '';
}

/**
 * Format timestamp for display
 */
export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Check if two arrays have the same elements
 */
export function arraysEqual<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((val, index) => val === b[index]);
}

/**
 * Merge arrays without duplicates
 */
export function mergeArrays<T>(...arrays: T[][]): T[] {
  return [...new Set(arrays.flat())];
}

/**
 * Truncate string to specified length
 */
export function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}

/**
 * Calculate bounding box area
 */
export function calculateBoundingBoxArea(bbox: {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
}): number {
  const width = bbox.maxLon - bbox.minLon;
  const height = bbox.maxLat - bbox.minLat;
  return width * height;
}

/**
 * Check if a point is within a bounding box
 */
export function isPointInBoundingBox(
  point: [number, number],
  bbox: {
    minLon: number;
    minLat: number;
    maxLon: number;
    maxLat: number;
  }
): boolean {
  const [lon, lat] = point;
  return lon >= bbox.minLon && lon <= bbox.maxLon && lat >= bbox.minLat && lat <= bbox.maxLat;
}

/**
 * Convert bytes to human-readable size
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Calculate execution time from start timestamp
 */
export function calculateExecutionTime(startTime: number): number {
  return Date.now() - startTime;
}

/**
 * Format execution time for display
 */
export function formatExecutionTime(milliseconds: number): string {
  if (milliseconds < 1000) {
    return `${milliseconds}ms`;
  } else if (milliseconds < 60000) {
    return `${(milliseconds / 1000).toFixed(1)}s`;
  } else {
    return `${(milliseconds / 60000).toFixed(1)}m`;
  }
}
