import type { NodeId } from '@hierarchidb/core-types';
import type { TreeNodeMetadata } from '@hierarchidb/tree-api';
import type { ResourceSummary } from '~/ui/steps/ResourcePicker';
import type { LinkerDraft } from '~/common/types/index';
import type { StepData } from '@hierarchidb/plugin-base';

type LinkerStepData = StepData & LinkerDraft;

export const useLinkerSteps = () => {
  const ensureDraft = (data?: LinkerStepData): LinkerStepData => ({
    treeNodeId: (data?.treeNodeId ?? '') as NodeId,
    draftMetadata: (data?.draftMetadata ?? { name: '', description: '', tags: [] }) as TreeNodeMetadata,
    draftData: data?.draftData ?? {},
  });

  const toSelectionSet = (
    value?: LinkerStepData['draftData'] extends { linkedNodeIds?: NodeId[] }
      ? LinkerStepData['draftData']['linkedNodeIds']
      : string[]
  ): Set<string> => {
    if (!value) return new Set<string>();
    return new Set<string>(value);
  };

  const toResourceSummaries = (value: Set<string>): ResourceSummary[] =>
    Array.from(value).map((id) => ({ nodeId: String(id) }));

  return {
    ensureDraft,
    toSelectionSet,
    toResourceSummaries,
  };
};
