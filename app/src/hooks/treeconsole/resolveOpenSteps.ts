import type { NodeId } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import type { WorkerAPI } from '@hierarchidb/worker-api';
import { composeStepConfigs } from '@hierarchidb/plugin-base';
import {
  isFolderNodeType,
  type OpenStepOption,
} from '@hierarchidb/ui-plugin-shell/ui-treeconsole-breadcrumb';
import { i18n } from '@hierarchidb/ui-i18n';
import type { Remote } from 'comlink';
import { loadAllUIPlugins, loadUIPlugin } from '../../plugin-loaders/ui-plugin-loader.js';

type StepConfigLike = {
  id: string;
  label?: string;
  optional?: boolean;
  validate?: (data: Record<string, unknown>) => boolean | Promise<boolean>;
  capabilities?: {
    canNavigateTo?: (fromStep: number, data: Record<string, unknown>) => boolean | Promise<boolean>;
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const normalizeNodeType = (value?: string): string => String(value ?? '').trim().toLowerCase();

const buildDialogData = (node?: TreeNode | null): Record<string, unknown> => {
  if (!node) return {};
  const baseMeta = node.draftMetadata ?? node.metadata ?? {};
  const base = {
    nodeId: node.id,
    name: typeof baseMeta.name === 'string' ? baseMeta.name : '',
    description: typeof baseMeta.description === 'string' ? baseMeta.description : '',
    tags: Array.isArray(baseMeta.tags)
      ? baseMeta.tags.filter((tag): tag is string => typeof tag === 'string')
      : [],
  };
  const data = isRecord(node.data) ? node.data : {};
  const draftData = isRecord(node.draftData) ? node.draftData : {};
  return { ...base, ...data, ...draftData, draftData, data };
};

const resolveDraftPayload = (node?: TreeNode | null): Record<string, unknown> => {
  if (!node || !isRecord(node.draftData)) return {};
  return node.draftData;
};

const resolveBasicInfoLabel = (): string => {
  try {
    const lang = String(i18n.resolvedLanguage ?? i18n.language ?? '').toLowerCase();
    if (lang.startsWith('ja')) {
      return '基本情報';
    }
    const label = i18n.t('basicInfo.title', {
      ns: 'common',
      defaultValue: 'Basic Information',
    });
    return typeof label === 'string' ? label : 'Basic Information';
  } catch {
    return 'Basic Information';
  }
};

const resolveActiveStepIndex = (node?: TreeNode | null): number => {
  const persisted = node?.dialogUIState?.dialogProgress?.activeStepIndex;
  if (typeof persisted === 'number' && Number.isFinite(persisted) && persisted >= 1) {
    return Math.max(persisted - 1, 0);
  }
  return 0;
};

const sequentiallyReachable = (index: number, optionalFlags: boolean[], filled: boolean[]): boolean => {
  if (index <= 0) return true;
  for (let i = 0; i < index; i += 1) {
    if (optionalFlags[i]) continue;
    if (!filled[i]) return false;
  }
  return true;
};

export async function resolveOpenStepsForNode(params: {
  nodeId?: NodeId | null;
  nodeType?: string;
  node?: TreeNode | null;
  client?: Remote<WorkerAPI> | null;
}): Promise<OpenStepOption[]> {
  let resolvedNode = params.node ?? null;
  if (!resolvedNode && params.client && params.nodeId) {
    try {
      const query = await params.client.getQueryAPI();
      resolvedNode = (await query.getNode(params.nodeId)) ?? null;
    } catch {
      resolvedNode = null;
    }
  }

  const nodeTypeFromNode = resolvedNode?.nodeType ?? params.node?.nodeType;
  const nodeTypeFromParam = params.nodeType;
  const candidateType = nodeTypeFromNode ?? nodeTypeFromParam;
  const normalizedType = normalizeNodeType(candidateType);
  if (!normalizedType || isFolderNodeType(normalizedType) || normalizedType === 'folder') {
    return [];
  }

  await loadUIPlugin(normalizedType).catch(() => false);

  const dialogData = buildDialogData(resolvedNode);
  const draftPayload = resolveDraftPayload(resolvedNode);
  let composed = composeStepConfigs(normalizedType, 'edit', draftPayload);
  if (!composed.configs?.length) {
    await loadAllUIPlugins().catch(() => false);
    composed = composeStepConfigs(normalizedType, 'edit', draftPayload);
  }
  const steps: StepConfigLike[] = [];

  if (!composed.hasHostBase) {
    steps.push({
      id: 'basic-info',
      label: resolveBasicInfoLabel(),
      optional: false,
      validate: () => Boolean(String(dialogData.name ?? '').trim()),
    });
  }

  steps.push(
    ...(composed.configs ?? []).map((cfg) => ({
      id: cfg.id,
      label: cfg.label ?? cfg.id,
      optional: Boolean(cfg.optional),
      validate: cfg.validate
        ? (data: Record<string, unknown>) =>
            Promise.resolve(cfg.validate?.(data)).then(Boolean)
        : undefined,
      capabilities: cfg.capabilities
        ? {
            canNavigateTo: cfg.capabilities.canNavigateTo
              ? (fromStep: number, data: Record<string, unknown>) =>
                  Promise.resolve(cfg.capabilities?.canNavigateTo?.(fromStep, data)).then(Boolean)
              : undefined,
          }
        : undefined,
    }))
  );

  if (steps.length === 0) {
    return [{ step: 1, label: 'Step 1', disabled: false }];
  }

  const filled = await Promise.all(
    steps.map(async (step) => {
      if (!step.validate) return true;
      try {
        const result = await Promise.resolve(step.validate(dialogData));
        return Boolean(result);
      } catch {
        return false;
      }
    })
  );
  const optionalFlags = steps.map((step) => Boolean(step.optional));
  const activeStepIndex = resolveActiveStepIndex(resolvedNode);

  const enabledFlags = await Promise.all(
    steps.map(async (step, index) => {
      let enabled = sequentiallyReachable(index, optionalFlags, filled);
      if (!enabled) return false;
      if (step.capabilities?.canNavigateTo) {
        try {
          const canNavigate = await Promise.resolve(
            step.capabilities.canNavigateTo(activeStepIndex, dialogData)
          );
          enabled = enabled && Boolean(canNavigate);
        } catch {
          enabled = false;
        }
      }
      return enabled;
    })
  );

  return steps.map((step, index) => ({
    step: index + 1,
    label: step.label,
    disabled: !enabledFlags[index],
  }));
}
