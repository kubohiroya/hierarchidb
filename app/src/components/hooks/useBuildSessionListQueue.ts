import type { BuildSessionRuntimeRecord, CanonicalBuildInputSource } from '@hierarchidb/build-api';
import type { NodeId, NodeType } from '@hierarchidb/core-types';
import { toNodeType } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import { useWorkerQueryAPI } from '@hierarchidb/ui-build-sessions';
import type { BuildWorkerBridge } from '@hierarchidb/ui-worker-client';
import { getBuildWorkerBridge } from '@hierarchidb/ui-worker-client';
import {
  type DragEvent,
  type MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

export type BuildSessionQueueEntry = {
  session: BuildSessionRuntimeRecord;
  node: TreeNode | null;
  nodePath: string;
};

type QueueRow = {
  session: BuildSessionRuntimeRecord;
  node: TreeNode | null;
  nodePath: string;
};

type BuildSessionQueuePanelHookProps = {
  nodeType?: NodeType;
  onNavigateToBuild?: (entry: BuildSessionQueueEntry) => void;
  onEntriesChange?: (entries: BuildSessionQueueEntry[]) => void;
  autoStartTopSession?: boolean;
};

const SESSION_SORT_ACTIVE_STATUSES = new Set<BuildSessionRuntimeRecord['status']>([
  'starting',
  'running',
  'resuming',
  'finalizing',
]);

const SESSION_TIMER_ACTIVE_STATUSES = new Set<BuildSessionRuntimeRecord['status']>([
  'starting',
  'running',
  'resuming',
  'finalizing',
  'pausing',
]);

const QUEUE_STATUSES: BuildSessionRuntimeRecord['status'][] = [
  'starting',
  'running',
  'resuming',
  'finalizing',
  'pausing',
  'paused',
  'failed',
  'completed',
];

const isSessionStoppedByStatus = (session: BuildSessionRuntimeRecord): boolean =>
  session.status === 'paused' || session.status === 'failed' || session.status === 'completed';

const isSessionRunningByStatus = (session: BuildSessionRuntimeRecord): boolean =>
  session.isActive || SESSION_SORT_ACTIVE_STATUSES.has(session.status);

const isSessionTimerActive = (session: BuildSessionRuntimeRecord): boolean =>
  session.isActive && SESSION_TIMER_ACTIVE_STATUSES.has(session.status);

const resolveQueueStartInputSource = (
  session: BuildSessionRuntimeRecord
): CanonicalBuildInputSource => session.inputSource ?? 'committed';

const createRuntimeRecordSignature = (session: BuildSessionRuntimeRecord): string => {
  const progress = session.progress;
  const progressSignature = progress
    ? `${progress.stage ?? ''}:${progress.percentage ?? ''}:${progress.total ?? ''}`
    : '';
  const runtimeSignature = isSessionTimerActive(session)
    ? `${session.revision}|${session.updatedAt ?? ''}|${progressSignature}`
    : '';

  return [session.nodeId, session.status, session.isActive ? 1 : 0, runtimeSignature].join('|');
};

const createQueueRowSignature = (row: QueueRow): string =>
  `${createRuntimeRecordSignature(row.session)}|${row.node?.id ?? ''}|${row.nodePath}`;

const isSameQueueRows = (left: QueueRow[], right: QueueRow[]): boolean => {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((row, index) => {
    const other = right[index];
    if (!other) {
      return false;
    }
    return createQueueRowSignature(row) === createQueueRowSignature(other);
  });
};

const normalizeWaitingFirst = (rows: QueueRow[]): QueueRow[] => {
  const running: QueueRow[] = [];
  const waiting: QueueRow[] = [];

  for (const row of rows) {
    if (isSessionRunningByStatus(row.session)) {
      running.push(row);
    } else {
      waiting.push(row);
    }
  }
  return [...running, ...waiting];
};

const mergeSessionOrder = (
  previous: QueueRow[],
  incoming: BuildSessionRuntimeRecord[]
): QueueRow[] => {
  if (incoming.length === 0) {
    return [];
  }

  const incomingByNodeId = new Map<string, BuildSessionRuntimeRecord>(
    incoming.map((session) => [String(session.nodeId), session])
  );

  const merged = previous
    .filter((row) => incomingByNodeId.has(String(row.session.nodeId)))
    .map((row) => {
      const nextSession = incomingByNodeId.get(String(row.session.nodeId));
      if (!nextSession) {
        return row;
      }
      return {
        ...row,
        session: nextSession,
      };
    });

  const existingIds = new Set<string>(merged.map((row) => String(row.session.nodeId)));
  const added = incoming.filter((session) => !existingIds.has(String(session.nodeId)));

  return [
    ...merged,
    ...added.map((session) => ({
      session,
      node: null,
      nodePath: String(session.nodeId),
    })),
  ];
};

const toNodePathLabel = (nodes: TreeNode[]): string =>
  nodes
    .map((node) => String(node.metadata?.name ?? node.id ?? ''))
    .filter(Boolean)
    .join(' > ');

export function useBuildSessionListQueue({
  nodeType = toNodeType('shape'),
  onNavigateToBuild,
  onEntriesChange,
  autoStartTopSession = true,
}: BuildSessionQueuePanelHookProps) {
  const { getQueryAPIOrNull } = useWorkerQueryAPI();
  const bridgeRef = useRef<BuildWorkerBridge>(getBuildWorkerBridge());

  const [rows, setRows] = useState<QueueRow[]>([]);
  const [draggingNodeId, setDraggingNodeId] = useState<NodeId | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<QueueRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const queueStoppedRef = useRef<boolean>(false);
  const autoStartingNodeRef = useRef<NodeId | null>(null);
  const nodeCacheRef = useRef<Map<string, { node: TreeNode | null; nodePath: string }>>(new Map());
  const loadSessions = useCallback(async () => {
    try {
      const bridge = bridgeRef.current;
      await bridge.initialize();
      const sessions = await bridge.listBuildSessionRuntimes(nodeType, {
        statuses: [...QUEUE_STATUSES],
      });
      setRows((current) => {
        const nextRows = normalizeWaitingFirst(mergeSessionOrder(current, sessions));
        return isSameQueueRows(current, nextRows) ? current : nextRows;
      });
    } catch (error) {
      console.warn('[BuildSessionQueueList] listBuildSessionRuntimes failed', error);
    }
  }, [nodeType]);

  useEffect(() => {
    void loadSessions();

    let disposed = false;
    let unsubscribe: (() => void) | null = null;

    const subscribe = async () => {
      try {
        const bridge = bridgeRef.current;
        await bridge.initialize();
        unsubscribe = await bridge.subscribeBuildSessionRuntimes(
          nodeType,
          { statuses: [...QUEUE_STATUSES] },
          (nextSessions) => {
            if (disposed) {
              return;
            }
            const filtered = nextSessions.filter((session) =>
              QUEUE_STATUSES.includes(session.status)
            );
            setRows((current) => {
              const nextRows = normalizeWaitingFirst(mergeSessionOrder(current, filtered));
              return isSameQueueRows(current, nextRows) ? current : nextRows;
            });
          }
        );
      } catch (error) {
        console.warn('[BuildSessionQueueList] subscribeBuildSessionRuntimes failed', error);
      }
    };

    void subscribe();

    return () => {
      disposed = true;
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [loadSessions, nodeType]);

  useEffect(() => {
    const loadNodeInfo = async () => {
      const queryAPI = await getQueryAPIOrNull();
      if (!queryAPI) {
        return;
      }

      const cache = new Map(nodeCacheRef.current);
      const missingNodeIds = new Set<string>();

      for (const row of rows) {
        const nodeId = String(row.session.nodeId);
        if (!cache.has(nodeId)) {
          missingNodeIds.add(nodeId);
        }
      }

      if (missingNodeIds.size === 0) {
        return;
      }

      await Promise.all(
        Array.from(missingNodeIds).map(async (nodeId) => {
          const pathNodes = await queryAPI.getNodePath(nodeId as NodeId).catch(() => []);
          const node = pathNodes[pathNodes.length - 1] ?? null;
          const nodePath = pathNodes.length > 0 ? toNodePathLabel(pathNodes) : nodeId;
          cache.set(nodeId, { node, nodePath });
        })
      );

      nodeCacheRef.current = cache;

      let changed = false;
      const nextRows = rows.map((row) => {
        const nodeId = String(row.session.nodeId);
        const cached = cache.get(nodeId);
        if (!cached) {
          return row;
        }

        const nextRow: QueueRow = {
          ...row,
          node: cached.node,
          nodePath: cached.nodePath,
        };

        if (
          nextRow.node === row.node &&
          nextRow.nodePath === row.nodePath &&
          nextRow.session.status === row.session.status &&
          nextRow.session.updatedAt === row.session.updatedAt
        ) {
          return row;
        }

        changed = true;
        return nextRow;
      });

      if (changed && !isSameQueueRows(rows, nextRows)) {
        setRows(nextRows);
      }
    };

    void loadNodeInfo();
  }, [getQueryAPIOrNull, rows]);

  const entries = useMemo(
    () =>
      rows.map(
        (row) =>
          ({
            session: row.session,
            node: row.node,
            nodePath: row.nodePath,
          }) satisfies BuildSessionQueueEntry
      ),
    [rows]
  );
  const entriesSignature = useMemo(() => rows.map(createQueueRowSignature).join('||'), [rows]);
  const lastEntriesSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    if (!onEntriesChange) return;
    if (lastEntriesSignatureRef.current === entriesSignature) {
      return;
    }
    lastEntriesSignatureRef.current = entriesSignature;
    onEntriesChange(entries);
  }, [entries, entriesSignature, onEntriesChange]);

  const startTopSession = useCallback(
    async (nodeId: NodeId) => {
      if (autoStartingNodeRef.current === nodeId) {
        return;
      }

      autoStartingNodeRef.current = nodeId;
      try {
        const bridge = bridgeRef.current;
        const session = rows.find((row) => row.session.nodeId === nodeId)?.session;
        await bridge.startBuildSession(
          nodeType,
          nodeId,
          session ? resolveQueueStartInputSource(session) : 'committed'
        );
      } catch (error) {
        console.warn('[BuildSessionQueueList] failed to auto-start queued session', error);
      } finally {
        autoStartingNodeRef.current = null;
      }
    },
    [nodeType, rows]
  );

  useEffect(() => {
    if (!autoStartTopSession) {
      queueStoppedRef.current = false;
      autoStartingNodeRef.current = null;
      return;
    }

    const headSession = rows[0];
    if (!headSession) {
      queueStoppedRef.current = false;
      autoStartingNodeRef.current = null;
      return;
    }

    if (isSessionStoppedByStatus(headSession.session) || headSession.session.status === 'pausing') {
      queueStoppedRef.current = true;
      return;
    }

    if (isSessionRunningByStatus(headSession.session)) {
      queueStoppedRef.current = false;
      return;
    }

    if (queueStoppedRef.current) {
      return;
    }

    void startTopSession(headSession.session.nodeId);
  }, [autoStartTopSession, rows, startTopSession]);

  const handleNavigate = useCallback(
    (row: QueueRow) => {
      if (!onNavigateToBuild) {
        return;
      }

      onNavigateToBuild({
        session: row.session,
        node: row.node,
        nodePath: row.nodePath,
      });
    },
    [onNavigateToBuild]
  );

  const handleDeleteRequest = useCallback((row: QueueRow) => {
    setDeleteTarget(row);
    setIsDialogOpen(true);
  }, []);

  const handleCancelDelete = useCallback(() => {
    setDeleteTarget(null);
    setIsDialogOpen(false);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) {
      return;
    }

    setIsDeleting(true);
    try {
      const bridge = bridgeRef.current;
      await bridge.deleteBuildSession(nodeType, deleteTarget.session.nodeId);
    } catch (error) {
      console.error('[BuildSessionQueueList] deleteBuildSession failed', error);
    } finally {
      setDeleteTarget(null);
      setIsDialogOpen(false);
      setIsDeleting(false);
    }
  }, [deleteTarget, nodeType]);

  const handleDeleteAll = useCallback(async () => {
    if (rows.length === 0) {
      return;
    }

    setIsDeleting(true);
    try {
      const bridge = bridgeRef.current;
      await Promise.allSettled(
        rows.map((row) => bridge.deleteBuildSession(nodeType, row.session.nodeId))
      );
    } catch (error) {
      console.error('[BuildSessionQueueList] delete all sessions failed', error);
    } finally {
      setIsDeleting(false);
    }
  }, [nodeType, rows]);

  const handleResumeFirstSession = useCallback(() => {
    const firstSession = rows[0];
    if (!firstSession) {
      return;
    }

    void startTopSession(firstSession.session.nodeId);
  }, [rows, startTopSession]);

  const handleStartStoppedSession = useCallback(
    (row: QueueRow, event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      const nodeId = String(row.session.nodeId);

      setRows((current) => {
        const sourceIndex = current.findIndex((item) => String(item.session.nodeId) === nodeId);
        if (sourceIndex <= 0) {
          return current;
        }

        const next = [...current];
        const [moving] = next.splice(sourceIndex, 1);
        if (!moving) {
          return current;
        }
        next.unshift(moving);
        return normalizeWaitingFirst(next);
      });

      void startTopSession(row.session.nodeId);
    },
    [startTopSession]
  );

  const handleDragEnd = useCallback(() => {
    setDraggingNodeId(null);
  }, []);

  const handleDragStart = useCallback(
    (event: DragEvent<HTMLElement>, nodeId: NodeId) => {
      const row = rows.find((item) => String(item.session.nodeId) === String(nodeId));
      if (!row) {
        return;
      }
      const rowIndex = rows.findIndex((item) => String(item.session.nodeId) === String(nodeId));
      const isRunning = isSessionTimerActive(row.session);
      if (isRunning || rowIndex === 0) {
        event.preventDefault();
        return;
      }
      setDraggingNodeId(nodeId);
      event.dataTransfer.effectAllowed = 'move';
    },
    [rows]
  );

  const handleDragOver = useCallback(
    (event: DragEvent, nodeId: NodeId) => {
      event.preventDefault();
      if (!draggingNodeId || draggingNodeId === nodeId) {
        return;
      }

      setRows((current) => {
        const sourceIndex = current.findIndex(
          (row) => String(row.session.nodeId) === String(draggingNodeId)
        );
        const targetIndex = current.findIndex(
          (row) => String(row.session.nodeId) === String(nodeId)
        );

        if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === 0 || targetIndex === 0) {
          return current;
        }
        const sourceRow = current[sourceIndex];
        const targetRow = current[targetIndex];
        if (!sourceRow || !targetRow) {
          return current;
        }
        if (
          isSessionRunningByStatus(sourceRow.session) ||
          isSessionRunningByStatus(targetRow.session)
        ) {
          return current;
        }

        const next = [...current];
        const [moving] = next.splice(sourceIndex, 1);
        if (!moving) {
          return current;
        }
        const safeTargetIndex = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;
        next.splice(safeTargetIndex, 0, moving);
        return normalizeWaitingFirst(next);
      });
    },
    [draggingNodeId]
  );

  const handleOpenAll = useCallback((eventOrElement: MouseEvent<HTMLElement> | HTMLElement) => {
    const nextAnchor =
      'currentTarget' in eventOrElement ? eventOrElement.currentTarget : eventOrElement;
    setAnchorEl(nextAnchor);
  }, []);

  const handleCloseAll = useCallback(() => {
    setAnchorEl(null);
  }, []);

  return {
    rows,
    isDeleting,
    isDialogOpen,
    anchorEl,
    deleteTarget,
    draggingNodeId,
    handleNavigate,
    handleDeleteRequest,
    handleCancelDelete,
    handleConfirmDelete,
    handleStartStoppedSession,
    handleDragEnd,
    handleDragStart,
    handleDragOver,
    handleOpenAll,
    handleCloseAll,
    handleDeleteAll,
    handleResumeFirstSession,
  };
}
