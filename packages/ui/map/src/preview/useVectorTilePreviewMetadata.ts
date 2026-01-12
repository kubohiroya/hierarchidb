import { useEffect, useState } from 'react';
import type { NodeId } from '@hierarchidb/common-types';

export type VectorTileMetadataLoader<Row> = (nodeId: NodeId) => Promise<Row[]>;

export const useVectorTilePreviewMetadata = <Row,>(
  metadataEnabled: boolean,
  nodeId: NodeId | null,
  loadRows: VectorTileMetadataLoader<Row>,
  pollIntervalMs?: number,
) => {
  const [metadataRows, setMetadataRows] = useState<Row[]>([]);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [metadataLoaded, setMetadataLoaded] = useState(false);

  useEffect(() => {
    if (!metadataEnabled || !nodeId) {
      setMetadataRows([]);
      setMetadataLoading(false);
      setMetadataError(null);
      setMetadataLoaded(false);
      return;
    }
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    setMetadataLoaded(false);
    const runLoad = () => {
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
            setMetadataLoaded(true);
          }
        });
    };
    runLoad();
    if (pollIntervalMs && pollIntervalMs > 0) {
      intervalId = setInterval(runLoad, pollIntervalMs);
    }
    return () => {
      cancelled = true;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [loadRows, metadataEnabled, nodeId, pollIntervalMs]);

  return {
    metadataRows,
    metadataLoading,
    metadataError,
    metadataLoaded,
  };
};
