import { useEffect } from 'react';
import type { NodeId } from '@hierarchidb/core-types';
import type { BuildStatus } from '@hierarchidb/components';
import type { ShapeEntity } from '../../../common/types/index.js';
import { shapeQueryAPIImpl } from '../../../services/batch/ShapeBuildAPIClient.ts';

type Args = {
  activeNodeId: NodeId | null;
  buildStatus: BuildStatus;
  data?: Partial<ShapeEntity>;
  onChange: (patch: Partial<ShapeEntity>) => void;
};

const fetchTileSummary = async (nodeId: NodeId) => {
  const summary = await shapeQueryAPIImpl.getVectorTileSummary(nodeId);
  return { tiles: summary.tiles, totalBytes: summary.totalBytes };
};

export const useShapeBuildTileSummary = ({
  activeNodeId,
  buildStatus,
  data,
  onChange,
}: Args) => {
  useEffect(() => {
    if (!activeNodeId) return;
    if (!['running', 'completed'].includes(buildStatus)) return;
    if ((data?.tileSummary?.tiles ?? 0) > 0) return;
    let cancelled = false;
    const loadSummary = async () => {
      try {
        const summary = await fetchTileSummary(activeNodeId);
        if (cancelled) return;
        if (summary.tiles > 0) {
          onChange({ tileSummary: summary });
        }
      } catch (error) {
        console.debug('[ShapeBuildStep] tile summary load failed', error);
      }
    };
    void loadSummary();
    return () => {
      cancelled = true;
    };
  }, [activeNodeId, buildStatus, data?.tileSummary?.tiles, onChange]);
};
