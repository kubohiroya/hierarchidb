import type { NodeId } from '@hierarchidb/common-types';
import { metadataLoader } from '../../services/metadata/MetadataLoader.js';
import { deleteDownloadBuffersForDataSource } from '../../services/utils/chunkStore.js';
import { invalidateCountrySelectionCaches } from '../hooks/countrySelectionReload.js';

export const clearShapeDataSourceCache = async (
  nodeId: NodeId,
  dataSource: string,
): Promise<{ downloadCleared: number }> => {
  metadataLoader.clearCache(dataSource);
  await invalidateCountrySelectionCaches(dataSource, nodeId);
  const downloadCleared = await deleteDownloadBuffersForDataSource(nodeId, dataSource);
  return { downloadCleared };
};
