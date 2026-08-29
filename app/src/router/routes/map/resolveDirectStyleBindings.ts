import {
  RESOLVER_STYLE_BINDING_VERSION,
  type ResolverFeatureTargetKind,
  type ResolverFolderScopeMode,
  type ResolverStyleBindingTargetKind,
  type ResolverStyleProperty,
} from '@hierarchidb/resolver-store';
import type { LayerStyleOverrides } from './types.js';

export type DirectStyleBindingSource = {
  nodeId: string;
  enabled: boolean;
  colorStops: Array<{ key: string; color: string }>;
  scalarStops: Array<{ key: string; scalarValue: number }>;
};

export type DirectStyleBindingTarget = {
  targetNodeId: string;
  targetKind: ResolverFeatureTargetKind;
  paintOverrides: LayerStyleOverrides;
};

export type DirectStyleBindingTargetNode = {
  id: string;
  parentId?: string | null;
  nodeType: string;
  removedAt?: unknown;
};

export type ResolveDirectStyleBindingTargetsInput = {
  bindings: readonly unknown[];
  styleSources: readonly DirectStyleBindingSource[];
  targetNodeTypesById?: ReadonlyMap<string, string>;
  targetNodesById?: ReadonlyMap<string, DirectStyleBindingTargetNode>;
};

type StyleValueKind = 'color' | 'number';
type PaintLayerType = keyof LayerStyleOverrides;
type ParsedDirectStyleBinding = {
  version: typeof RESOLVER_STYLE_BINDING_VERSION;
  bindingId: string;
  stylerNodeId: string;
  targetNodeId: string;
  targetKind: ResolverStyleBindingTargetKind;
  scopeMode?: ResolverFolderScopeMode;
  sourceKeyColumn: string;
  targetKeyProperty: string;
  styleProperties: ResolverStyleProperty[];
  enabled: boolean;
};

type ResolvedBindingCandidate = {
  binding: ParsedDirectStyleBinding;
  targetNodeId: string;
  targetKind: ResolverFeatureTargetKind;
  scopeDepth: number;
  direct: boolean;
};

const PROPERTY_VALUE_KIND: Record<ResolverStyleProperty, StyleValueKind> = {
  fillColor: 'color',
  strokeColor: 'color',
  strokeWidth: 'number',
  opacity: 'number',
  radius: 'number',
};

const PAINT_PROPERTY_BY_TARGET: Record<
  ResolverFeatureTargetKind,
  Partial<Record<ResolverStyleProperty, Partial<Record<PaintLayerType, string>>>>
> = {
  shape: {
    fillColor: { fill: 'fill-color' },
    strokeColor: { fill: 'fill-outline-color', line: 'line-color' },
    strokeWidth: { line: 'line-width' },
    opacity: { fill: 'fill-opacity', line: 'line-opacity' },
  },
  location: {
    strokeColor: { circle: 'circle-color' },
    strokeWidth: { circle: 'circle-stroke-width' },
    opacity: { circle: 'circle-opacity' },
    radius: { circle: 'circle-radius' },
  },
  route: {
    strokeColor: { line: 'line-color' },
    strokeWidth: { line: 'line-width' },
    opacity: { line: 'line-opacity' },
  },
};

const DEFAULT_PAINT_FALLBACK: Record<string, string | number> = {
  'fill-color': '#6aa6ff',
  'fill-outline-color': '#6aa6ff',
  'fill-opacity': 0.3,
  'line-color': '#f24c3d',
  'line-width': 2,
  'line-opacity': 0.8,
  'circle-color': '#2f74ff',
  'circle-stroke-width': 0,
  'circle-opacity': 0.8,
  'circle-radius': 4,
};

