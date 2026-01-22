import { useEffect, useRef, useState } from 'react';
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
  const loadRowsRef = useRef(loadRows);
  const metadataKeyRef = useRef<string | null>(null);

  useEffect(() => {
    loadRowsRef.current = loadRows;
  }, [loadRows]);

  useEffect(() => {
    const nextKey = metadataEnabled && nodeId ? `${nodeId}:${pollIntervalMs ?? 'off'}` : 'disabled';
    if (metadataKeyRef.current === nextKey) return;
    metadataKeyRef.current = nextKey;
    if (!metadataEnabled || !nodeId) {
      setMetadataRows((prev) => (prev.length ? [] : prev));
      setMetadataLoading((prev) => (prev ? false : prev));
      setMetadataError((prev) => (prev ? null : prev));
      setMetadataLoaded((prev) => (prev ? false : prev));
      return;
    }
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    setMetadataLoaded((prev) => (prev ? false : prev));
    const runLoad = () => {
      setMetadataLoading((prev) => (prev ? prev : true));
      setMetadataError((prev) => (prev ? null : prev));
      void loadRowsRef.current(nodeId)
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
            setMetadataLoading((prev) => (prev ? false : prev));
            setMetadataLoaded((prev) => (prev ? prev : true));
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
      if (metadataKeyRef.current === nextKey) {
        metadataKeyRef.current = null;
      }
    };
  }, [metadataEnabled, nodeId, pollIntervalMs]);

  return {
    metadataRows,
    metadataLoading,
    metadataError,
    metadataLoaded,
  };
};
