import type { BuildSessionRuntimeRecord, CanonicalBuildInputSource } from '@hierarchidb/build-api';
import { type NodeType, toNodeType } from '@hierarchidb/core-types';
import { STAGED_FOLDER_ACTION_RUNTIME_NODE_TYPE } from '@hierarchidb/staged-folder-action';
import { type BuildWorkerBridge, getBuildWorkerBridge } from '@hierarchidb/ui-worker-client';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BuildSessionQueueEntry } from '~/components/BuildSessionQueuePanel';
import { useWorker } from '~/contexts/WorkerProvider';
import type { LoadPageNodeReturn } from '~/router/loaders/treeLoaders';
import { startBuildFlow } from '~/router/pages/tree/console/buildFlow';
import type { BuildJobQueue, BuildJobQueueEntry } from '~/router/pages/tree/console/buildJobQueue';
import { openInNewTab } from '~/utils/openInNewTab';

const runningSessionStatuses = new Set<BuildSessionRuntimeRecord['status']>([
  'starting',
  'running',
  'resuming',
  'finalizing',
  'pausing',
]);

const isActiveQueueSession = (session: BuildSessionRuntimeRecord): boolean =>
  session.isActive || runningSessionStatuses.has(session.status);

const resolveResumeInputSource = (session: BuildSessionRuntimeRecord): CanonicalBuildInputSource =>
  session.inputSource ?? 'committed';

export const RESUME_SESSION_NODE_TYPE = toNodeType('shape');

export type TreeConsoleAppBarState = {
  resumeSessionNodeType: NodeType;
  resumeDialogRows: BuildSessionQueueEntry[];
  stagedFolderActionDialogRows: BuildSessionQueueEntry[];
  resumeDialogSessionCount: number;
  canResumeDialogQueue: boolean;
  isResumeDialogOpen: boolean;
  isQueueAutoStartEnabled: boolean;
  isDeletingQueue: boolean;
  isResumingQueue: boolean;
  handleNavigateToBuild: (
    entry: BuildSessionQueueEntry,
    options?: { openInNewTab?: boolean }
  ) => Promise<void>;
  handleNavigateToBuildJobEntry: (
    entry: BuildJobQueueEntry,
    queue: BuildJobQueue,
    options?: { openInNewTab?: boolean }
  ) => void;
  handleResumeDialogEntriesChange: (entries: BuildSessionQueueEntry[]) => void;
  handleStagedFolderActionDialogEntriesChange: (entries: BuildSessionQueueEntry[]) => void;
  handleResumeQueue: () => Promise<void>;
  handleDeleteQueue: () => Promise<void>;
  handleSkipResumeDialog: () => void;
};

