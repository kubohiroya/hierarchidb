/**
 * Folder API hook - Folder doesn't use Worker services
 * This is a placeholder that returns null since folders are handled as TreeNodes
 */

import { useMemo } from 'react';
import type { FolderAPI } from '../../shared';

/**
 * Folder APIにアクセスするためのhook
 * Note: Folder plugin doesn't have Worker-side services
 * Folders are managed directly as TreeNodes
 */
export function useFolderAPI(): Promise<FolderAPI | null> {
  return useMemo(async () => {
    // Folder plugin doesn't have Worker services
    // Return null to indicate no API available
    console.warn('Folder plugin does not have Worker-side services. Folders are managed as TreeNodes.');
    return null;
  }, []);
}

/**
 * Synchronous version that returns a function to get the API
 * Note: Returns null since folder doesn't have Worker services
 */
export function useFolderAPIGetter(): () => Promise<FolderAPI | null> {
  return useMemo(() => {
    return async (): Promise<FolderAPI | null> => {
      console.warn('Folder plugin does not have Worker-side services. Folders are managed as TreeNodes.');
      return null;
    };
  }, []);
}