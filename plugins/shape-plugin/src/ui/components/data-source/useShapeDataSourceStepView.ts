import { useCallback, useState } from 'react';
import { notify } from '@hierarchidb/components';
import { toNodeId } from '@hierarchidb/core-types';
import { clearShapeDataSourceCache } from '~/ui/utils/clearShapeDataSourceCache';
import type { DataSourceName } from '~/common/types/index';

type Args = {
  dataSourceId: DataSourceName | undefined;
  nodeId: string | undefined;
  t: (key: string, fallback: string) => string;
};

export const useShapeDataSourceStepView = ({ dataSourceId, nodeId, t }: Args) => {
  const [isClearing, setIsClearing] = useState(false);
  const resolvedNodeId = nodeId ? toNodeId(String(nodeId)) : undefined;

  const handleClearCache = useCallback(async () => {
    if (!resolvedNodeId) {
      notify.warning(t('dataSource.cacheMissingNode', 'NodeId is missing.'));
      return;
    }
    if (!dataSourceId) {
      notify.warning(t('dataSource.cacheMissing', 'Select a data source first.'));
      return;
    }
    try {
      setIsClearing(true);
      await clearShapeDataSourceCache(resolvedNodeId, dataSourceId);
      notify.success(t('dataSource.cacheCleared', 'Cleared cache for selected data source.'));
    } catch (error) {
      console.error('[shape] failed to clear data source cache', error);
      notify.error(t('dataSource.cacheClearFailed', 'Failed to clear data source cache.'));
    } finally {
      setIsClearing(false);
    }
  }, [dataSourceId, resolvedNodeId, t]);

  return {
    isClearing,
    handleClearCache,
  };
};
