import type { NodeId } from '@hierarchidb/core-types';
import {
  RESOLVER_FORBIDDEN_STYLE_BINDING_FIELDS,
  RESOLVER_STYLE_BINDING_VERSION,
  RESOLVER_STYLE_PROPERTIES_BY_TARGET_KIND,
  type ResolverFeatureTargetKind,
  type ResolverStyleBinding,
  type ResolverStyleBindingValidationIssue,
  type ResolverStyleBindingValidationResult,
  type ResolverStyleProperty,
} from '@hierarchidb/resolver-store';

export interface DirectStyleBindingValidationNode {
  readonly id: NodeId;
  readonly nodeType: string;
}

export interface DirectStyleBindingNodeResolver {
  readonly resolveStylerNode: (nodeId: NodeId) => DirectStyleBindingValidationNode | null;
  readonly resolveTargetNode: (nodeId: NodeId) => DirectStyleBindingValidationNode | null;
}

export function validateDirectStyleBindings(
  bindings: readonly ResolverStyleBinding[] | undefined,
  resolver: DirectStyleBindingNodeResolver
): ResolverStyleBindingValidationResult {
  if (bindings === undefined) {
    return { ok: true, errors: [] };
  }

  const errors: ResolverStyleBindingValidationIssue[] = [];
  const bindingIds = new Set<string>();
  const targetPropertyKeys = new Set<string>();

  for (const binding of bindings) {
    if (!isRecord(binding)) {
      errors.push({ code: 'STYLE_BINDING_INVALID_RECORD' });
      continue;
    }

    const bindingId = typeof binding.bindingId === 'string' ? binding.bindingId : undefined;
    if (!isNonEmptyString(bindingId) || binding.version !== RESOLVER_STYLE_BINDING_VERSION) {
      errors.push({ code: 'STYLE_BINDING_INVALID_RECORD', bindingId });
      continue;
    }

    if (hasForbiddenPublicField(binding)) {
      errors.push({ code: 'STYLE_BINDING_FORBIDDEN_PUBLIC_FIELD', bindingId });
      continue;
    }

    if (bindingIds.has(bindingId)) {
      errors.push({ code: 'STYLE_BINDING_DUPLICATE_BINDING_ID', bindingId });
    }
    bindingIds.add(bindingId);

    if (!isNonEmptyString(binding.sourceKeyColumn)) {
      errors.push({ code: 'STYLE_BINDING_MISSING_SOURCE_KEY', bindingId });
    }
    if (!isNonEmptyString(binding.targetKeyProperty)) {
      errors.push({ code: 'STYLE_BINDING_MISSING_TARGET_KEY', bindingId });
    }

    if (binding.targetKind === 'folder') {
      errors.push({ code: 'STYLE_BINDING_UNSUPPORTED_TARGET_KIND', bindingId });
      continue;
    }
    if (!isResolverFeatureTargetKind(binding.targetKind)) {
      errors.push({ code: 'STYLE_BINDING_UNSUPPORTED_TARGET_KIND', bindingId });
      continue;
    }

    const stylerNode = resolver.resolveStylerNode(binding.stylerNodeId);
    if (!stylerNode || stylerNode.nodeType !== 'styler') {
      errors.push({ code: 'STYLE_BINDING_MISSING_STYLER', bindingId });
    }

    const targetNode = resolver.resolveTargetNode(binding.targetNodeId);
    if (!targetNode) {
      errors.push({ code: 'STYLE_BINDING_MISSING_TARGET', bindingId });
    } else if (targetNode.nodeType !== binding.targetKind) {
      errors.push({ code: 'STYLE_BINDING_TARGET_KIND_MISMATCH', bindingId });
    }

    if (!Array.isArray(binding.styleProperties) || binding.styleProperties.length === 0) {
      errors.push({ code: 'STYLE_BINDING_INVALID_STYLE_PROPERTY', bindingId });
      continue;
    }

    for (const property of binding.styleProperties) {
      if (!isResolverStyleProperty(property)) {
        errors.push({ code: 'STYLE_BINDING_INVALID_STYLE_PROPERTY', bindingId });
        continue;
      }
      if (!isSupportedStyleProperty(binding.targetKind, property)) {
        errors.push({ code: 'STYLE_BINDING_INVALID_STYLE_PROPERTY', bindingId });
      }
      if (!binding.enabled) {
        continue;
      }
      const conflictKey = `${binding.targetNodeId}:${property}`;
      if (targetPropertyKeys.has(conflictKey)) {
        errors.push({ code: 'STYLE_BINDING_CONFLICT', bindingId });
      }
      targetPropertyKeys.add(conflictKey);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function hasForbiddenPublicField(record: Record<string, unknown>): boolean {
  return RESOLVER_FORBIDDEN_STYLE_BINDING_FIELDS.some((field) => Object.hasOwn(record, field));
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

function isSupportedStyleProperty(
  targetKind: ResolverFeatureTargetKind,
  property: ResolverStyleProperty
): boolean {
  return RESOLVER_STYLE_PROPERTIES_BY_TARGET_KIND[targetKind].includes(property);
}
