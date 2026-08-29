import type { NodeId } from '@hierarchidb/core-types';
import {
  RESOLVER_FORBIDDEN_STYLE_BINDING_FIELDS,
  RESOLVER_STYLE_BINDING_VERSION,
  RESOLVER_STYLE_PROPERTIES_BY_TARGET_KIND,
  type ResolverFeatureTargetKind,
  type ResolverFolderScopeMode,
  type ResolverStyleBinding,
  type ResolverStyleBindingValidationIssue,
  type ResolverStyleBindingValidationResult,
  type ResolverStyleProperty,
} from '@hierarchidb/resolver-store';

export interface DirectStyleBindingValidationNode {
  readonly id: NodeId;
  readonly nodeType: string;
  readonly parentId?: NodeId | null;
  readonly depth?: number;
  readonly removedAt?: unknown;
}

export interface DirectStyleBindingNodeResolver {
  readonly resolveStylerNode: (nodeId: NodeId) => DirectStyleBindingValidationNode | null;
  readonly resolveTargetNode: (nodeId: NodeId) => DirectStyleBindingValidationNode | null;
  readonly resolveTargetDescendants?: (
    nodeId: NodeId,
    scopeMode: ResolverFolderScopeMode
  ) => readonly DirectStyleBindingValidationNode[] | null;
}

