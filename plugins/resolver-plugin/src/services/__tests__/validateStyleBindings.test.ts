import type { NodeId } from '@hierarchidb/core-types';
import type { ResolverStyleBinding } from '@hierarchidb/resolver-store';
import { describe, expect, it } from 'vitest';
import {
  type DirectStyleBindingNodeResolver,
  type DirectStyleBindingValidationNode,
  validateDirectStyleBindings,
} from '../validateStyleBindings.js';

const stylerNodeId = 'styler-1' as NodeId;
const shapeNodeId = 'shape-1' as NodeId;
const locationNodeId = 'location-1' as NodeId;
const routeNodeId = 'route-1' as NodeId;
const folderNodeId = 'folder-1' as NodeId;
const nestedFolderNodeId = 'folder-2' as NodeId;
const siblingFolderNodeId = 'folder-3' as NodeId;

const resolver: DirectStyleBindingNodeResolver = {
  resolveStylerNode: (nodeId) =>
    nodeId === stylerNodeId ? { id: stylerNodeId, nodeType: 'styler' } : null,
  resolveTargetNode: (nodeId) => {
    if (nodeId === shapeNodeId) return { id: shapeNodeId, nodeType: 'shape' };
    if (nodeId === locationNodeId) return { id: locationNodeId, nodeType: 'location' };
    if (nodeId === routeNodeId) return { id: routeNodeId, nodeType: 'route' };
    if (nodeId === folderNodeId) return { id: folderNodeId, nodeType: 'folder', depth: 1 };
    if (nodeId === nestedFolderNodeId) {
      return { id: nestedFolderNodeId, nodeType: 'folder', depth: 2 };
    }
    if (nodeId === siblingFolderNodeId) {
      return { id: siblingFolderNodeId, nodeType: 'folder', depth: 2 };
    }
    return null;
  },
};

const resolverWithDescendants: DirectStyleBindingNodeResolver = {
  ...resolver,
  resolveTargetDescendants: (nodeId, scopeMode) => {
    if (nodeId !== folderNodeId) return null;
    const directChildren: DirectStyleBindingValidationNode[] = [
      { id: shapeNodeId, nodeType: 'shape' },
      { id: locationNodeId, nodeType: 'location' },
      { id: 'unsupported-1' as NodeId, nodeType: 'basemap' },
      { id: 'archived-route' as NodeId, nodeType: 'route', removedAt: 1 },
    ];
    if (scopeMode === 'direct-children') return directChildren;
    return [...directChildren, { id: routeNodeId, nodeType: 'route' }];
  },
};

function binding(overrides: Partial<ResolverStyleBinding> = {}): ResolverStyleBinding {
  return {
    version: 1,
    bindingId: 'binding-1',
    stylerNodeId,
    targetNodeId: shapeNodeId,
    targetKind: 'shape',
    sourceKeyColumn: 'id',
    targetKeyProperty: 'id',
    styleProperties: ['fillColor'],
    enabled: true,
    ...overrides,
  };
}

