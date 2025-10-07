import type React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';
import { useEffect } from 'react';
import type { WorkerAPI } from '@hierarchidb/common-api';
import type { WorkerClientRef } from '@hierarchidb/runtime-worker-bootstrap';
import type { MultiStepDialogState, NodeId, TreeId } from '@hierarchidb/common-types';
import { HeadlessMultiStepDialog } from '@hierarchidb/ui-dialog';
import { usePluginDialogController } from '../usePluginDialogController.js';

const navigateMock = vi.fn();
const locationRef = {
  pathname: '/t/tree-1/page-1/node/folder/create',
  searchStr: '',
  hash: '',
};

vi.mock('@tanstack/react-router', () => {
  const React = require('react');
  return {
    useNavigate: () => (options: unknown) => {
      navigateMock(options);
      return Promise.resolve();
    },
    useLocation: () => locationRef,
    Link: React.forwardRef<HTMLAnchorElement, any>(({ to, children, ...rest }, ref) => {
      const href = typeof to === 'string' ? to : (to?.to ?? '#');
      return React.createElement('a', { ref, href, ...rest }, children);
    }),
    useLoaderData: () => ({}),
    useSearch: () => ({}),
  };
});

vi.mock('@hierarchidb/runtime-worker-bootstrap', () => ({
  getWorkerClientHook: () => () => mockWorkerRef,
}));

let mockWorkerRef: WorkerClientRef | null;

const CHECKLIST = [
  'prefills working copy values into basic info form',
  'commits working copy, calls onSuccess, and closes the dialog',
];

type WorkingCopyStub = {
  id: NodeId;
  name?: string;
  description?: string;
  data?: Record<string, unknown>;
  parentId?: NodeId;
};

interface WorkerClientFactoryOptions {
  workingCopyId: NodeId;
  treeParentId?: NodeId;
  existingWorkingCopy?: Omit<WorkingCopyStub, 'id'>;
  draftWorkingCopy?: WorkingCopyStub;
  committedNodeId?: NodeId;
}

interface WorkerClientFactoryResult {
  workerClient: WorkerClientRef;
  workingCopyAPI: any;
  commitSpy: ReturnType<typeof vi.fn>;
  createDraftSpy: ReturnType<typeof vi.fn>;
  createFromNodeSpy: ReturnType<typeof vi.fn>;
  updateWorkingCopySpy: ReturnType<typeof vi.fn>;
  discardWorkingCopySpy: ReturnType<typeof vi.fn>;
  holderId: NodeId;
  committedNodeId: NodeId;
}

function normalizeWorkingCopy(stub: WorkingCopyStub, fallbackParentId: NodeId): WorkingCopyStub {
  return {
    id: stub.id,
    name: stub.name ?? '',
    description: stub.description ?? '',
    data: { ...(stub.data ?? {}) },
    parentId: stub.parentId ?? fallbackParentId,
  };
}

