import type { TreeNodeData, TreeNodeMetadata } from '@hierarchidb/common-types';
import { useEffect, useMemo, useRef } from 'react';
import type { TreeNodeUpdaterPayload } from './data-types.js';

type BasicInfo = {
  name: string;
  description?: string | null;
  tags: string[];
};

export function useDialogDirtyState<TPayload extends TreeNodeData>({
  open,
  draft,
  basicInfo,
  treeUpdater,
  localDraftData,
}: {
  open: boolean;
  draft: TreeNodeUpdaterPayload<TPayload> | null;
  basicInfo: BasicInfo;
  treeUpdater: TreeNodeUpdaterPayload<TPayload> | null;
  localDraftData: Partial<TPayload>;
}) {
  const initialBasicInfoRef = useRef<TreeNodeMetadata | null>(null);

  useEffect(() => {
    if (!open) {
      initialBasicInfoRef.current = null;
      return;
    }
    if (!initialBasicInfoRef.current && draft?.draftMetadata) {
      initialBasicInfoRef.current = {
        name: draft.draftMetadata.name ?? '',
        description: draft.draftMetadata.description ?? '',
        tags: Array.isArray(draft.draftMetadata.tags) ? [...draft.draftMetadata.tags] : [],
      };
    }
  }, [draft?.draftMetadata, open]);

  const basicInfoDirty = useMemo(() => {
    const meta = treeUpdater?.draftMetadata ?? { name: '', description: '', tags: [] };
    const initialMeta = initialBasicInfoRef.current ?? { name: '', description: '', tags: [] };
    if (meta.name !== basicInfo.name) return true;
    if ((meta.description ?? '') !== (basicInfo.description ?? '')) return true;
    const prevTags = Array.isArray(meta.tags) ? meta.tags : [];
    const nextTags = Array.isArray(basicInfo.tags) ? basicInfo.tags : [];
    if (prevTags.length !== nextTags.length) return true;
    for (let i = 0; i < prevTags.length; i += 1) {
      if (prevTags[i] !== nextTags[i]) return true;
    }
    const initTags = Array.isArray(initialMeta.tags) ? initialMeta.tags : [];
    if (initialMeta.name !== basicInfo.name) return true;
    if ((initialMeta.description ?? '') !== (basicInfo.description ?? '')) return true;
    if (initTags.length !== nextTags.length) return true;
    for (let i = 0; i < initTags.length; i += 1) {
      if (initTags[i] !== nextTags[i]) return true;
    }
    return false;
  }, [basicInfo.description, basicInfo.name, basicInfo.tags, treeUpdater?.draftMetadata]);

  const stepDataDirty = useMemo(() => {
    const current = localDraftData ?? {};
    const persisted = (treeUpdater?.draftData ?? {}) as Partial<TPayload>;
    return JSON.stringify(current) !== JSON.stringify(persisted);
  }, [localDraftData, treeUpdater?.draftData]);

  const dialogDirty = basicInfoDirty || stepDataDirty;

  return {
    basicInfoDirty,
    stepDataDirty,
    dialogDirty,
  };
}
