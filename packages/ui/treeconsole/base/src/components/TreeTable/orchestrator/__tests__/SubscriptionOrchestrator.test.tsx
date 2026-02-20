import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { WorkerAPI } from '@hierarchidb/worker-api';
import type { TreeNode } from '@hierarchidb/tree-api';
import { Provider, useAtomValue, useSetAtom } from 'jotai';
import { type FC, useEffect, type PropsWithChildren, type ReactElement } from 'react';
import { useSubscriptionOrchestrator } from '~/components/TreeTable/orchestrator/SubscriptionOrchestrator';
import { tableDataAtom } from '~/components/TreeTable/state/index';

vi.mock('comlink', () => ({
  proxy: <T,>(value: T) => value,
}));

const createWrapper = (initialData: TreeNode[] = []) => {
  const Wrapper: FC<PropsWithChildren> = ({ children }) => (
    <Provider>
      <Initializer initialData={initialData}>{children}</Initializer>
    </Provider>
  );

  return Wrapper;
};

const Initializer: FC<{ initialData: TreeNode[] } & PropsWithChildren> = ({ initialData, children }): ReactElement => {
  const setTableData = useSetAtom(tableDataAtom);

  useEffect(() => {
    setTableData(initialData);
  }, [initialData, setTableData]);

  return <>{children}</>;
};

describe('useSubscriptionOrchestrator', () => {
  const createWorkerApiMock = () => {
    const unsubscribe = vi.fn().mockResolvedValue('sub-1');
    const subscribeSubtree = vi.fn().mockResolvedValue('sub-1');

    const subscriptionApi = {
      subscribeSubtree,
      unsubscribe,
    };

    const workerAPI = {
      getSubscriptionAPI: vi.fn().mockResolvedValue(subscriptionApi),
    } as unknown as WorkerAPI;

    return { workerAPI, subscribeSubtree, unsubscribe };
  };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('requests subtree prefetch with provided depth and resets table data, applying snapshot events as added rows', async () => {
    const { workerAPI, subscribeSubtree } = createWorkerApiMock();
    const initialData = [{ id: 'legacy-node' } as TreeNode];

    const { result } = renderHook(() => {
      const subscription = useSubscriptionOrchestrator(workerAPI);
      const tableData = useAtomValue(tableDataAtom);
      return { subscription, tableData };
    }, {
      wrapper: createWrapper(initialData),
    });

    await act(async () => {
      await result.current.subscription.subscribe('root-node', 3);
    });

    expect(subscribeSubtree).toHaveBeenCalledWith(
      'root-node',
      expect.any(Function),
      expect.objectContaining({
        prefetch: { depth: 3 },
      }),
    );
    expect(result.current.tableData).toEqual([]);

    const callback = subscribeSubtree.mock.calls[0][1];
    await act(async () => {
      callback({
        type: 'updated',
        nodeId: 'node-1',
        node: { name: 'Prefetched', parentId: 'root-node' },
      });
    });

    await act(async () => {
      vi.runAllTimers();
    });

    expect(result.current.tableData).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'node-1', name: 'Prefetched' }),
      ]),
    );
  });

  it('defaults to depth=2 prefetch when none provided', async () => {
    const { workerAPI, subscribeSubtree } = createWorkerApiMock();

    const { result } = renderHook(() => useSubscriptionOrchestrator(workerAPI), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.subscribe('root-node');
    });

    expect(subscribeSubtree).toHaveBeenCalledWith(
      'root-node',
      expect.any(Function),
      expect.objectContaining({
        prefetch: { depth: 2 },
      }),
    );
  });
});