function createWorkerClient(options: WorkerClientFactoryOptions): WorkerClientFactoryResult {
  const {
    workingCopyId,
    treeParentId = 'tree-parent' as NodeId,
    existingWorkingCopy,
    draftWorkingCopy,
    committedNodeId = workingCopyId,
  } = options;

  const holderId = (draftWorkingCopy?.parentId ?? `${workingCopyId}-holder`) as NodeId;
  const holderNode = {
    id: holderId,
    holderType: 'workingCopy',
    holderTargetId: workingCopyId,
    parentId: treeParentId,
  } as Record<string, unknown>;

  const store = new Map<NodeId, WorkingCopyStub>();

  if (existingWorkingCopy) {
    const normalized = normalizeWorkingCopy({ id: workingCopyId, ...existingWorkingCopy }, holderId);
    store.set(workingCopyId, normalized);
  }

  const createDraftSpy = vi.fn(async (_nodeType: string, parentId: NodeId, _initial?: Record<string, unknown>) => {
    const draft = normalizeWorkingCopy(
      draftWorkingCopy ?? { id: workingCopyId, parentId: holderId },
      holderId,
    );
    // Ensure the draft belongs to the provided parent
    draft.parentId = draft.parentId ?? holderId;
    store.set(draft.id, draft);
    return { ...draft } as any;
  });

  const createFromNodeSpy = vi.fn(async (_id: NodeId) => {
    const fallback = normalizeWorkingCopy(
      { id: workingCopyId, ...(existingWorkingCopy ?? {}) },
      holderId,
    );
    store.set(workingCopyId, fallback);
    return { ...fallback } as any;
  });

  const getWorkingCopySpy = vi.fn(async (id: NodeId) => {
    const entry = store.get(id);
    return entry ? { ...entry } : null;
  });

  const updateWorkingCopySpy = vi.fn(async (id: NodeId, updates: Record<string, unknown>) => {
    const current = store.get(id) ?? normalizeWorkingCopy({ id }, holderId);
    const nextData = {
      ...(current.data ?? {}),
      ...(updates?.data as Record<string, unknown> | undefined ?? {}),
    };
    const next: WorkingCopyStub = {
      ...current,
      ...updates,
      data: nextData,
    };
    store.set(id, next);
    return { ...next } as any;
  });

  const commitSpy = vi.fn(async (nodeId: NodeId) => {
    const effectiveId = nodeId ?? workingCopyId;
    const committed = store.get(effectiveId) ?? normalizeWorkingCopy({ id: effectiveId }, holderId);
    const nodePayload = { ...committed, id: committedNodeId } as Record<string, unknown>;
    return { status: 'ok', nodeId: committedNodeId, node: nodePayload };
  });

  const discardWorkingCopySpy = vi.fn(async (id: NodeId) => {
    store.delete(id);
  });

  const workingCopyAPI = {
    getWorkingCopy: getWorkingCopySpy,
    createDraftWorkingCopy: createDraftSpy,
    createWorkingCopyFromNode: createFromNodeSpy,
    updateWorkingCopy: updateWorkingCopySpy,
    commitWorkingCopy: commitSpy,
    discardWorkingCopy: discardWorkingCopySpy,
  };

  const queryAPI = {
    getNode: vi.fn(async (id: NodeId) => {
      if (store.has(id)) {
        return { ...store.get(id)! };
      }
      if (id === holderId) {
        return { ...holderNode };
      }
      if (id === treeParentId) {
        return { id: treeParentId };
      }
      return null;
    }),
  };

  const tagAPI = {
    getAllTags: vi.fn(async () => []),
    getTagsForNode: vi.fn(async () => []),
  };

  const dialogStateAPI = {
    publishState: vi.fn(async () => {}),
    getState: vi.fn(async () => null),
    subscribeState: vi.fn(async (_input: unknown, callback: (state: MultiStepDialogState | null) => void) => {
      callback(null);
      return 'dialog-sub-1';
    }),
    unsubscribeState: vi.fn(async () => {}),
  };

  const worker: WorkerAPI = {
    getWorkingCopyAPI: async () => workingCopyAPI as any,
    getQueryAPI: async () => queryAPI as any,
    getTagAPI: async () => tagAPI as any,
    getDialogStateAPI: async () => dialogStateAPI as any,
  } as unknown as WorkerAPI;

  const workerClient: WorkerClientRef = {
    client: worker,
    isInitialized: true,
    isConnected: true,
    initProgress: 100,
    initMessage: 'ready',
    error: null,
    initialize: async () => {},
    reset: () => {},
    getAPI: () => worker,
  };

  return {
    workerClient,
    workingCopyAPI,
    commitSpy,
    createDraftSpy,
    createFromNodeSpy,
    updateWorkingCopySpy,
    discardWorkingCopySpy,
    holderId,
    committedNodeId,
  } satisfies WorkerClientFactoryResult;
}

type ControllerState = ReturnType<typeof usePluginDialogController>;

