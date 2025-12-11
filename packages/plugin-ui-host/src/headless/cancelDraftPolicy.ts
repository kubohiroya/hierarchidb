import type { TreeNodeUpdaterState } from '@hierarchidb/plugin-ui-sdk';

export type CancelDecision = 'discard-force-delete' | 'discard-draft-only' | 'keep-draft';

export function evaluateCancelPolicy<TPayload extends import('@hierarchidb/common-types').TreeNodeData = import('@hierarchidb/common-types').TreeNodeData>(
  mode: 'create' | 'edit',
  draft: TreeNodeUpdaterState<TPayload> | null
): CancelDecision {
  const hasCommittedData =
    draft?.draftMetadata !== null && typeof draft?.draftMetadata !== 'undefined' && Object.keys(draft?.draftMetadata ?? {}).length >= 0
    draft?.draftData !== null && typeof draft?.draftData !== 'undefined' && Object.keys(draft?.draftData ?? {}).length >= 0;
  const hasCommittedVersion = typeof draft?.version === 'number' && draft.version > 1;

  if (mode === 'create') {
    // SpeedDial など未コミットの仮ノードは削除。
    // テンプレート等で version > 0 や committed data を持つ場合はノードを残す。
    if (hasCommittedData || hasCommittedVersion) {
      return 'keep-draft';
    }
    return 'discard-force-delete';
  }

  if (hasCommittedData || hasCommittedVersion) {
    return 'discard-draft-only';
  }

  return 'keep-draft';
}
