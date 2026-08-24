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
      buildAvailabilitySummary: 'Build required',
      buildAvailabilityTooltip:
        'Build ready\nThe node metadata marks this build target as requiring a build. (shape-1)',
      buildDiagnosticsLabel: undefined,
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
      buildAvailabilitySummary: 'Build already running',
      buildAvailabilityTooltip:
        'Build blocked\nThe node metadata marks this build target as requiring a build. (shape-1)\nA build session is already queued or running for this target. (shape-1)',
      buildDiagnosticsLabel: undefined,
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
      buildAvailabilitySummary: 'Build already running',
      buildAvailabilityTooltip:
        'Build blocked\nThe node metadata marks this build target as requiring a build. (shape-1)\nA build session is already queued or running for this target. (shape-1)',
      buildDiagnosticsLabel: undefined,
    });
  });

  it('distinguishes a buildable target with no required rebuild', () => {
    const state = resolveBreadcrumbContextMenuBuildState({
      id: 'shape-1',
      nodeType: 'shape',
      metadata: {
        buildMetadata: {
          buildRequired: false,
        },
      },
    });

    expect(state).toEqual({
      buildRequired: false,
      canBuild: false,
      buildAvailabilitySummary: 'Up to date',
      buildAvailabilityTooltip:
        'Build not required\nBuild candidates exist, but none requires a build.',
      buildDiagnosticsLabel: undefined,
    });
  });

  it('distinguishes a non-buildable target from an up-to-date target', () => {
    const state = resolveBreadcrumbContextMenuBuildState({
      id: 'folder-1',
      nodeType: 'folder-plugin',
    });

    expect(state).toEqual({
      buildRequired: false,
      canBuild: false,
      buildAvailabilitySummary: 'No build target',
      buildAvailabilityTooltip:
        'Build unavailable\nNo candidate node exposes a canonical build API.',
      buildDiagnosticsLabel: 'Build diagnostics',
    });
  });
});
