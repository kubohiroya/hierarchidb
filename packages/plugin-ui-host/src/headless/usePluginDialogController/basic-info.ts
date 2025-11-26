import { useCallback, useEffect, useMemo, useState } from 'react';
import type { NodeId } from '@hierarchidb/common-types';
import type { Remote } from 'comlink';
import type { WorkerAPI } from '@hierarchidb/common-api';
import { resolveDefaultNodeName } from '@hierarchidb/runtime-worker';
import type { DraftData } from '@hierarchidb/plugin-ui-sdk';
import { toRecord } from '../controller/step-guards.js';
import type { BasicInfoMeta, BasicInfoState } from './types.js';
import type { DialogStepData } from './data-types.js';
import type { TagEntity } from '@hierarchidb/common-types';
import type React from 'react';

interface Params {
  mode: 'create' | 'edit';
  nodeType: string;
  nodeId: NodeId;
  pageNodeId: NodeId;
  client: Remote<WorkerAPI> | null;
  draft: DraftData | null;
  draftDataWithoutMeta: DialogStepData;
  updateDraft: (patch: Partial<DraftData>) => void;
}

const toStringArray = (
  value: DialogStepData | DialogStepData[keyof DialogStepData] | null | undefined
): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];

export function useBasicInfoState({
  mode,
  nodeType,
  nodeId,
  pageNodeId,
  client,
  draft,
  draftDataWithoutMeta,
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
    if (draft) {
      const tags =
        (Array.isArray(draft.draftMetadata?.tags)
          ? draft.draftMetadata?.tags
          : draft.metadata?.tags) ?? [];
      const resolvedName =
        typeof draft.draftMetadata?.name === 'string' && draft.draftMetadata.name.length
          ? draft.draftMetadata.name
          : typeof draft.metadata?.name === 'string'
            ? draft.metadata.name
            : '';
      const resolvedDescription =
        typeof draft.draftMetadata?.description === 'string' && draft.draftMetadata.description.length
          ? draft.draftMetadata.description
          : typeof draft.metadata?.description === 'string'
            ? draft.metadata.description
            : '';
      setBasicInfo({
        name: resolvedName,
        description: resolvedDescription,
        tags,
      });
    }
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

  useEffect(() => {
    let disposed = false;
    (async () => {
      try {
        if (!client || !nodeId) return;
        const query = await client.getQueryAPI();
        const node = await query.getNode(nodeId);
        if (!node || disposed) return;
        const nodeData = toRecord(
          typeof node === 'object' && node !== null ? (node as { data?: DialogStepData }).data : undefined
        );
        const nodeTags = toStringArray(nodeData?.tags);
        setBasicInfo((prev) => ({
          name: prev.name || node.metadata.name || '',
          description: prev.description || node.metadata.description || '',
          tags: prev.tags.length ? prev.tags : nodeTags,
        }));
      } catch (err) {
        console.warn('[PluginDialogShell] prefill from QueryAPI failed', err);
      }
    })();
    return () => {
      disposed = true;
    };
  }, [client, nodeId]);

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
      const name = typeof info.name === 'string' ? info.name : '';
      const description = typeof info.description === 'string' ? info.description : '';
      const tags = Array.isArray(info.tags)
        ? info.tags.filter((v: DialogStepData[keyof DialogStepData]): v is string => typeof v === 'string')
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
    if (!draft?.data) return;
    setBasicInfo((prev) => {
      const info = toRecord(draftDataWithoutMeta);
      if (!info) return prev;
      const name = typeof info.name === 'string' ? info.name : prev.name;
      const description = typeof info.description === 'string' ? info.description : prev.description;
      const tags =
        Array.isArray(info.tags) && info.tags.every((v: DialogStepData[keyof DialogStepData]): v is string => typeof v === 'string')
          ? (info.tags as string[])
          : prev.tags;
      const tagsEqual =
        prev.tags.length === tags.length && prev.tags.every((tag, idx) => tag === tags[idx]);
      if (prev.name === name && prev.description === description && tagsEqual) {
        return prev;
      }
      return {
        name,
        description,
        tags,
      };
    });
  }, [draft?.data, draftDataWithoutMeta]);

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