type HarnessProps = {
  intent: 'create' | 'edit';
  mode: 'create' | 'edit';
  nodeType: string;
  nodeId: NodeId;
  pageNodeId: NodeId;
  treeId: TreeId;
  open: boolean;
  onClose: () => void;
  onSuccess: (nodeId: NodeId) => void;
  onController?: (controller: ControllerState) => void;
};

const TestHarness: React.FC<HarnessProps> = (props) => {
  const { onController, ...rest } = props;
  const controller = usePluginDialogController({ ...rest, initialStep: 0 });
  useEffect(() => {
    onController?.(controller);
  }, [controller, onController]);
  if (controller.loading) {
    return <div data-testid="dialog-loading" />;
  }
  return <HeadlessMultiStepDialog {...controller.headlessProps} />;
};

describe('usePluginDialogController – folder create integration', () => {
  let workingCopyId: NodeId;
  let treeId: TreeId;
  let pageNodeId: NodeId;
  let onSuccess: ReturnType<typeof vi.fn>;
  let onClose: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    workingCopyId = 'wc-folder-1' as NodeId;
    treeId = 'tree-1' as TreeId;
    pageNodeId = 'page-1' as NodeId;
    onSuccess = vi.fn();
    onClose = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    mockWorkerRef = null;
    navigateMock.mockClear();
  });

  it('satisfies the folder dialog checklist', async () => {
    expect(CHECKLIST).toEqual([
      'prefills working copy values into basic info form',
      'commits working copy, calls onSuccess, and closes the dialog',
    ]);

    const mock = createWorkerClient({
      workingCopyId,
      treeParentId: pageNodeId,
      existingWorkingCopy: {
        name: 'Existing Folder Name',
        description: 'Existing description',
      },
      committedNodeId: 'node-committed' as NodeId,
    });
    mockWorkerRef = mock.workerClient;

    locationRef.pathname = `/t/${treeId}/${pageNodeId}/${workingCopyId}/folder/create`;
    locationRef.searchStr = '';
    locationRef.hash = '';

    let controllerRef: ControllerState | null = null;

    render(
      <TestHarness
        intent="create"
        mode="create"
        nodeType="folder"
        nodeId={workingCopyId}
        pageNodeId={pageNodeId}
        treeId={treeId}
        open
        onClose={onClose}
        onSuccess={onSuccess}
        onController={(controller) => {
          controllerRef = controller;
        }}
      />,
    );

    await waitFor(() => expect(screen.queryByTestId('dialog-loading')).not.toBeInTheDocument());
    await waitFor(() => controllerRef !== null);

    const nameInput = await screen.findByLabelText(/^Name/i);
    expect((nameInput as HTMLInputElement).value).toBe('Existing Folder Name');

    fireEvent.change(nameInput, { target: { value: 'Created Folder' } });
    await act(async () => {
      await controllerRef?.headlessProps.onRequestCommit?.();
    });

    await waitFor(() => expect(mock.commitSpy).toHaveBeenCalledWith(workingCopyId));
    expect(mock.updateWorkingCopySpy).toHaveBeenCalledWith(
      workingCopyId,
      expect.objectContaining({ name: 'Created Folder' }),
    );
    const discardTargets = mock.discardWorkingCopySpy.mock.calls.map(([id]) => id);
    expect(discardTargets.some((id) => id === mock.committedNodeId || id === workingCopyId)).toBe(true);

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith('node-committed'));
    expect(onClose).toHaveBeenCalled();
  });

  it('creates a draft working copy with default values for SpeedDial create flow', async () => {
    const mock = createWorkerClient({
      workingCopyId,
      treeParentId: pageNodeId,
      draftWorkingCopy: {
        id: workingCopyId,
        name: '',
        description: '',
        data: {},
        parentId: `${workingCopyId}-holder` as NodeId,
      },
      committedNodeId: 'node-created' as NodeId,
    });
    mockWorkerRef = mock.workerClient;

    locationRef.pathname = `/t/${treeId}/${pageNodeId}/${workingCopyId}/folder/create`;
    locationRef.searchStr = '';
    locationRef.hash = '';

    let controllerRef: ControllerState | null = null;

    render(
      <TestHarness
        intent="create"
        mode="create"
        nodeType="folder"
        nodeId={workingCopyId}
        pageNodeId={pageNodeId}
        treeId={treeId}
        open
        onClose={onClose}
        onSuccess={onSuccess}
        onController={(controller) => {
          controllerRef = controller;
        }}
      />,
    );

    await waitFor(() => expect(screen.queryByTestId('dialog-loading')).not.toBeInTheDocument());
    await waitFor(() => controllerRef !== null);

    expect(mock.createDraftSpy).toHaveBeenCalledWith('folder', pageNodeId, { name: '' });

    const nameInput = await screen.findByLabelText(/^Name/i);
    expect((nameInput as HTMLInputElement).value).toBe('');

    fireEvent.change(nameInput, { target: { value: 'Folder via SpeedDial' } });
    await act(async () => {
      await controllerRef?.headlessProps.onRequestCommit?.();
    });

    await waitFor(() => expect(mock.commitSpy).toHaveBeenCalledWith(workingCopyId));
    expect(mock.updateWorkingCopySpy).toHaveBeenCalledWith(
      workingCopyId,
      expect.objectContaining({ name: 'Folder via SpeedDial' }),
    );
    const discardTargets = mock.discardWorkingCopySpy.mock.calls.map(([id]) => id);
    expect(discardTargets.some((id) => id === mock.committedNodeId || id === workingCopyId)).toBe(true);

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith('node-created'));
    expect(onClose).toHaveBeenCalled();
  });

  it('creates an edit working copy seeded from the existing node via context menu flow', async () => {
    const existingName = 'Marketing Assets';
    const existingDescription = 'FY2025 plan';

    const mock = createWorkerClient({
      workingCopyId,
      treeParentId: pageNodeId,
      existingWorkingCopy: {
        name: existingName,
        description: existingDescription,
        data: { category: 'marketing' },
      },
      committedNodeId: workingCopyId,
    });
    mockWorkerRef = mock.workerClient;

    locationRef.pathname = `/t/${treeId}/${pageNodeId}/${workingCopyId}/folder/edit`;
    locationRef.searchStr = '';
    locationRef.hash = '';

    let controllerRef: ControllerState | null = null;

    render(
      <TestHarness
        intent="edit"
        mode="edit"
        nodeType="folder"
        nodeId={workingCopyId}
        pageNodeId={pageNodeId}
        treeId={treeId}
        open
        onClose={onClose}
        onSuccess={onSuccess}
        onController={(controller) => {
          controllerRef = controller;
        }}
      />,
    );

    await waitFor(() => expect(screen.queryByTestId('dialog-loading')).not.toBeInTheDocument());
    await waitFor(() => controllerRef !== null);

    expect(mock.createFromNodeSpy).toHaveBeenCalledWith(workingCopyId);

    const nameInput = await screen.findByLabelText(/^Name/i);
    expect((nameInput as HTMLInputElement).value).toBe(existingName);

    const descriptionInput = await screen.findByLabelText(/^Description/i);
    expect((descriptionInput as HTMLTextAreaElement).value).toBe(existingDescription);

    fireEvent.change(nameInput, { target: { value: 'Marketing Assets (updated)' } });
    fireEvent.change(descriptionInput, { target: { value: 'FY2026 plan' } });

    await act(async () => {
      await controllerRef?.headlessProps.onRequestCommit?.();
    });

    await waitFor(() => expect(mock.commitSpy).toHaveBeenCalledWith(workingCopyId));
    expect(mock.updateWorkingCopySpy).toHaveBeenCalledWith(
      workingCopyId,
      expect.objectContaining({ name: 'Marketing Assets (updated)' }),
    );
    const discardTargets = mock.discardWorkingCopySpy.mock.calls.map(([id]) => id);
    expect(discardTargets.some((id) => id === mock.committedNodeId || id === workingCopyId)).toBe(true);

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(workingCopyId));
    expect(onClose).toHaveBeenCalled();
  });
});
