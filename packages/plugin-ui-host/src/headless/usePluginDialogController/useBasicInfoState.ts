import type { NodeId } from '@hierarchidb/core-types';
import { resolveDefaultNodeName } from '@hierarchidb/runtime-worker';
import type { TagEntity } from '@hierarchidb/tag-api';
import type { TreeNode, TreeNodeData, TreeNodeMetadata } from '@hierarchidb/tree-api';
import type { WorkerAPI } from '@hierarchidb/worker-api';
import type { Remote } from 'comlink';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { BasicInfoMeta, TreeNodeUpdaterPayload } from './data-types.js';

interface Params {
  mode: 'create' | 'edit';
  nodeType: string;
  nodeId: NodeId;
  pageNodeId: NodeId;
  client: Remote<WorkerAPI<TreeNodeData>> | null;
  draft: TreeNodeUpdaterPayload | null;
  updateDraft: (patch: import('./data-types.js').TreeNodeUpdaterPatch) => void;
}

export function useBasicInfoState({
  mode,
  nodeType,
  nodeId,
  pageNodeId,
  client,
  draft,
  updateDraft,
}: Params): {
  basicInfo: TreeNodeMetadata;
  setBasicInfo: React.Dispatch<React.SetStateAction<TreeNodeMetadata>>;
  basicInfoValidationError: string | null;
  isBasicInfoValid: boolean;
  basicInfoMeta: BasicInfoMeta;
  tagSuggestions: string[];
  siblingNames: Set<string>;
  handleBasicInfoBridge: (data: unknown) => void;
} {
  const [basicInfo, setBasicInfo] = useState<TreeNodeMetadata>({
    name: mode === 'create' ? resolveDefaultNodeName(nodeType) : '',
    description: '',
    tags: [],
  });

  useEffect(() => {
    if (!draft) return;
    const tags = Array.isArray(draft.draftMetadata?.tags) ? draft.draftMetadata.tags : [];
    const nameFromDraft =
      typeof draft.draftMetadata?.name === 'string' && draft.draftMetadata.name.trim().length
        ? draft.draftMetadata.name
        : undefined;
    const descFromDraft =
      typeof draft.draftMetadata?.description === 'string' && draft.draftMetadata.description.length
        ? draft.draftMetadata.description
        : undefined;
    setBasicInfo((prev: TreeNodeMetadata) => ({
      name: nameFromDraft ?? prev.name ?? '',
      description: descFromDraft ?? prev.description ?? '',
      tags: tags.length ? tags : Array.isArray(prev.tags) ? prev.tags : [],
    }));
  }, [draft]);

  const [tagSuggestions, setTagSuggestions] = useState<string[]>(() => []);

  useEffect(() => {
    let disposed = false;
    (async () => {
      try {
        if (!client) return;
        const tagAPI = await client.getTagAPI();
        const all = await tagAPI.getAllTags();
        if (!disposed)
          setTagSuggestions(
            all
              .map((t: TagEntity) => t.name)
              .filter((name: string): name is string => typeof name === 'string')
          );
        if (mode === 'edit' && nodeId) {
          const nodeTags = await tagAPI.getTagsForNode(nodeId);
          const names = (nodeTags || [])
            .map((t: TagEntity) => t.name)
            .filter((name: string): name is string => typeof name === 'string');
          if (!disposed && names.length)
            setBasicInfo((prev: TreeNodeMetadata) => ({
              ...prev,
              tags: Array.isArray(prev.tags) && prev.tags.length ? prev.tags : names,
            }));
        }
      } catch (err) {
        console.warn('[PluginDialogShell] load tag suggestions failed', err);
      }
    })();
    return () => {
      disposed = true;
    };
  }, [client, nodeId, mode]);

  const [siblingNames, setSiblingNames] = useState<Set<string>>(() => new Set());

  const toMetadataRecord = (value: unknown): Record<string, unknown> =>
    typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};

  useEffect(() => {
    if (mode !== 'create') {
      setSiblingNames(new Set());
      return;
    }
    if (!client || !pageNodeId) {
      setSiblingNames(new Set());
      return;
    }
    let disposed = false;
    (async () => {
      try {
        const query = await client.getQueryAPI();
        const siblings = await query.listChildren(pageNodeId);
        if (disposed) return;
        const values = new Set<string>(
          (siblings as TreeNode[])
            .filter((node) => String(node?.id ?? '') !== String(nodeId))
            .map((node) =>
              typeof node?.metadata?.name === 'string'
                ? node.metadata.name.trim().toLowerCase()
                : ''
            )
            .filter((name): name is string => Boolean(name))
        );
        setSiblingNames(values);
      } catch {
        if (!disposed) {
          setSiblingNames(new Set());
        }
      }
    })();
    return () => {
      disposed = true;
    };
  }, [client, mode, pageNodeId, nodeId]);

  const normalizedBasicName = basicInfo.name.trim();
  const normalizedBasicKey = normalizedBasicName.toLowerCase();
  const hasBasicInfoNameConflict =
    mode === 'create' && Boolean(normalizedBasicKey) && siblingNames.has(normalizedBasicKey);
  const basicInfoValidationError = !normalizedBasicName
    ? 'Name is required'
    : hasBasicInfoNameConflict
      ? 'A node with this name already exists in this folder'
      : null;
  const isBasicInfoValid = !basicInfoValidationError;
  const basicInfoMeta = useMemo(
    () => ({ error: basicInfoValidationError, hasConflict: hasBasicInfoNameConflict }),
    [basicInfoValidationError, hasBasicInfoNameConflict]
  );

  const handleBasicInfoBridge = useCallback(
    (data: unknown) => {
      const info = toMetadataRecord(data);
      const name = typeof info.name === 'string' ? info.name : '';
      const description = typeof info.description === 'string' ? info.description : '';
      const tags = Array.isArray(info.tags)
        ? info.tags.filter((v: unknown): v is string => typeof v === 'string')
        : [];
      const next: TreeNodeMetadata = { name, description, tags };
      setBasicInfo(next);
      updateDraft({
        draftMetadata: next,
      });
    },
    [setBasicInfo, updateDraft]
  );

  useEffect(() => {
    if (!draft?.draftMetadata) return;
    setBasicInfo((prev: TreeNodeMetadata) => {
      const nextName =
        typeof draft.draftMetadata?.name === 'string' && draft.draftMetadata.name.length
          ? draft.draftMetadata.name
          : prev.name;
      const nextDescription =
        typeof draft.draftMetadata?.description === 'string' &&
        draft.draftMetadata.description.length
          ? draft.draftMetadata.description
          : prev.description;
      const nextTags = Array.isArray(draft.draftMetadata?.tags)
        ? draft.draftMetadata.tags.filter((v): v is string => typeof v === 'string')
        : Array.isArray(prev.tags)
          ? prev.tags
          : [];
      const tagsEqual =
        (Array.isArray(prev.tags) ? prev.tags : []).length === nextTags.length &&
        (Array.isArray(prev.tags) ? prev.tags : []).every(
          (tag: string, idx: number) => tag === nextTags[idx]
        );
      if (prev.name === nextName && prev.description === nextDescription && tagsEqual) {
        return prev;
      }
      return {
        name: nextName,
        description: nextDescription,
        tags: nextTags,
      };
    });
  }, [draft?.draftMetadata]);

  return {
    basicInfo,
    setBasicInfo,
    basicInfoValidationError,
    isBasicInfoValid,
    basicInfoMeta,
    tagSuggestions,
    siblingNames,
    handleBasicInfoBridge,
  };
}
