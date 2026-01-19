import type { NodeId } from '@hierarchidb/common-types';
import type { DataSourceName } from '../../common/types/index.js';
import { metadataLoader } from '../../services/metadata/MetadataLoader.js';
import { deleteRawDataDataSourceBuffersForDataSource } from '../../services/utils/chunkStore.js';
import { invalidateCountrySelectionCaches } from '../hooks/countrySelectionReload.js';

export const clearShapeDataSourceCache = async (
  nodeId: NodeId,
  dataSource: DataSourceName,
): Promise<{ downloadCleared: number }> => {
  metadataLoader.clearCache(dataSource);
  await invalidateCountrySelectionCaches(dataSource, nodeId);
  const downloadCleared = await deleteRawDataDataSourceBuffersForDataSource(nodeId, dataSource);
  return { downloadCleared };
};
