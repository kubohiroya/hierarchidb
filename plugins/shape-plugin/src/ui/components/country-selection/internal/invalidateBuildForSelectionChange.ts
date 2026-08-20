import type { NodeId } from '@hierarchidb/core-types';
import type { BuildWorkerBridge } from '@hierarchidb/ui-worker-client';
import { shapeMutationAPIImpl } from '~/services/build/ShapeBuildAPIClient';
import { runShapeArtifactCascadeCleanup } from '~/services/vt/runShapeArtifactCascadeCleanup';
import { sanitizeShapeDraftData } from '~/ui/utils/sanitizeShapeDraftData';
import { buildSelectionSet } from './selectionUtils.js';

type BuildSessionUpdater = {
  initialize: () => Promise<void>;
  getTreeNodeUpdaterAPI: () => ReturnType<BuildWorkerBridge['getTreeNodeUpdaterAPI']>;
};

type InvalidateParams = {
  bridgeRef: BuildSessionUpdater;
  nodeId: NodeId;
  prev: Record<string, boolean[]>;
  nextSelection: Record<string, boolean[]>;
};

export const invalidateBuildForSelectionChange = async (
  params: InvalidateParams
): Promise<void> => {
  const { bridgeRef, nodeId, prev, nextSelection } = params;
  const prevSet = buildSelectionSet(prev);
  const nextSet = buildSelectionSet(nextSelection);
  const removed = Array.from(prevSet).filter((entry) => !nextSet.has(entry));
  if (removed.length === 0) return;

  const removedPairs = removed.map((entry) => {
    const [countryCode, adminLevelText] = entry.split(':');
    return {
      countryCode: countryCode ?? '',
      adminLevel: Number.parseInt(adminLevelText ?? '', 10),
    };
  });

  await runShapeArtifactCascadeCleanup({
    nodeId,
    target: {
      kind: 'selection',
      removedSelections: removedPairs,
    },
  });

  await bridgeRef.initialize();
  const updater = await bridgeRef.getTreeNodeUpdaterAPI();
  const node = await updater.getTreeNode(nodeId);
  const currentDraftData =
    node?.draftData && typeof node.draftData === 'object'
      ? (node.draftData as Record<string, unknown>)
      : {};
  await updater.updateTreeNode(nodeId, {
    mode: 'save-draft',
    draftData: {
      ...sanitizeShapeDraftData(currentDraftData),
      selectedArrayByCountries: nextSelection,
    } as Record<string, unknown>,
  });
  await shapeMutationAPIImpl.deleteBuildSession(nodeId);
};