export function validateDirectStyleBindings(
  bindings: readonly ResolverStyleBinding[] | undefined,
  resolver: DirectStyleBindingNodeResolver
): ResolverStyleBindingValidationResult {
  if (bindings === undefined) {
    return { ok: true, errors: [], warnings: [] };
  }

  const errors: ResolverStyleBindingValidationIssue[] = [];
  const warnings: ResolverStyleBindingValidationIssue[] = [];
  const bindingIds = new Set<string>();
  const targetPropertyKeys = new Set<string>();
  const folderTargetPropertyKeys = new Map<string, FolderConflictEntry>();

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

    if (binding.targetKind !== 'folder' && !isResolverFeatureTargetKind(binding.targetKind)) {
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
    } else if (binding.targetKind === 'folder') {
      if (!isFolderNodeType(targetNode.nodeType)) {
        errors.push({ code: 'STYLE_BINDING_TARGET_KIND_MISMATCH', bindingId });
      }
    } else if (targetNode.nodeType !== binding.targetKind) {
      errors.push({ code: 'STYLE_BINDING_TARGET_KIND_MISMATCH', bindingId });
    }

    const folderScopeMode =
      binding.targetKind === 'folder'
        ? resolveFolderScopeMode(binding.scopeMode, bindingId, errors)
        : null;
    const folderDescendants =
      binding.targetKind === 'folder' && folderScopeMode && resolver.resolveTargetDescendants
        ? resolver.resolveTargetDescendants(binding.targetNodeId, folderScopeMode)
        : undefined;
    const folderCandidates =
      binding.targetKind === 'folder' && folderScopeMode
        ? validateFolderDescendants(folderDescendants, bindingId, errors, warnings)
        : [];

    if (!Array.isArray(binding.styleProperties) || binding.styleProperties.length === 0) {
      errors.push({ code: 'STYLE_BINDING_INVALID_STYLE_PROPERTY', bindingId });
      continue;
    }

    for (const property of binding.styleProperties) {
      if (!isResolverStyleProperty(property)) {
        errors.push({ code: 'STYLE_BINDING_INVALID_STYLE_PROPERTY', bindingId });
        continue;
      }
      if (
        binding.targetKind !== 'folder' &&
        !isSupportedStyleProperty(binding.targetKind, property)
      ) {
        errors.push({ code: 'STYLE_BINDING_INVALID_STYLE_PROPERTY', bindingId });
      }
      if (binding.targetKind === 'folder' && !isSupportedByAnyFeatureTarget(property)) {
        errors.push({ code: 'STYLE_BINDING_INVALID_STYLE_PROPERTY', bindingId });
      }
      if (!binding.enabled) {
        continue;
      }
      if (binding.targetKind === 'folder') {
        recordFolderConflicts({
          bindingId,
          binding,
          property,
          scopeDepth: resolveNodeDepth(targetNode),
          folderCandidates,
          folderTargetPropertyKeys,
          errors,
        });
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
    warnings,
  };
}

type FolderConflictEntry = {
  readonly bindingId: string;
  readonly folderNodeId: NodeId;
  readonly scopeDepth: number;
};

function resolveFolderScopeMode(
  value: unknown,
  bindingId: string | undefined,
  errors: ResolverStyleBindingValidationIssue[]
): ResolverFolderScopeMode | null {
  if (value === undefined || value === null || value === '') {
    errors.push({ code: 'STYLE_BINDING_MISSING_FOLDER_SCOPE_MODE', bindingId });
    return null;
  }
  if (value === 'direct-children' || value === 'recursive-descendants') {
    return value;
  }
  errors.push({ code: 'STYLE_BINDING_UNSUPPORTED_FOLDER_SCOPE_MODE', bindingId });
  return null;
}

function validateFolderDescendants(
  descendants: readonly DirectStyleBindingValidationNode[] | null | undefined,
  bindingId: string | undefined,
  errors: ResolverStyleBindingValidationIssue[],
  warnings: ResolverStyleBindingValidationIssue[]
): readonly DirectStyleBindingValidationNode[] {
  if (descendants === undefined) return [];
  if (descendants === null) {
    errors.push({ code: 'MOUNTED_FOLDER_ENUMERATION_UNAVAILABLE', bindingId });
    return [];
  }

  const candidates: DirectStyleBindingValidationNode[] = [];
  for (const descendant of descendants) {
    if (descendant.removedAt) {
      warnings.push({ code: 'STYLE_BINDING_ARCHIVED_DESCENDANT_SKIPPED', bindingId });
      continue;
    }
    if (!isResolverFeatureTargetKind(descendant.nodeType)) {
      warnings.push({ code: 'STYLE_BINDING_UNSUPPORTED_DESCENDANT_SKIPPED', bindingId });
      continue;
    }
    candidates.push(descendant);
  }
  if (candidates.length === 0) {
    warnings.push({ code: 'STYLE_BINDING_EMPTY_FOLDER_SCOPE', bindingId });
  }
  return candidates;
}

function recordFolderConflicts({
  bindingId,
  binding,
  property,
  scopeDepth,
  folderCandidates,
  folderTargetPropertyKeys,
  errors,
}: {
  bindingId: string | undefined;
  binding: ResolverStyleBinding;
  property: ResolverStyleProperty;
  scopeDepth: number;
  folderCandidates: readonly DirectStyleBindingValidationNode[];
  folderTargetPropertyKeys: Map<string, FolderConflictEntry>;
  errors: ResolverStyleBindingValidationIssue[];
}): void {
  for (const candidate of folderCandidates) {
    if (!isResolverFeatureTargetKind(candidate.nodeType)) continue;
    if (!isSupportedStyleProperty(candidate.nodeType, property)) continue;
    const conflictKey = `${candidate.id}:${property}`;
    const nextEntry: FolderConflictEntry = {
      bindingId: bindingId ?? '',
      folderNodeId: binding.targetNodeId,
      scopeDepth,
    };
    const current = folderTargetPropertyKeys.get(conflictKey);
    if (current?.scopeDepth === nextEntry.scopeDepth && current.bindingId !== nextEntry.bindingId) {
      errors.push({ code: 'STYLE_BINDING_CONFLICT', bindingId });
    }
    if (!current || current.scopeDepth <= nextEntry.scopeDepth) {
      folderTargetPropertyKeys.set(conflictKey, nextEntry);
    }
  }
}

function resolveNodeDepth(node: DirectStyleBindingValidationNode | null): number {
  if (!node) return 0;
  if (typeof node.depth === 'number' && Number.isFinite(node.depth)) return node.depth;
  return 0;
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

function isSupportedStyleProperty(
  targetKind: ResolverFeatureTargetKind,
  property: ResolverStyleProperty
): boolean {
  return RESOLVER_STYLE_PROPERTIES_BY_TARGET_KIND[targetKind].includes(property);
}

function isSupportedByAnyFeatureTarget(property: ResolverStyleProperty): boolean {
  return (
    Object.keys(RESOLVER_STYLE_PROPERTIES_BY_TARGET_KIND) as ResolverFeatureTargetKind[]
  ).some((targetKind) => isSupportedStyleProperty(targetKind, property));
}