export const resolveDirectStyleBindingTargets = ({
  bindings,
  styleSources,
  targetNodeTypesById,
  targetNodesById,
}: ResolveDirectStyleBindingTargetsInput): Map<string, DirectStyleBindingTarget> => {
  const sourcesById = new Map(styleSources.map((source) => [source.nodeId, source]));
  const targetsById = new Map<string, DirectStyleBindingTarget>();
  const candidatesByTargetProperty = new Map<string, ResolvedBindingCandidate[]>();

  bindings.forEach((value) => {
    const binding = parseDirectStyleBinding(value);
    if (!binding?.enabled) return;

    const source = sourcesById.get(binding.stylerNodeId);
    if (!source?.enabled) return;

    resolveBindingCandidates(binding, targetNodeTypesById, targetNodesById).forEach((candidate) => {
      binding.styleProperties.forEach((property) => {
        if (!PAINT_PROPERTY_BY_TARGET[candidate.targetKind][property]) return;
        const key = `${candidate.targetNodeId}:${property}`;
        const current = candidatesByTargetProperty.get(key) ?? [];
        current.push(candidate);
        candidatesByTargetProperty.set(key, current);
      });
    });
  });

  candidatesByTargetProperty.forEach((candidates, key) => {
    const candidate = selectCandidate(candidates);
    if (!candidate) return;
    const property = key.slice(key.lastIndexOf(':') + 1);
    if (!isResolverStyleProperty(property)) return;
    const source = sourcesById.get(candidate.binding.stylerNodeId);
    if (!source?.enabled) return;

    const target = targetsById.get(candidate.targetNodeId) ?? {
      targetNodeId: candidate.targetNodeId,
      targetKind: candidate.targetKind,
      paintOverrides: {},
    };

    const paintByLayerType = PAINT_PROPERTY_BY_TARGET[candidate.targetKind][property];
    if (!paintByLayerType) return;
    const valueKind = PROPERTY_VALUE_KIND[property];
    const expression =
      valueKind === 'color'
        ? buildColorMatchExpression(candidate.binding.targetKeyProperty, source.colorStops)
        : buildNumberMatchExpression(candidate.binding.targetKeyProperty, source.scalarStops);
    if (!expression) return;

    Object.entries(paintByLayerType).forEach(([layerType, paintProperty]) => {
      if (!paintProperty) return;
      if (!isPaintLayerType(layerType)) return;
      target.paintOverrides[layerType] = {
        ...(target.paintOverrides[layerType] ?? {}),
        [paintProperty]: expression,
      };
    });

    if (Object.keys(target.paintOverrides).length > 0) {
      targetsById.set(candidate.targetNodeId, target);
    }
  });

  return targetsById;
};

export const applyDirectStyleBindingPaint = (
  layerType: unknown,
  basePaint: Record<string, unknown> | undefined,
  target: DirectStyleBindingTarget | undefined
): Record<string, unknown> | undefined => {
  if (!isPaintLayerType(layerType)) return basePaint;
  const override = target?.paintOverrides[layerType];
  if (!override) return basePaint;
  return {
    ...(basePaint ?? {}),
    ...withLayerFallbacks(override, basePaint ?? {}),
  };
};

function parseDirectStyleBinding(value: unknown): ParsedDirectStyleBinding | null {
  if (!isRecord(value)) return null;
  if (value.version !== RESOLVER_STYLE_BINDING_VERSION) return null;
  if (!isResolverStyleBindingTargetKind(value.targetKind)) return null;
  if (!isNonEmptyString(value.bindingId)) return null;
  if (!isNonEmptyString(value.stylerNodeId)) return null;
  if (!isNonEmptyString(value.targetNodeId)) return null;
  if (value.targetKind === 'folder' && !isResolverFolderScopeMode(value.scopeMode)) return null;
  if (!isNonEmptyString(value.sourceKeyColumn)) return null;
  if (!isNonEmptyString(value.targetKeyProperty)) return null;
  if (typeof value.enabled !== 'boolean') return null;
  if (!Array.isArray(value.styleProperties) || value.styleProperties.length === 0) return null;
  if (!value.styleProperties.every(isResolverStyleProperty)) return null;
  const scopeMode =
    value.targetKind === 'folder' && isResolverFolderScopeMode(value.scopeMode)
      ? value.scopeMode
      : undefined;
  return {
    version: RESOLVER_STYLE_BINDING_VERSION,
    bindingId: value.bindingId,
    stylerNodeId: value.stylerNodeId,
    targetNodeId: value.targetNodeId,
    targetKind: value.targetKind,
    ...(value.targetKind === 'folder' ? { scopeMode } : {}),
    sourceKeyColumn: value.sourceKeyColumn,
    targetKeyProperty: value.targetKeyProperty,
    styleProperties: value.styleProperties,
    enabled: value.enabled,
  };
}

function resolveBindingCandidates(
  binding: ParsedDirectStyleBinding,
  targetNodeTypesById: ReadonlyMap<string, string> | undefined,
  targetNodesById: ReadonlyMap<string, DirectStyleBindingTargetNode> | undefined
): ResolvedBindingCandidate[] {
  if (binding.targetKind !== 'folder') {
    const nodeType =
      targetNodesById?.get(binding.targetNodeId)?.nodeType ??
      targetNodeTypesById?.get(binding.targetNodeId);
    if (nodeType !== binding.targetKind) return [];
    return [
      {
        binding,
        targetNodeId: binding.targetNodeId,
        targetKind: binding.targetKind,
        scopeDepth: Number.POSITIVE_INFINITY,
        direct: true,
      },
    ];
  }

  const folder = targetNodesById?.get(binding.targetNodeId);
  const availableNodes = targetNodesById;
  if (!folder || !availableNodes || !isFolderNodeType(folder.nodeType) || !binding.scopeMode) {
    return [];
  }

  return resolveFolderDescendants(folder.id, binding.scopeMode, availableNodes).flatMap((node) => {
    if (!isResolverFeatureTargetKind(node.nodeType)) return [];
    if (node.removedAt) return [];
    return {
      binding,
      targetNodeId: node.id,
      targetKind: node.nodeType,
      scopeDepth: resolveNodeDepth(folder, availableNodes),
      direct: false,
    };
  });
}

