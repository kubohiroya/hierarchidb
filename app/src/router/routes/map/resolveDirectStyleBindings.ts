import {
  RESOLVER_STYLE_BINDING_VERSION,
  type ResolverFeatureTargetKind,
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

export type ResolveDirectStyleBindingTargetsInput = {
  bindings: readonly unknown[];
  styleSources: readonly DirectStyleBindingSource[];
  targetNodeTypesById: ReadonlyMap<string, string>;
};

type StyleValueKind = 'color' | 'number';
type PaintLayerType = keyof LayerStyleOverrides;
type ParsedDirectStyleBinding = {
  version: typeof RESOLVER_STYLE_BINDING_VERSION;
  bindingId: string;
  stylerNodeId: string;
  targetNodeId: string;
  targetKind: ResolverFeatureTargetKind;
  sourceKeyColumn: string;
  targetKeyProperty: string;
  styleProperties: ResolverStyleProperty[];
  enabled: boolean;
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
}: ResolveDirectStyleBindingTargetsInput): Map<string, DirectStyleBindingTarget> => {
  const sourcesById = new Map(styleSources.map((source) => [source.nodeId, source]));
  const targetsById = new Map<string, DirectStyleBindingTarget>();

  bindings.forEach((value) => {
    const binding = parseDirectStyleBinding(value);
    if (!binding?.enabled) return;
    if (targetNodeTypesById.get(binding.targetNodeId) !== binding.targetKind) return;

    const source = sourcesById.get(binding.stylerNodeId);
    if (!source?.enabled) return;

    const target = targetsById.get(binding.targetNodeId) ?? {
      targetNodeId: binding.targetNodeId,
      targetKind: binding.targetKind,
      paintOverrides: {},
    };

    binding.styleProperties.forEach((property) => {
      const paintByLayerType = PAINT_PROPERTY_BY_TARGET[binding.targetKind][property];
      if (!paintByLayerType) return;
      const valueKind = PROPERTY_VALUE_KIND[property];
      const expression =
        valueKind === 'color'
          ? buildColorMatchExpression(binding.targetKeyProperty, source.colorStops)
          : buildNumberMatchExpression(binding.targetKeyProperty, source.scalarStops);
      if (!expression) return;

      Object.entries(paintByLayerType).forEach(([layerType, paintProperty]) => {
        if (!paintProperty) return;
        if (!isPaintLayerType(layerType)) return;
        target.paintOverrides[layerType] = {
          ...(target.paintOverrides[layerType] ?? {}),
          [paintProperty]: expression,
        };
      });
    });

    if (Object.keys(target.paintOverrides).length > 0) {
      targetsById.set(binding.targetNodeId, target);
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
  if (value.targetKind === 'folder' || !isResolverFeatureTargetKind(value.targetKind)) return null;
  if (!isNonEmptyString(value.bindingId)) return null;
  if (!isNonEmptyString(value.stylerNodeId)) return null;
  if (!isNonEmptyString(value.targetNodeId)) return null;
  if (!isNonEmptyString(value.sourceKeyColumn)) return null;
  if (!isNonEmptyString(value.targetKeyProperty)) return null;
  if (typeof value.enabled !== 'boolean') return null;
  if (!Array.isArray(value.styleProperties) || value.styleProperties.length === 0) return null;
  if (!value.styleProperties.every(isResolverStyleProperty)) return null;
  return {
    version: RESOLVER_STYLE_BINDING_VERSION,
    bindingId: value.bindingId,
    stylerNodeId: value.stylerNodeId,
    targetNodeId: value.targetNodeId,
    targetKind: value.targetKind,
    sourceKeyColumn: value.sourceKeyColumn,
    targetKeyProperty: value.targetKeyProperty,
    styleProperties: value.styleProperties,
    enabled: value.enabled,
  };
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
