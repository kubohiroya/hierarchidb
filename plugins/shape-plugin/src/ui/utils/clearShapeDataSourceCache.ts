import type { NodeId } from '@hierarchidb/core-types';
import type { DataSourceName } from '~/common/types/index';
import { metadataLoader } from '~/services/metadata/MetadataLoader';
import { deleteRawDataDataSourceBuffersForDataSource } from '~/services/utils/chunkStore';
import { invalidateCountrySelectionCaches } from '~/ui/hooks/invalidateCountrySelectionCaches';

export const clearShapeDataSourceCache = async (
  nodeId: NodeId,
  dataSource: DataSourceName
): Promise<{ downloadCleared: number }> => {
  metadataLoader.clearCache(dataSource);
  await invalidateCountrySelectionCaches(dataSource, nodeId);
  const downloadCleared = await deleteRawDataDataSourceBuffersForDataSource(nodeId, dataSource);
  return { downloadCleared };
};