export function useTreeConsoleAppBar({
  data,
}: {
  data: LoadPageNodeReturn;
}): TreeConsoleAppBarState {
  const navigate = useNavigate();
  const { client: workerClient } = useWorker();
  const buildWorkerBridgeRef = useRef<BuildWorkerBridge>(getBuildWorkerBridge());
  const location = useRouterState({ select: (state) => state.location });
  const [resumeDialogRows, setResumeDialogRows] = useState<BuildSessionQueueEntry[]>([]);
  const [stagedFolderActionDialogRows, setStagedFolderActionDialogRows] = useState<
    BuildSessionQueueEntry[]
  >([]);
  const [isResumeDialogOpen, setIsResumeDialogOpen] = useState(false);
  const [isQueueAutoStartEnabled, setIsQueueAutoStartEnabled] = useState(true);
  const [isDeletingQueue, setIsDeletingQueue] = useState(false);
  const [isResumingQueue, setIsResumingQueue] = useState(false);
  const resumeDialogShownRef = useRef<boolean>(false);
  const returnTo = useMemo(
    () => `${location.pathname}${location.searchStr ?? ''}`,
    [location.pathname, location.searchStr]
  );

  const handleNavigateToBuild = useCallback(
    async (entry: BuildSessionQueueEntry, options?: { openInNewTab?: boolean }) => {
      if (!data.tree?.id || !data.pageNodeId || !workerClient) return;
      const targetNode =
        entry.node ??
        (await workerClient
          .getQueryAPI()
          .then((queryAPI) => queryAPI.getNode(entry.session.nodeId))
          .catch(() => null));

      if (!targetNode) {
        return;
      }

      await startBuildFlow({
        treeId: data.tree.id,
        pageNodeId: data.pageNodeId,
        node: targetNode,
        returnTo,
        workerClient,
        navigate: (to) => {
          if (options?.openInNewTab) {
            openInNewTab(to);
            return;
          }
          navigate({ to });
        },
      });
    },
    [data.pageNodeId, data.tree?.id, navigate, returnTo, workerClient]
  );

  const handleNavigateToBuildJobEntry = useCallback(
    (entry: BuildJobQueueEntry, queue: BuildJobQueue, options?: { openInNewTab?: boolean }) => {
      if (queue.mode !== 'web-ui' || !entry.displayUrl) {
        return;
      }
      if (options?.openInNewTab) {
        openInNewTab(entry.displayUrl);
        return;
      }
      navigate({ to: entry.displayUrl });
    },
    [navigate]
  );

  const handleResumeDialogEntriesChange = useCallback((entries: BuildSessionQueueEntry[]) => {
    setResumeDialogRows(entries);
  }, []);

  const handleStagedFolderActionDialogEntriesChange = useCallback(
    (entries: BuildSessionQueueEntry[]) => {
      setStagedFolderActionDialogRows(entries);
    },
    []
  );

  const resumeDialogSessionCount = resumeDialogRows.length + stagedFolderActionDialogRows.length;
  const canResumeDialogQueue = resumeDialogRows.length > 0;

  useEffect(() => {
    const allRows = [...resumeDialogRows, ...stagedFolderActionDialogRows];
    const hasAnySession = allRows.length > 0;
    const hasActiveSession = allRows.some((entry) => isActiveQueueSession(entry.session));

    if (
      hasAnySession &&
      !hasActiveSession &&
      !isResumeDialogOpen &&
      !resumeDialogShownRef.current
    ) {
      setIsQueueAutoStartEnabled(false);
      setIsResumeDialogOpen(true);
      resumeDialogShownRef.current = true;
      return;
    }

    if (isResumeDialogOpen && hasActiveSession) {
      setIsQueueAutoStartEnabled(true);
      setIsResumeDialogOpen(false);
    }
  }, [resumeDialogRows, stagedFolderActionDialogRows, isResumeDialogOpen]);

  const handleResumeQueue = useCallback(async () => {
    const first = resumeDialogRows[0];
    if (!first) {
      setIsResumeDialogOpen(false);
      return;
    }

    setIsResumingQueue(true);
    try {
      const bridge = buildWorkerBridgeRef.current;
      await bridge.initialize();
      await bridge.startBuildSession(
        RESUME_SESSION_NODE_TYPE,
        first.session.nodeId,
        resolveResumeInputSource(first.session)
      );
      setIsQueueAutoStartEnabled(true);
      setIsResumeDialogOpen(false);
    } catch (error) {
      console.warn('[TreeConsoleAppBar] failed to resume build queue', error);
    } finally {
      setIsResumingQueue(false);
    }
  }, [resumeDialogRows]);

  const handleDeleteQueue = useCallback(async () => {
    if (resumeDialogSessionCount === 0) {
      setIsResumeDialogOpen(false);
      return;
    }

    setIsDeletingQueue(true);
    try {
      const bridge = buildWorkerBridgeRef.current;
      await bridge.initialize();
      await Promise.all(
        [
          ...resumeDialogRows.map((entry) => ({
            nodeType: RESUME_SESSION_NODE_TYPE,
            nodeId: entry.session.nodeId,
          })),
          ...stagedFolderActionDialogRows.map((entry) => ({
            nodeType: STAGED_FOLDER_ACTION_RUNTIME_NODE_TYPE,
            nodeId: entry.session.nodeId,
          })),
        ].map((entry) => bridge.deleteBuildSession(entry.nodeType, entry.nodeId))
      );
      setIsQueueAutoStartEnabled(false);
      setIsResumeDialogOpen(false);
    } catch (error) {
      console.warn('[TreeConsoleAppBar] failed to delete build queue', error);
    } finally {
      setIsDeletingQueue(false);
    }
  }, [resumeDialogRows, resumeDialogSessionCount, stagedFolderActionDialogRows]);

  const handleSkipResumeDialog = useCallback(() => {
    setIsResumeDialogOpen(false);
  }, []);

  return {
    resumeSessionNodeType: RESUME_SESSION_NODE_TYPE,
    resumeDialogRows,
    stagedFolderActionDialogRows,
    resumeDialogSessionCount,
    canResumeDialogQueue,
    isResumeDialogOpen,
    isQueueAutoStartEnabled,
    isDeletingQueue,
    isResumingQueue,
    handleNavigateToBuild,
    handleNavigateToBuildJobEntry,
    handleResumeDialogEntriesChange,
    handleStagedFolderActionDialogEntriesChange,
    handleResumeQueue,
    handleDeleteQueue,
    handleSkipResumeDialog,
  };
}
