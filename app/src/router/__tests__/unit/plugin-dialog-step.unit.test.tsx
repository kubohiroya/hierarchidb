/// <reference types="vitest/globals" />
import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NodeAction } from '@hierarchidb/tree-api';
import type { NodeId, NodeType, TreeId } from '@hierarchidb/core-types';
import type { Tree } from '@hierarchidb/tree-api';
import type { BuildWorkerAPI } from '../../../types/worker-api.ts';
import type { Remote } from 'comlink';
import { treeRouteIds } from '../../routes/tree/shared.ts';
import { usePluginDialogRoute } from '../../routes/tree/usePluginDialogRoute.ts';

const mockNavigate = vi.fn();
let mockLocation = { pathname: '/t/r/root', searchStr: '', hash: '' };
let mockMatches: Array<{ routeId: string; params: Record<string, string> }> = [];

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocation,
  useRouterState: ({ select }: { select: (state: { matches: typeof mockMatches }) => unknown }) =>
    select({ matches: mockMatches }),
}));

vi.mock('@hierarchidb/util', () => ({
  loadTreeConsoleSettings: () => ({ dialogBackdropDismissEnabled: false }),
  TREE_CONSOLE_SETTINGS_STORAGE_KEY: 'treeConsoleSettings',
}));

vi.mock('../../pages/tree/console/buildQueue.ts', () => ({
  shiftBuildQueue: vi.fn(),
}));

type HookResult = {
  currentStep: number;
  urlDisplayMode: 'normal' | 'maximize' | 'full-screen';
  handleUrlStateChange: (next: { mode: 'normal' | 'maximize' | 'full-screen'; step: number }) => void;
};

const HookHarness = ({
  data,
  onResult,
}: {
  data: Parameters<typeof usePluginDialogRoute>[0];
  onResult: (value: HookResult) => void;
}) => {
  const value = usePluginDialogRoute(data) as HookResult;
  onResult(value);
  return null;
};

afterEach(() => {
  mockNavigate.mockReset();
  mockLocation = { pathname: '/t/r/root', searchStr: '', hash: '' };
  mockMatches = [];
});

describe('usePluginDialogRoute step params', () => {
  it('prefers dialog route params for step and mode', () => {
    mockMatches = [
      {
        routeId: treeRouteIds.dialogModeStep,
        params: {
          treeId: 'r',
          pageNodeId: 'r:root',
          targetNodeId: 'node-1',
          nodeType: 'shape',
          action: 'edit',
          mode: 'normal',
          step: '5',
        },
      },
    ];

    const treeId = 'r' as TreeId;
    const pageNodeId = 'r:root' as NodeId;
    const targetNodeId = 'node-1' as NodeId;
    const data = {
      client: {} as Remote<BuildWorkerAPI>,
      tree: { id: treeId } as Tree,
      pageNodeId,
      pageNode: undefined,
      targetNodeId,
      targetNode: undefined,
      nodeType: 'shape' as NodeType,
      action: NodeAction.UPDATE,
      params: {
        treeId: 'r',
        pageNodeId: 'r:root',
        targetNodeId: 'node-1',
        nodeType: 'shape',
        action: 'edit',
        mode: 'normal',
        step: '1',
      },
    } satisfies Parameters<typeof usePluginDialogRoute>[0];

    let result: HookResult | null = null;
    render(<HookHarness data={data} onResult={(value) => (result = value)} />);

    const snapshot = result as HookResult | null;
    expect(snapshot?.currentStep).toBe(5);
    expect(snapshot?.urlDisplayMode).toBe('normal');
  });

  it('writes step to the dialog route', () => {
    mockMatches = [
      {
        routeId: treeRouteIds.dialogModeStep,
        params: {
          treeId: 'r',
          pageNodeId: 'r:root',
          targetNodeId: 'node-1',
          nodeType: 'shape',
          action: 'edit',
          mode: 'normal',
          step: '2',
        },
      },
    ];
    mockLocation = {
      pathname: '/t/r/r:root/node-1/shape/edit/normal/2',
      searchStr: '',
      hash: '#/t/r/r:root/node-1/shape/edit/normal/2',
    };

    const treeId = 'r' as TreeId;
    const pageNodeId = 'r:root' as NodeId;
    const targetNodeId = 'node-1' as NodeId;
    const data = {
      client: {} as Remote<BuildWorkerAPI>,
      tree: { id: treeId } as Tree,
      pageNodeId,
      pageNode: undefined,
      targetNodeId,
      targetNode: undefined,
      nodeType: 'shape' as NodeType,
      action: NodeAction.UPDATE,
      params: {
        treeId: 'r',
        pageNodeId: 'r:root',
        targetNodeId: 'node-1',
        nodeType: 'shape',
        action: 'edit',
        mode: 'normal',
        step: '2',
      },
    } satisfies Parameters<typeof usePluginDialogRoute>[0];

    let result: HookResult | null = null;
    render(<HookHarness data={data} onResult={(value) => (result = value)} />);

    const snapshot = result as HookResult | null;
    snapshot?.handleUrlStateChange({ mode: 'normal', step: 5 });

    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/t/$treeId/$pageNodeId/$targetNodeId/$nodeType/$action/$mode/$step',
      params: {
        treeId: 'r',
        pageNodeId: 'r:root',
        targetNodeId: 'node-1',
        nodeType: 'shape',
        action: 'edit',
        mode: 'normal',
        step: '5',
      },
      replace: true,
    });
  });
});
