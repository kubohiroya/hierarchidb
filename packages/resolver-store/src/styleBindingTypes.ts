import type { NodeId } from '@hierarchidb/core-types';

export const RESOLVER_STYLE_BINDING_VERSION = 1 as const;

export type ResolverFeatureTargetKind = 'shape' | 'location' | 'route';
export type ResolverStyleBindingTargetKind = ResolverFeatureTargetKind | 'folder';
export type ResolverFolderScopeMode = 'direct-children' | 'recursive-descendants';

export type ResolverStyleProperty =
  | 'fillColor'
  | 'strokeColor'
  | 'strokeWidth'
  | 'opacity'
  | 'radius';

export interface ResolverStyleBinding {
  readonly version: typeof RESOLVER_STYLE_BINDING_VERSION;
  readonly bindingId: string;
  readonly stylerNodeId: NodeId;
  readonly targetNodeId: NodeId;
  readonly targetKind: ResolverStyleBindingTargetKind;
  readonly scopeMode?: ResolverFolderScopeMode;
  readonly sourceKeyColumn: string;
  readonly targetKeyProperty: string;
  readonly styleProperties: readonly ResolverStyleProperty[];
  readonly enabled: boolean;
}

export type ResolverStyleBindingValidationCode =
  | 'STYLE_BINDING_INVALID_RECORD'
  | 'STYLE_BINDING_DUPLICATE_BINDING_ID'
  | 'STYLE_BINDING_MISSING_STYLER'
  | 'STYLE_BINDING_MISSING_TARGET'
  | 'STYLE_BINDING_UNSUPPORTED_TARGET_KIND'
  | 'STYLE_BINDING_TARGET_KIND_MISMATCH'
  | 'STYLE_BINDING_MISSING_SOURCE_KEY'
  | 'STYLE_BINDING_MISSING_TARGET_KEY'
  | 'STYLE_BINDING_INVALID_STYLE_PROPERTY'
  | 'STYLE_BINDING_CONFLICT'
  | 'STYLE_BINDING_FORBIDDEN_PUBLIC_FIELD'
  | 'STYLE_BINDING_MISSING_FOLDER_SCOPE_MODE'
  | 'STYLE_BINDING_UNSUPPORTED_FOLDER_SCOPE_MODE'
  | 'MOUNTED_FOLDER_ENUMERATION_UNAVAILABLE';

export type ResolverStyleBindingValidationWarningCode =
  | 'STYLE_BINDING_EMPTY_FOLDER_SCOPE'
  | 'STYLE_BINDING_UNSUPPORTED_DESCENDANT_SKIPPED'
  | 'STYLE_BINDING_ARCHIVED_DESCENDANT_SKIPPED';

export interface ResolverStyleBindingValidationIssue {
  readonly code: ResolverStyleBindingValidationCode | ResolverStyleBindingValidationWarningCode;
  readonly bindingId?: string;
}

export type ResolverStyleBindingValidationResult = Readonly<{
  readonly ok: boolean;
  readonly errors: readonly ResolverStyleBindingValidationIssue[];
  readonly warnings: readonly ResolverStyleBindingValidationIssue[];
}>;

export const RESOLVER_STYLE_PROPERTIES_BY_TARGET_KIND: Readonly<
  Record<ResolverFeatureTargetKind, readonly ResolverStyleProperty[]>
> = {
  shape: ['fillColor', 'strokeColor', 'strokeWidth', 'opacity'],
  location: ['strokeColor', 'strokeWidth', 'opacity', 'radius'],
  route: ['strokeColor', 'strokeWidth', 'opacity'],
};

export const RESOLVER_FORBIDDEN_STYLE_BINDING_FIELDS = [
  'endpoint',
  'endpointUrl',
  'graphqlUrl',
  'token',
  'jwt',
  'authToken',
  'absolutePath',
  'content',
  'csvText',
] as const;
