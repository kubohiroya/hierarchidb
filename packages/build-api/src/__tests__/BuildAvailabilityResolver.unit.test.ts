import type { NodeId, NodeType } from '@hierarchidb/core-types';
import { describe, expect, it } from 'vitest';
import {
  type BuildAvailabilityNode,
  isNodeBuildRequired,
  resolveBuildAvailability,
  resolveSubtreeBuildAvailability,
} from '../BuildAvailabilityResolver.js';

const node = (id: string, nodeType: string, buildRequired?: boolean): BuildAvailabilityNode => ({
  id: id as NodeId,
  nodeType: nodeType as NodeType,
  metadata: buildRequired === undefined ? undefined : { buildMetadata: { buildRequired } },
});

describe('BuildAvailabilityResolver', () => {
  it('detects committed and draft build-required metadata', () => {
    expect(isNodeBuildRequired(node('shape-1', 'shape', true))).toBe(true);
    expect(
      isNodeBuildRequired({
        id: 'shape-2' as NodeId,
        nodeType: 'shape' as NodeType,
        draftMetadata: { buildMetadata: { buildRequired: true } },
      })
    ).toBe(true);
    expect(isNodeBuildRequired(node('shape-3', 'shape', false))).toBe(false);
  });

  it('returns not-buildable when no candidate has canonical build support', () => {
    const availability = resolveBuildAvailability({ candidates: [] });

    expect(availability.status).toBe('not-buildable');
    expect(availability.canStartBuild).toBe(false);
  });

  it('returns build-not-required when candidates exist without required work', () => {
    const candidate = node('shape-1', 'shape', false);

    const availability = resolveBuildAvailability({ candidates: [candidate] });

    expect(availability.status).toBe('build-not-required');
    expect(availability.requiredTargets).toEqual([]);
  });

  it('returns build-required when a required target has no active session', () => {
    const candidate = node('shape-1', 'shape', true);

    const availability = resolveBuildAvailability({ candidates: [candidate] });

    expect(availability.status).toBe('build-required');
    expect(availability.canStartBuild).toBe(true);
    expect(availability.requiredTargets).toEqual([candidate]);
  });

  it('blocks starting a duplicate build when a required target already has an active session', () => {
    const candidate = node('shape-1', 'shape', true);

    const availability = resolveBuildAvailability({
      candidates: [candidate],
      activeNodeIds: new Set<NodeId>(['shape-1' as NodeId]),
    });

    expect(availability.status).toBe('build-blocked-by-active-session');
    expect(availability.canStartBuild).toBe(false);
    expect(availability.blockedTargets).toEqual([candidate]);
  });

  it('uses the root as the only candidate when the root node type is buildable', () => {
    const root = node('shape-root', 'shape', true);
    const descendant = node('shape-child', 'shape', true);

    const availability = resolveSubtreeBuildAvailability({
      root,
      descendants: [descendant],
      canBuildNodeType: (nodeType) => nodeType === 'shape',
    });

    expect(availability.candidates).toEqual([root]);
    expect(availability.requiredTargets).toEqual([root]);
  });

  it('uses buildable descendants when the root node type is not buildable', () => {
    const root = node('folder-1', 'folder');
    const shape = node('shape-1', 'shape', true);
    const folder = node('folder-2', 'folder', true);

    const availability = resolveSubtreeBuildAvailability({
      root,
      descendants: [shape, folder],
      canBuildNodeType: (nodeType) => nodeType === 'shape',
    });

    expect(availability.candidates).toEqual([shape]);
    expect(availability.requiredTargets).toEqual([shape]);
  });
});
