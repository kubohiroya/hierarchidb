import type { NodeId } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import { describe, expect, it } from 'vitest';
import {
  resolveTreeNodeInfoPanelBuildAvailabilityView,
  shouldShowTreeNodeInfoPanelBuildButton,
} from '../treeNodeInfoPanelBuildAvailabilityView.ts';

const makeNode = (overrides: Partial<TreeNode>): TreeNode => ({
  id: 'r:node' as NodeId,
  parentId: 'r:root' as NodeId,
  nodeType: 'folder',
  metadata: { name: 'Node', description: '', tags: [] },
  draftMetadata: null,
  data: null,
  draftData: undefined,
  depth: 1,
  createdAt: 1,
  updatedAt: 2,
  version: 1,
  visible: true,
  ...overrides,
});

describe('resolveTreeNodeInfoPanelBuildAvailabilityView', () => {
  it('returns a folder no-target reason and diagnostics when no descendant can build', () => {
    const currentNode = makeNode({
      id: 'r:folder' as NodeId,
      nodeType: 'folder-plugin',
    });

    const view = resolveTreeNodeInfoPanelBuildAvailabilityView({
      currentNode,
      folderDescendantNodes: [
        makeNode({
          id: 'r:folder-note' as NodeId,
          parentId: 'r:folder' as NodeId,
          nodeType: 'folder-plugin',
        }),
      ],
      buildTargetLoading: false,
    });

    expect(view?.summary).toBe('No build target');
    expect(view?.tooltip).toContain('No candidate node exposes a canonical build API.');
    expect(view?.diagnosticsLabel).toBe('Build diagnostics');
    expect(
      shouldShowTreeNodeInfoPanelBuildButton({
        currentNode,
        isBuildable: false,
        buildAvailabilityView: view,
      })
    ).toBe(true);
  });

  it('returns a folder up-to-date reason when descendants can build but no rebuild is required', () => {
    const currentNode = makeNode({
      id: 'r:folder' as NodeId,
      nodeType: 'folder',
    });

    const view = resolveTreeNodeInfoPanelBuildAvailabilityView({
      currentNode,
      folderDescendantNodes: [
        makeNode({
          id: 'r:shape' as NodeId,
          parentId: 'r:folder' as NodeId,
          nodeType: 'shape',
        }),
      ],
      buildTargetLoading: false,
    });

    expect(view?.summary).toBe('Up to date');
    expect(view?.diagnosticsLabel).toBeUndefined();
    expect(
      shouldShowTreeNodeInfoPanelBuildButton({
        currentNode,
        isBuildable: false,
        buildAvailabilityView: view,
      })
    ).toBe(true);
  });

  it('uses dependency availability diagnostics instead of treating the target as up to date', () => {
    const currentNode = makeNode({
      id: 'r:shape' as NodeId,
      nodeType: 'shape',
    });

    const view = resolveTreeNodeInfoPanelBuildAvailabilityView({
      currentNode,
      folderDescendantNodes: [],
      buildTargetLoading: false,
      dependencySummary: {
        edgeCounts: { active: 1 },
        dependencyErrors: [
          {
            code: 'DEPENDENCY_RELATION_UNRESOLVED',
            message: 'A hard dependency relation is unresolved.',
            nodeId: currentNode.id,
          },
        ],
      },
    });

    expect(view?.summary).toBe('Dependency error');
    expect(view?.tooltip).toContain('A hard dependency relation is unresolved. (r:shape)');
    expect(view?.diagnosticsLabel).toBe('Build diagnostics');
  });

  it('surfaces plugin prerequisite failures instead of allowing a metadata rebuild', () => {
    const currentNode = makeNode({
      id: 'r:route' as NodeId,
      nodeType: 'route',
      metadata: { buildMetadata: { buildRequired: true } },
    });

    const view = resolveTreeNodeInfoPanelBuildAvailabilityView({
      currentNode,
      folderDescendantNodes: [],
      buildTargetLoading: false,
      pluginPrerequisiteFailures: [
        {
          code: 'PLUGIN_AUTH_REQUIRED',
          message: 'Route plugin authentication is required.',
          pluginId: 'route',
        },
      ],
    });

    expect(view?.summary).toBe('Plugin prerequisite failed');
    expect(view?.tooltip).toContain('Route plugin authentication is required.');
    expect(view?.diagnosticsLabel).toBe('Build diagnostics');
  });

  it('surfaces unsupported participants as diagnostics for dialog summary boundaries', () => {
    const currentNode = makeNode({
      id: 'r:route' as NodeId,
      nodeType: 'route',
    });

    const view = resolveTreeNodeInfoPanelBuildAvailabilityView({
      currentNode,
      folderDescendantNodes: [],
      buildTargetLoading: false,
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

    expect(view?.summary).toBe('Unsupported participant');
    expect(view?.tooltip).toContain('The route plugin cannot participate in this dependency edge.');
    expect(view?.diagnosticsLabel).toBe('Build diagnostics');
  });

  it('keeps non-build node types out of the info panel build action surface', () => {
    const view = resolveTreeNodeInfoPanelBuildAvailabilityView({
      currentNode: makeNode({
        id: 'r:folder-note' as NodeId,
        nodeType: 'folder-plugin',
      }),
      folderDescendantNodes: [],
      buildTargetLoading: false,
    });

    expect(
      shouldShowTreeNodeInfoPanelBuildButton({
        currentNode: makeNode({
          id: 'r:location' as NodeId,
          nodeType: 'location',
        }),
        isBuildable: false,
        buildAvailabilityView: view,
      })
    ).toBe(false);
  });
});
