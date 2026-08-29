import type { NodeId } from '@hierarchidb/core-types';
import type { ResolverStyleBinding } from '@hierarchidb/resolver-store';
import { describe, expect, it } from 'vitest';
import {
  type DirectStyleBindingNodeResolver,
  validateDirectStyleBindings,
} from '../validateStyleBindings.js';

const stylerNodeId = 'styler-1' as NodeId;
const shapeNodeId = 'shape-1' as NodeId;
const locationNodeId = 'location-1' as NodeId;
const routeNodeId = 'route-1' as NodeId;
const folderNodeId = 'folder-1' as NodeId;

const resolver: DirectStyleBindingNodeResolver = {
  resolveStylerNode: (nodeId) =>
    nodeId === stylerNodeId ? { id: stylerNodeId, nodeType: 'styler' } : null,
  resolveTargetNode: (nodeId) => {
    if (nodeId === shapeNodeId) return { id: shapeNodeId, nodeType: 'shape' };
    if (nodeId === locationNodeId) return { id: locationNodeId, nodeType: 'location' };
    if (nodeId === routeNodeId) return { id: routeNodeId, nodeType: 'route' };
    if (nodeId === folderNodeId) return { id: folderNodeId, nodeType: 'folder' };
    return null;
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

    expect(result).toEqual({ ok: true, errors: [] });
  });

  it('treats missing styleBindings as legacy no-op', () => {
    expect(validateDirectStyleBindings(undefined, resolver)).toEqual({ ok: true, errors: [] });
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

  it('rejects Folder targets in the direct binding issue scope', () => {
    const result = validateDirectStyleBindings(
      [
        binding({
          targetKind: 'folder',
          targetNodeId: folderNodeId,
        }),
      ],
      resolver
    );

    expect(result.errors).toEqual([
      { code: 'STYLE_BINDING_UNSUPPORTED_TARGET_KIND', bindingId: 'binding-1' },
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
