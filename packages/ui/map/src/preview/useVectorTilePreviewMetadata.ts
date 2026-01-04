import { useEffect, useState } from 'react';
import type { NodeId } from '@hierarchidb/common-types';

export type VectorTileMetadataLoader<Row> = (nodeId: NodeId) => Promise<Row[]>;

export const useVectorTilePreviewMetadata = <Row,>(
  metadataEnabled: boolean,
  nodeId: NodeId | null,
  loadRows: VectorTileMetadataLoader<Row>,
) => {
  const [metadataRows, setMetadataRows] = useState<Row[]>([]);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [metadataError, setMetadataError] = useState<string | null>(null);

  useEffect(() => {
    if (!metadataEnabled || !nodeId) {
      setMetadataRows([]);
      setMetadataLoading(false);
      setMetadataError(null);
      return;
    }
    let cancelled = false;
    setMetadataLoading(true);
    setMetadataError(null);
    void loadRows(nodeId)
      .then((rows) => {
        if (!cancelled) {
          setMetadataRows(rows);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setMetadataError(error instanceof Error ? error.message : 'Failed to load metadata.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setMetadataLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [loadRows, metadataEnabled, nodeId]);

  return {
    metadataRows,
    metadataLoading,
    metadataError,
  };
};
