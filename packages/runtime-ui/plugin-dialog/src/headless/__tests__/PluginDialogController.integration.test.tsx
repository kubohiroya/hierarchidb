import type React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { WorkerAPI } from '@hierarchidb/common-api';
import type { WorkerClientRef } from '@hierarchidb/runtime-worker-bootstrap';
import type { NodeId, TreeId } from '@hierarchidb/common-type';
import { HeadlessMultiStepDialog } from '@hierarchidb/ui-dialog';
import { usePluginDialogController } from '../usePluginDialogController.js';

vi.mock('@hierarchidb/runtime-worker-bootstrap', () => ({
  getWorkerClientHook: () => () => mockWorkerRef,
}));

let mockWorkerRef: WorkerClientRef | null;

const CHECKLIST = [
  'prefills working copy values into basic info form',
  'commits working copy, calls onSuccess, and closes the dialog',
];

function createMockWorker(options: {
  workingCopyId: NodeId;
  name?: string;
  description?: string;
  committedNodeId?: NodeId;
}) {
  const {
    workingCopyId,
    name = 'Existing Folder Name',
    description = 'Existing description',
    committedNodeId = 'node-committed' as NodeId,
  } = options;

  const workingCopy = {
    id: workingCopyId,
    name,
    description,
    data: {},
  };

  const commitSpy = vi.fn(async () => ({ success: true, node: { id: committedNodeId } }));

  const workingCopyAPI = {
    getWorkingCopy: vi.fn(async (id: NodeId) => (id === workingCopyId ? workingCopy : null)),
    createDraftWorkingCopy: vi.fn(async () => ({ id: 'draft-id', name: '', description: '', data: {} })),
    createWorkingCopyFromNode: vi.fn(async () => workingCopy),
    updateWorkingCopy: vi.fn(async () => {}),
    commitWorkingCopy: commitSpy,
    discardWorkingCopy: vi.fn(async () => {}),
  };

  const queryAPI = {
    getNode: vi.fn(async () => ({ id: workingCopyId, parentId: 'holder-parent' })),
  };

  const tagAPI = {
    getAllTags: vi.fn(async () => []),
    getTagsForNode: vi.fn(async () => []),
  };

  const worker: WorkerAPI = {
    getWorkingCopyAPI: async () => workingCopyAPI,
    getQueryAPI: async () => queryAPI,
    getTagAPI: async () => tagAPI,
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

  return { workerClient, workingCopyAPI, commitSpy };
}

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
};

const TestHarness: React.FC<HarnessProps> = (props) => {
  const controller = usePluginDialogController({ ...props, initialStep: 0 });
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
  let commitSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    workingCopyId = 'wc-folder-1' as NodeId;
    treeId = 'tree-1' as TreeId;
    pageNodeId = 'page-1' as NodeId;
    onSuccess = vi.fn();
    onClose = vi.fn();

    const mock = createMockWorker({ workingCopyId });
    mockWorkerRef = mock.workerClient;
    commitSpy = mock.commitSpy;
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    mockWorkerRef = null;
  });

  it('satisfies the folder dialog checklist', async () => {
    expect(CHECKLIST).toEqual([
      'prefills working copy values into basic info form',
      'commits working copy, calls onSuccess, and closes the dialog',
    ]);

    render(
      <MemoryRouter initialEntries={[`/t/tree-1/page-1/${workingCopyId}/folder/create`]}> 
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
        />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.queryByTestId('dialog-loading')).not.toBeInTheDocument());

    const nameInput = await screen.findByLabelText(/^Name/i);
    expect((nameInput as HTMLInputElement).value).toBe('Existing Folder Name');

    fireEvent.change(nameInput, { target: { value: 'Created Folder' } });

    const saveButton = await screen.findByRole('button', { name: 'Create' });
    await act(async () => {
      fireEvent.click(saveButton);
      await Promise.resolve();
    });

    expect(commitSpy).toHaveBeenCalledTimes(1);
    expect(commitSpy).toHaveBeenCalledWith(workingCopyId);
    expect(onSuccess).toHaveBeenCalledWith('node-committed');
    expect(onClose).toHaveBeenCalled();
  });
});
