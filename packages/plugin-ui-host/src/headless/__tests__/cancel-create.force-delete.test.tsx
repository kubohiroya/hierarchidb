import type { NodeId, TreeId } from '@hierarchidb/core-types';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePluginDialogController } from '../usePluginDialogController';

const discardDraft = vi.fn();

vi.mock('@hierarchidb/plugin-ui-sdk', async () => {
  const actual = await vi.importActual('@hierarchidb/plugin-ui-sdk');
  return {
    ...actual,
    useTreeNodeUpdater: vi.fn(() => ({
      treeNodeUpdater: {
        treeNodeId: 'draft-1',
        draftMetadata: null,
        draftData: {},
        isTemporary: true,
      },
      hasUnsavedChanges: true,
      updateTreeNodeUpdater: vi.fn(),
      commitTreeNodeUpdater: vi.fn(),
      discardDraft,
      loading: false,
      error: null,
    })),
  };
});

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/t/1/parent/draft', searchStr: '', hash: '' }),
}));

vi.mock('@hierarchidb/ui-worker-provider', () => ({
  getWorkerClientHook: () => () => null,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('usePluginDialogController cancel (create mode)', () => {
  beforeEach(() => {
    discardDraft.mockClear();
  });

  it('requests forceDelete when cancelling create dialog', async () => {
    const onClose = vi.fn();
    const { result } = renderHook(() =>
      usePluginDialogController({
        mode: 'create',
        nodeType: 'folder',
        nodeId: 'n:1' as NodeId,
        pageNodeId: 'p:1' as NodeId,
        treeId: 't:1' as TreeId,
        open: true,
        onClose,
      })
    );

    act(() => {
      result.current.headlessProps.onRequestClose?.();
    });

    await Promise.resolve();

    expect(discardDraft).toHaveBeenCalledWith({ forceDelete: true });
    expect(onClose).toHaveBeenCalled();
  });
});
