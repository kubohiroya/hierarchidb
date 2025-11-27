import { useCallback, useEffect, useMemo, useState } from 'react';
import type { NodeId } from '@hierarchidb/common-types';
import type { Remote } from 'comlink';
import type { WorkerAPI } from '@hierarchidb/common-api';
import { resolveDefaultNodeName } from '@hierarchidb/runtime-worker';
import { toRecord } from '../controller/step-guards.js';
import type { BasicInfoMeta, BasicInfoState } from './types.js';
import type { DialogStepData, TreeNodeUpdater } from './data-types.js';
import type { TagEntity } from '@hierarchidb/common-types';
import type React from 'react';

interface Params {
  mode: 'create' | 'edit';
  nodeType: string;
  nodeId: NodeId;
  pageNodeId: NodeId;
  client: Remote<WorkerAPI> | null;
  draft: TreeNodeUpdater<DialogStepData> | null;
  updateDraft: (patch: import('./data-types.js').TreeNodeUpdatePayload<DialogStepData>) => void;
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
  basicInfo: BasicInfoState;
  setBasicInfo: React.Dispatch<React.SetStateAction<BasicInfoState>>;
  basicInfoValidationError: string | null;
  isBasicInfoValid: boolean;
  basicInfoMeta: BasicInfoMeta;
  tagSuggestions: string[];
  siblingNames: Set<string>;
  handleBasicInfoBridge: (data: DialogStepData) => void;
} {
  const [basicInfo, setBasicInfo] = useState<BasicInfoState>({
    name: '',
    description: '',
    tags: [],
  });

  useEffect(() => {
    if (mode === 'create') {
      const fallbackName = resolveDefaultNodeName(nodeType);
      setBasicInfo((prev) => ({
        name: prev.name || fallbackName,
        description: prev.description,
        tags: prev.tags,
      }));
    }
  }, [mode, nodeType]);

  useEffect(() => {
    if (!draft) return;
    const tags = Array.isArray(draft.draftMetadata?.tags) ? draft.draftMetadata.tags : [];
    const resolvedName =
      typeof draft.draftMetadata?.name === 'string' && draft.draftMetadata.name.length
        ? draft.draftMetadata.name
        : '';
    const resolvedDescription =
      typeof draft.draftMetadata?.description === 'string' && draft.draftMetadata.description.length
        ? draft.draftMetadata.description
        : '';
    setBasicInfo({
      name: resolvedName,
      description: resolvedDescription,
      tags,
    });
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
            setBasicInfo((prev) => ({ ...prev, tags: prev.tags.length ? prev.tags : names }));
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
        const values = new Set(
          siblings
            .filter((node) => String(node?.id ?? '') !== String(nodeId))
            .map((node) =>
              typeof node?.metadata.name === 'string' ? node.metadata.name.trim().toLowerCase() : ''
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
    (data: DialogStepData) => {
      const info = toRecord(data) ?? {};
      const rawName = (info as { name?: unknown }).name;
      const name: string = typeof rawName === 'string' ? rawName : '';
      const rawDescription = (info as { description?: unknown }).description;
      const description: string = typeof rawDescription === 'string' ? rawDescription : '';
      const tags: string[] = Array.isArray((info as { tags?: unknown }).tags)
        ? ((info as { tags?: unknown }).tags as unknown[]).filter((v): v is string => typeof v === 'string')
        : [];
      const next: BasicInfoState = { name, description, tags };
      setBasicInfo(next);
      updateDraft({
        draftMetadata: {
          name: next.name,
          description: next.description,
          tags: next.tags,
        },
      });
    },
    [setBasicInfo, updateDraft]
  );

  useEffect(() => {
    if (!draft?.draftMetadata) return;
    setBasicInfo((prev) => {
      const nextName =
        typeof draft.draftMetadata?.name === 'string' && draft.draftMetadata.name.length
          ? draft.draftMetadata.name
          : prev.name;
      const nextDescription =
        typeof draft.draftMetadata?.description === 'string' && draft.draftMetadata.description.length
          ? draft.draftMetadata.description
          : prev.description;
      const nextTags = Array.isArray(draft.draftMetadata?.tags)
        ? draft.draftMetadata.tags.filter((v): v is string => typeof v === 'string')
        : prev.tags;
      const tagsEqual =
        prev.tags.length === nextTags.length && prev.tags.every((tag, idx) => tag === nextTags[idx]);
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
