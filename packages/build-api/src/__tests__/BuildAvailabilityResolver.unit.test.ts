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
    expect(availability.details).toContainEqual(
      expect.objectContaining({ kind: 'metadata-build-required', nodeId: candidate.id })
    );
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
    expect(availability.details).toContainEqual(
      expect.objectContaining({ kind: 'active-build-session', nodeId: candidate.id })
    );
  });

  it('returns build-required when a stale artifact names a rebuild target', () => {
    const candidate = node('shape-1', 'shape', false);

    const availability = resolveBuildAvailability({
      candidates: [candidate],
      dependencySummary: {
        edgeCounts: { stale: 1 },
        rebuildRequiredTargetIds: [candidate.id],
      },
    });

    expect(availability.status).toBe('build-required');
    expect(availability.reason).toBe('stale-artifact');
    expect(availability.canStartBuild).toBe(true);
    expect(availability.requiredTargets).toEqual([candidate]);
    expect(availability.details).toContainEqual(
      expect.objectContaining({ kind: 'stale-artifact', status: 'stale', nodeId: candidate.id })
    );
  });

  it('fails fast when stale dependency state does not name a rebuild target', () => {
    const candidate = node('shape-1', 'shape', false);

    expect(() =>
      resolveBuildAvailability({
        candidates: [candidate],
        dependencySummary: {
          edgeCounts: { stale: 1 },
        },
      })
    ).toThrow('dependencySummary.rebuildRequiredTargetIds');
  });

  it('fails fast when dependency rebuild target is not a candidate', () => {
    const candidate = node('shape-1', 'shape', false);

    expect(() =>
      resolveBuildAvailability({
        candidates: [candidate],
        dependencySummary: {
          edgeCounts: { stale: 1 },
          rebuildRequiredTargetIds: ['location-1' as NodeId],
        },
      })
    ).toThrow('not in candidates');
  });

  it('fails fast when stale rebuild targets are reported without stale edge counts', () => {
    const candidate = node('shape-1', 'shape', false);

    expect(() =>
      resolveBuildAvailability({
        candidates: [candidate],
        dependencySummary: {
          rebuildRequiredTargetIds: [candidate.id],
        },
      })
    ).toThrow('dependencySummary.edgeCounts.stale');
  });

  it('fails fast when rebuilding targets are reported without rebuilding edge counts', () => {
    const candidate = node('shape-1', 'shape', false);

    expect(() =>
      resolveBuildAvailability({
        candidates: [candidate],
        dependencySummary: {
          rebuildingTargetIds: [candidate.id],
        },
      })
    ).toThrow('dependencySummary.edgeCounts.rebuilding');
  });

  it('returns not-buildable for plugin prerequisite failures', () => {
    const candidate = node('shape-1', 'shape', true);

    const availability = resolveBuildAvailability({
      candidates: [candidate],
      pluginPrerequisiteFailures: [
        {
          code: 'PLUGIN_AUTH_REQUIRED',
          message: 'Plugin auth is required before build can start.',
          pluginId: 'shape',
        },
      ],
    });

    expect(availability.status).toBe('not-buildable');
    expect(availability.reason).toBe('plugin-prerequisite-failed');
    expect(availability.canStartBuild).toBe(false);
    expect(availability.requiredTargets).toEqual([]);
    expect(availability.details).toContainEqual(
      expect.objectContaining({ kind: 'plugin-prerequisite-failed', pluginId: 'shape' })
    );
  });

  it('returns not-buildable for orphaned dependency edges', () => {
    const candidate = node('shape-1', 'shape', true);

    const availability = resolveBuildAvailability({
      candidates: [candidate],
      dependencySummary: {
        edgeCounts: { orphaned: 1 },
      },
    });

    expect(availability.status).toBe('not-buildable');
    expect(availability.reason).toBe('orphaned-dependency-edge');
    expect(availability.canStartBuild).toBe(false);
    expect(availability.details).toContainEqual(
      expect.objectContaining({ kind: 'orphaned-dependency-edge', status: 'orphaned' })
    );
  });

  it('returns not-buildable for schema errors without downgrading to build-not-required', () => {
    const candidate = node('shape-1', 'shape', false);

    const availability = resolveBuildAvailability({
      candidates: [candidate],
      dependencySummary: {
        edgeCounts: { active: 1 },
        schemaErrors: [
          {
            code: 'DEPENDENCY_SCHEMA_INVALID',
            message: 'Dependency schema is invalid.',
            nodeId: candidate.id,
          },
        ],
      },
    });

    expect(availability.status).toBe('not-buildable');
    expect(availability.reason).toBe('schema-error');
    expect(availability.canStartBuild).toBe(false);
    expect(availability.requiredTargets).toEqual([]);
    expect(availability.details).toContainEqual(
      expect.objectContaining({ kind: 'schema-error', nodeId: candidate.id })
    );
  });

  it('returns not-buildable for unsupported plugin participants', () => {
    const candidate = node('route-1', 'route', true);

    const availability = resolveBuildAvailability({
      candidates: [candidate],
      dependencySummary: {
        unsupportedPluginParticipants: [
          {
            code: 'DEPENDENCY_PARTICIPANT_UNSUPPORTED',
            message: 'The route plugin cannot participate in this dependency edge.',
            pluginId: 'route',
          },
        ],
      },
    });

    expect(availability.status).toBe('not-buildable');
    expect(availability.reason).toBe('unsupported-plugin-participant');
    expect(availability.canStartBuild).toBe(false);
    expect(availability.requiredTargets).toEqual([]);
    expect(availability.details).toContainEqual(
      expect.objectContaining({ kind: 'unsupported-plugin-participant', pluginId: 'route' })
    );
  });

  it('fails fast when dependency edge counts are invalid', () => {
    const candidate = node('shape-1', 'shape', false);

    expect(() =>
      resolveBuildAvailability({
        candidates: [candidate],
        dependencySummary: {
          edgeCounts: { stale: -1 },
        },
      })
    ).toThrow('dependencySummary.edgeCounts.stale');
  });

  it('fails fast when diagnostic records do not expose a code', () => {
    const candidate = node('shape-1', 'shape', false);

    expect(() =>
      resolveBuildAvailability({
        candidates: [candidate],
        pluginPrerequisiteFailures: [
          {
            code: '',
            message: 'Plugin auth is required before build can start.',
          },
        ],
      })
    ).toThrow('pluginPrerequisiteFailures[0].code');
  });

  it('fails fast when diagnostic records do not expose string fields', () => {
    const candidate = node('shape-1', 'shape', false);

    expect(() =>
      resolveBuildAvailability({
        candidates: [candidate],
        pluginPrerequisiteFailures: [
          {
            code: null,
            message: 'Plugin auth is required before build can start.',
          } as never,
        ],
      })
    ).toThrow('pluginPrerequisiteFailures[0].code must be a string');

    expect(() =>
      resolveBuildAvailability({
        candidates: [candidate],
        pluginPrerequisiteFailures: [
          {
            code: 'PLUGIN_AUTH_REQUIRED',
            message: null,
          } as never,
        ],
      })
    ).toThrow('pluginPrerequisiteFailures[0].message must be a string');
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
