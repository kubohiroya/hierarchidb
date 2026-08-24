import { describe, expect, it } from 'vitest';
import { resolveBreadcrumbContextMenuBuildState } from '../TreeConsoleBreadcrumb';

describe('resolveBreadcrumbContextMenuBuildState', () => {
  it('allows a folder build when a descendant build target requires a rebuild', () => {
    const state = resolveBreadcrumbContextMenuBuildState(
      {
        id: 'folder-1',
        nodeType: 'folder-plugin',
      },
      undefined,
      [
        {
          id: 'shape-1',
          nodeType: 'shape',
          metadata: {
            buildMetadata: {
              buildRequired: true,
            },
          },
        },
      ]
    );

    expect(state).toEqual({
      buildRequired: true,
      canBuild: true,
    });
  });

  it('blocks a folder build when a required descendant already has an active build session', () => {
    const state = resolveBreadcrumbContextMenuBuildState(
      {
        id: 'folder-1',
        nodeType: 'folder-plugin',
      },
      new Set(['shape-1']),
      [
        {
          id: 'shape-1',
          nodeType: 'shape',
          metadata: {
            buildMetadata: {
              buildRequired: true,
            },
          },
        },
      ]
    );

    expect(state).toEqual({
      buildRequired: true,
      canBuild: false,
    });
  });

  it('supports breadcrumb nodes that only provide treeNodeId', () => {
    const state = resolveBreadcrumbContextMenuBuildState(
      {
        treeNodeId: 'folder-1',
        nodeType: 'folder-plugin',
      },
      new Set(['shape-1']),
      [
        {
          treeNodeId: 'shape-1',
          nodeType: 'shape',
          draftMetadata: {
            buildMetadata: {
              buildRequired: true,
            },
          },
        },
      ]
    );

    expect(state).toEqual({
      buildRequired: true,
      canBuild: false,
    });
  });
});
