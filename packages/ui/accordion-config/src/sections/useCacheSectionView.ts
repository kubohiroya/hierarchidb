import { useCallback, useState } from 'react';
import type { CacheConfig } from './CacheSection.js';

export interface UseCacheSectionViewParams {
  nodeId: string;
  config: CacheConfig;
  onDeleteOnCompleteChange: (checked: boolean) => void;
}

export interface UseCacheSectionViewResult {
  isDeleting: boolean;
  deleteResult: { success: boolean; message: string } | null;
  handleDeleteCache: () => Promise<void>;
  handleDeleteOnCompleteChange: (checked: boolean) => void;
}

export function useCacheSectionView({
  nodeId,
  config,
  onDeleteOnCompleteChange,
}: UseCacheSectionViewParams): UseCacheSectionViewResult {
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteResult, setDeleteResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const handleDeleteCache = useCallback(async () => {
    setIsDeleting(true);
    setDeleteResult(null);
    try {
      const stats = await config.getStats(nodeId);
      await config.deleteCache(nodeId);
      const sizeInMB = (stats.totalSize / 1024 / 1024).toFixed(2);
      const message = stats.details
        ? `Successfully deleted ${stats.details} (${sizeInMB} MB)`
        : `Successfully deleted ${stats.itemCount} items (${sizeInMB} MB)`;
      setDeleteResult({
        success: true,
        message,
      });
    } catch (error) {
      console.error('Failed to delete cache:', error);
      setDeleteResult({
        success: false,
        message: 'Failed to delete cache',
      });
    } finally {
      setIsDeleting(false);
    }
  }, [config, nodeId]);

  const handleDeleteOnCompleteChange = useCallback(
    (checked: boolean) => {
      onDeleteOnCompleteChange(checked);
    },
    [onDeleteOnCompleteChange],
  );

  return {
    isDeleting,
    deleteResult,
    handleDeleteCache,
    handleDeleteOnCompleteChange,
  };
}