function selectCandidate(candidates: ResolvedBindingCandidate[]): ResolvedBindingCandidate | null {
  const sorted = [...candidates].sort((a, b) => {
    if (a.direct !== b.direct) return a.direct ? -1 : 1;
    return b.scopeDepth - a.scopeDepth;
  });
  const first = sorted[0];
  if (!first) return null;
  const second = sorted[1];
  if (
    second &&
    !first.direct &&
    !second.direct &&
    first.scopeDepth === second.scopeDepth &&
    first.binding.bindingId !== second.binding.bindingId
  ) {
    return null;
  }
  return first;
}

function resolveFolderDescendants(
  folderId: string,
  scopeMode: ResolverFolderScopeMode,
  targetNodesById: ReadonlyMap<string, DirectStyleBindingTargetNode>
): DirectStyleBindingTargetNode[] {
  const descendants: DirectStyleBindingTargetNode[] = [];
  const childrenByParentId = new Map<string, DirectStyleBindingTargetNode[]>();
  targetNodesById.forEach((node) => {
    if (!node.parentId) return;
    const siblings = childrenByParentId.get(node.parentId) ?? [];
    siblings.push(node);
    childrenByParentId.set(node.parentId, siblings);
  });
  const queue = [...(childrenByParentId.get(folderId) ?? [])];
  while (queue.length > 0) {
    const node = queue.shift();
    if (!node) continue;
    descendants.push(node);
    if (scopeMode === 'recursive-descendants') {
      queue.push(...(childrenByParentId.get(node.id) ?? []));
    }
  }
  return descendants;
}

function resolveNodeDepth(
  node: DirectStyleBindingTargetNode,
  targetNodesById: ReadonlyMap<string, DirectStyleBindingTargetNode>
): number {
  let depth = 0;
  let current: DirectStyleBindingTargetNode | undefined = node;
  const visited = new Set<string>();
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    depth += 1;
    current = current.parentId ? targetNodesById.get(current.parentId) : undefined;
  }
  return depth;
}

function buildColorMatchExpression(
  targetKeyProperty: string,
  stops: Array<{ key: string; color: string }>
): unknown[] | null {
  const pairs = stops.flatMap((stop) => (isColorValue(stop.color) ? [stop.key, stop.color] : []));
  if (pairs.length === 0) return null;
  return ['match', ['to-string', ['get', targetKeyProperty]], ...pairs, null];
}

function buildNumberMatchExpression(
  targetKeyProperty: string,
  stops: Array<{ key: string; scalarValue: number }>
): unknown[] | null {
  const pairs = stops.flatMap((stop) =>
    Number.isFinite(stop.scalarValue) ? [stop.key, stop.scalarValue] : []
  );
  if (pairs.length === 0) return null;
  return ['match', ['to-string', ['get', targetKeyProperty]], ...pairs, null];
}

function withLayerFallbacks(
  overrides: Record<string, unknown>,
  basePaint: Record<string, unknown>
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(overrides).map(([key, expression]) => [
      key,
      Array.isArray(expression) ? replaceNullFallback(key, expression, basePaint[key]) : expression,
    ])
  );
}

function replaceNullFallback(key: string, expression: unknown[], fallback: unknown): unknown[] {
  return expression.map((entry, index) =>
    index === expression.length - 1 && entry === null
      ? (fallback ?? DEFAULT_PAINT_FALLBACK[key] ?? null)
      : entry
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isColorValue(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isResolverFeatureTargetKind(value: unknown): value is ResolverFeatureTargetKind {
  return value === 'shape' || value === 'location' || value === 'route';
}

function isResolverStyleBindingTargetKind(value: unknown): value is ResolverStyleBindingTargetKind {
  return value === 'folder' || isResolverFeatureTargetKind(value);
}

function isResolverFolderScopeMode(value: unknown): value is ResolverFolderScopeMode {
  return value === 'direct-children' || value === 'recursive-descendants';
}

function isFolderNodeType(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const normalized = value.trim();
  return normalized === 'folder' || /folder$/i.test(normalized);
}

function isResolverStyleProperty(value: unknown): value is ResolverStyleProperty {
  return (
    value === 'fillColor' ||
    value === 'strokeColor' ||
    value === 'strokeWidth' ||
    value === 'opacity' ||
    value === 'radius'
  );
}

function isPaintLayerType(value: unknown): value is PaintLayerType {
  return value === 'fill' || value === 'line' || value === 'circle' || value === 'symbol';
}