describe('validateDirectStyleBindings', () => {
  it('accepts valid direct Shape Location and Route bindings', () => {
    const result = validateDirectStyleBindings(
      [
        binding(),
        binding({
          bindingId: 'binding-2',
          targetNodeId: locationNodeId,
          targetKind: 'location',
          styleProperties: ['radius'],
        }),
        binding({
          bindingId: 'binding-3',
          targetNodeId: routeNodeId,
          targetKind: 'route',
          styleProperties: ['strokeColor', 'strokeWidth'],
        }),
      ],
      resolver
    );

    expect(result).toEqual({ ok: true, errors: [], warnings: [] });
  });

  it('treats missing styleBindings as legacy no-op', () => {
    expect(validateDirectStyleBindings(undefined, resolver)).toEqual({
      ok: true,
      errors: [],
      warnings: [],
    });
  });

  it('rejects missing Styler and missing target references', () => {
    const result = validateDirectStyleBindings(
      [
        binding({
          stylerNodeId: 'missing-styler' as NodeId,
          targetNodeId: 'missing-target' as NodeId,
        }),
      ],
      resolver
    );

    expect(result.errors.map((error) => error.code)).toEqual([
      'STYLE_BINDING_MISSING_STYLER',
      'STYLE_BINDING_MISSING_TARGET',
    ]);
  });

  it('accepts Folder targets with an explicit scope mode', () => {
    const result = validateDirectStyleBindings(
      [
        binding({
          targetKind: 'folder',
          targetNodeId: folderNodeId,
          scopeMode: 'direct-children',
        }),
      ],
      resolverWithDescendants
    );

    expect(result.errors).toEqual([]);
    expect(result.warnings.map((warning) => warning.code)).toEqual([
      'STYLE_BINDING_UNSUPPORTED_DESCENDANT_SKIPPED',
      'STYLE_BINDING_ARCHIVED_DESCENDANT_SKIPPED',
    ]);
  });

  it('rejects Folder targets without an explicit scope mode', () => {
    const result = validateDirectStyleBindings(
      [
        binding({
          targetKind: 'folder',
          targetNodeId: folderNodeId,
        }),
      ],
      resolverWithDescendants
    );

    expect(result.errors).toEqual([
      { code: 'STYLE_BINDING_MISSING_FOLDER_SCOPE_MODE', bindingId: 'binding-1' },
    ]);
  });

  it('rejects unsupported Folder scope modes', () => {
    const result = validateDirectStyleBindings(
      [
        {
          ...binding({
            targetKind: 'folder',
            targetNodeId: folderNodeId,
          }),
          scopeMode: 'all-descendants',
        } as unknown as ResolverStyleBinding,
      ],
      resolverWithDescendants
    );

    expect(result.errors).toEqual([
      { code: 'STYLE_BINDING_UNSUPPORTED_FOLDER_SCOPE_MODE', bindingId: 'binding-1' },
    ]);
  });

  it('reports unavailable mounted Folder enumeration', () => {
    const result = validateDirectStyleBindings(
      [
        binding({
          targetKind: 'folder',
          targetNodeId: folderNodeId,
          scopeMode: 'recursive-descendants',
        }),
      ],
      resolver
    );

    expect(result.errors).toEqual([]);

    const unavailableResult = validateDirectStyleBindings(
      [
        binding({
          targetKind: 'folder',
          targetNodeId: folderNodeId,
          scopeMode: 'recursive-descendants',
        }),
      ],
      {
        ...resolver,
        resolveTargetDescendants: () => null,
      }
    );

    expect(unavailableResult.errors).toEqual([
      { code: 'MOUNTED_FOLDER_ENUMERATION_UNAVAILABLE', bindingId: 'binding-1' },
    ]);
  });

  it('warns when Folder scope has no supported descendants', () => {
    const result = validateDirectStyleBindings(
      [
        binding({
          targetKind: 'folder',
          targetNodeId: folderNodeId,
          scopeMode: 'direct-children',
        }),
      ],
      {
        ...resolver,
        resolveTargetDescendants: () => [{ id: 'basemap-1' as NodeId, nodeType: 'basemap' }],
      }
    );

    expect(result.errors).toEqual([]);
    expect(result.warnings.map((warning) => warning.code)).toEqual([
      'STYLE_BINDING_UNSUPPORTED_DESCENDANT_SKIPPED',
      'STYLE_BINDING_EMPTY_FOLDER_SCOPE',
    ]);
  });

  it('allows deeper Folder scope bindings to override shallower Folder scope bindings', () => {
    const result = validateDirectStyleBindings(
      [
        binding({
          bindingId: 'folder-binding-1',
          targetKind: 'folder',
          targetNodeId: folderNodeId,
          scopeMode: 'recursive-descendants',
          styleProperties: ['strokeColor'],
        }),
        binding({
          bindingId: 'folder-binding-2',
          targetKind: 'folder',
          targetNodeId: nestedFolderNodeId,
          scopeMode: 'recursive-descendants',
          styleProperties: ['strokeColor'],
        }),
      ],
      {
        ...resolver,
        resolveTargetDescendants: (nodeId) => {
          if (nodeId === folderNodeId) return [{ id: routeNodeId, nodeType: 'route' }];
          if (nodeId === nestedFolderNodeId) return [{ id: routeNodeId, nodeType: 'route' }];
          return null;
        },
      }
    );

    expect(result.errors).toEqual([]);
  });

  it('rejects same-depth Folder scope conflicts for the same target property', () => {
    const result = validateDirectStyleBindings(
      [
        binding({
          bindingId: 'folder-binding-1',
          targetKind: 'folder',
          targetNodeId: nestedFolderNodeId,
          scopeMode: 'recursive-descendants',
          styleProperties: ['strokeColor'],
        }),
        binding({
          bindingId: 'folder-binding-2',
          targetKind: 'folder',
          targetNodeId: siblingFolderNodeId,
          scopeMode: 'recursive-descendants',
          styleProperties: ['strokeColor'],
        }),
      ],
      {
        ...resolver,
        resolveTargetDescendants: (nodeId) => {
          if (nodeId === nestedFolderNodeId) return [{ id: routeNodeId, nodeType: 'route' }];
          if (nodeId === siblingFolderNodeId) return [{ id: routeNodeId, nodeType: 'route' }];
          return null;
        },
      }
    );

    expect(result.errors).toEqual([
      { code: 'STYLE_BINDING_CONFLICT', bindingId: 'folder-binding-2' },
    ]);
  });

  it('rejects target kind mismatches', () => {
    const result = validateDirectStyleBindings(
      [
        binding({
          targetKind: 'route',
          targetNodeId: shapeNodeId,
          styleProperties: ['strokeColor'],
        }),
      ],
      resolver
    );

    expect(result.errors).toEqual([
      { code: 'STYLE_BINDING_TARGET_KIND_MISMATCH', bindingId: 'binding-1' },
    ]);
  });

  it('rejects missing join keys and invalid style properties', () => {
    const result = validateDirectStyleBindings(
      [
        binding({
          sourceKeyColumn: '',
          targetKeyProperty: '',
          styleProperties: ['fillColor', 'radius'],
        }),
      ],
      resolver
    );

    expect(result.errors.map((error) => error.code)).toEqual([
      'STYLE_BINDING_MISSING_SOURCE_KEY',
      'STYLE_BINDING_MISSING_TARGET_KEY',
      'STYLE_BINDING_INVALID_STYLE_PROPERTY',
    ]);
  });

  it('rejects malformed style property lists', () => {
    const result = validateDirectStyleBindings(
      [
        binding({ styleProperties: [] }),
        {
          ...binding({ bindingId: 'binding-2' }),
          styleProperties: 'fillColor',
        } as unknown as ResolverStyleBinding,
      ],
      resolver
    );

    expect(result.errors.map((error) => error.code)).toEqual([
      'STYLE_BINDING_INVALID_STYLE_PROPERTY',
      'STYLE_BINDING_INVALID_STYLE_PROPERTY',
    ]);
  });

  it('rejects duplicate binding IDs and enabled style conflicts', () => {
    const result = validateDirectStyleBindings(
      [
        binding(),
        binding({
          bindingId: 'binding-1',
          styleProperties: ['fillColor', 'strokeColor'],
        }),
      ],
      resolver
    );

    expect(result.errors.map((error) => error.code)).toEqual([
      'STYLE_BINDING_DUPLICATE_BINDING_ID',
      'STYLE_BINDING_CONFLICT',
    ]);
  });

  it('rejects forbidden public fields without echoing their values', () => {
    const result = validateDirectStyleBindings(
      [
        {
          ...binding(),
          endpointUrl: 'https://ide-gsm.example.test/graphql',
        } as ResolverStyleBinding,
      ],
      resolver
    );

    expect(result.errors).toEqual([
      { code: 'STYLE_BINDING_FORBIDDEN_PUBLIC_FIELD', bindingId: 'binding-1' },
    ]);
  });
});
