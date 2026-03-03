import { createElement, useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import type { BuildStage } from '@hierarchidb/components';
import type { BuildSessionSnapshot } from '~/hooks/useBuildSessionSnapshots';
import type { NodeId } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import { useWorkerQueryAPI } from '~/hooks/useWorkerQueryAPI';
import {
  CloudDownload as CloudDownloadIcon,
  Layers as LayersIcon,
  Tune as TuneIcon,
} from '@mui/icons-material';

export type BuildSessionLauncherEntry = {
  session: BuildSessionSnapshot;
  node: TreeNode | null;
  nodePath: string;
};

type ProgressSummary = {
  total: number;
  completed: number;
  failed: number;
  skipped: number;
  percentage: number;
  stage?: string;
};

type NormalizedStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed';

export type ResolvedBuildSessionEntry = BuildSessionLauncherEntry & {
  stageLabel: string;
  taskLabel: string;
  taskUnitLabel: string;
  counts: {
    total: number;
    completed: number;
    failed: number;
    skipped: number;
  };
  percentage: number;
  status: NormalizedStatus;
};

type UseBuildSessionLauncherPanelParams = {
  sessions: readonly BuildSessionSnapshot[];
  excludeNodeId?: NodeId;
  t: (key: string, fallback: string) => string;
};

const isProgressSummary = (value: unknown): value is ProgressSummary => {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return Number.isFinite(record.total)
    && Number.isFinite(record.completed)
    && Number.isFinite(record.failed)
    && Number.isFinite(record.skipped)
    && Number.isFinite(record.percentage);
};

const resolveProgressSummary = (value: unknown): ProgressSummary | null => {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const percentage = Number.isFinite(record.percentage) ? Number(record.percentage) : null;
  if (percentage === null) return null;
  const total = Number.isFinite(record.total) ? Number(record.total) : 0;
  const completed = Number.isFinite(record.completed) ? Number(record.completed) : 0;
  const failed = Number.isFinite(record.failed) ? Number(record.failed) : 0;
  const skipped = Number.isFinite(record.skipped) ? Number(record.skipped) : 0;
  const stage = typeof record.stage === 'string' ? record.stage : undefined;
  return {
    total,
    completed,
    failed,
    skipped,
    percentage,
    stage,
  };
};

const normalizeSessionStatus = (value: unknown): NormalizedStatus => {
  const status = (() => {
    if (typeof value === 'string') return value;
    if (value && typeof value === 'object') {
      const candidate = (value as Record<string, unknown>).status;
      if (typeof candidate === 'string') return candidate;
    }
    return 'idle';
  })();
  switch (status) {
    case 'processing':
      return 'running';
    case 'running':
    case 'paused':
    case 'completed':
    case 'failed':
      return status;
    default:
      return 'idle';
  }
};

const toNodePathLabel = (nodes: TreeNode[]): string =>
  nodes
    .map((node) => node?.metadata?.name || String(node?.id ?? ''))
    .filter((label) => label.length > 0)
    .join(' > ');

const useBuildStages = (t: (key: string, fallback: string) => string): BuildStage[] => {
  return useMemo(
    () => [
      {
        id: 'source',
        title: t('processing.source.title', 'Source'),
        description: t('stage.stages.source.description', 'Load and normalize source data.'),
        icon: createElement(CloudDownloadIcon, { color: 'primary' }),
      },
      {
        id: 'geometry',
        title: t('processing.geometry.title', 'Geometry'),
        description: t('stage.stages.geometry.description', 'Simplify features per zoom band.'),
        icon: createElement(TuneIcon, { color: 'primary' }),
      },
      {
        id: 'tileEmit',
        title: t('processing.tileEmit.title', 'TileEmit Generation'),
        description: t('stage.stages.tileEmit.description', 'Generate vector tiles for the selected zoom range.'),
        icon: createElement(LayersIcon, { color: 'primary' }),
      },
    ],
    [t]
  );
};

const resolveRequestedAt = (session: BuildSessionSnapshot): number => session.updatedAt ?? 0;

export const useBuildSessionLauncherPanel = ({
  sessions,
  excludeNodeId,
  t,
}: UseBuildSessionLauncherPanelParams) => {
  const { apiAvailable, getQueryAPIOrNull } = useWorkerQueryAPI();
  const stages = useBuildStages(t);
  const stageById = useMemo(() => new Map(stages.map((stage) => [stage.id, stage])), [stages]);

  const [entries, setEntries] = useState<BuildSessionLauncherEntry[]>([]);
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [menuEntry, setMenuEntry] = useState<ResolvedBuildSessionEntry | null>(null);
  const nodeCacheRef = useRef<Map<string, { node: TreeNode | null; nodePath: string }>>(new Map());
  const refreshIdRef = useRef(0);
  const pendingEntriesRef = useRef<BuildSessionLauncherEntry[] | null>(null);
  const entriesFrameRef = useRef<number | null>(null);
  const entriesScheduledRef = useRef(false);

  useEffect(() => {
    return () => {
      if (entriesFrameRef.current !== null) {
        window.cancelAnimationFrame(entriesFrameRef.current);
        entriesFrameRef.current = null;
      }
    };
  }, []);

  const scheduleEntriesUpdate = useCallback((next: BuildSessionLauncherEntry[]) => {
    pendingEntriesRef.current = next;
    if (entriesScheduledRef.current) return;
    entriesScheduledRef.current = true;
    entriesFrameRef.current = window.requestAnimationFrame(() => {
      entriesScheduledRef.current = false;
      entriesFrameRef.current = null;
      const pending = pendingEntriesRef.current;
      pendingEntriesRef.current = null;
      if (!pending) return;
      setEntries(pending);
    });
  }, []);

  const refreshEntries = useCallback(async (sessionSnapshots: readonly BuildSessionSnapshot[]) => {
    if (!apiAvailable) {
      scheduleEntriesUpdate([]);
      return;
    }
    if (sessionSnapshots.length === 0) {
      scheduleEntriesUpdate([]);
      return;
    }
    const currentRefreshId = refreshIdRef.current + 1;
    refreshIdRef.current = currentRefreshId;
    const queryAPI = await getQueryAPIOrNull();
    if (!queryAPI) {
      if (currentRefreshId === refreshIdRef.current) {
        const fallbackEntries: BuildSessionLauncherEntry[] = sessionSnapshots.map((session) => ({
          session,
          node: null,
          nodePath: String(session.nodeId),
        }));
        scheduleEntriesUpdate(fallbackEntries);
      }
      return;
    }
    const nodeIds = Array.from(new Set(sessionSnapshots.map((session) => String(session.nodeId))));
    const updatedCache = new Map(nodeCacheRef.current);
    await Promise.all(
      nodeIds.map(async (nodeId) => {
        if (updatedCache.has(nodeId)) return;
        const pathNodes = await queryAPI.getNodePath(nodeId as NodeId).catch(() => []);
        if (pathNodes.length === 0) return;
        const node = pathNodes[pathNodes.length - 1] ?? null;
        const nodePath = toNodePathLabel(pathNodes);
        updatedCache.set(nodeId, { node, nodePath });
      })
    );
    if (currentRefreshId !== refreshIdRef.current) return;
    nodeCacheRef.current = updatedCache;
    const nextEntries: BuildSessionLauncherEntry[] = sessionSnapshots
      .map((session) => {
        const nodeKey = String(session.nodeId);
        const cached = updatedCache.get(nodeKey);
        return {
          session,
          node: cached?.node ?? null,
          nodePath: cached?.nodePath ?? '',
        };
      })
      .sort((a, b) => {
        const aRequestedAt = resolveRequestedAt(a.session);
        const bRequestedAt = resolveRequestedAt(b.session);
        if (aRequestedAt !== bRequestedAt) return aRequestedAt - bRequestedAt;
        return a.nodePath.localeCompare(b.nodePath);
      });
    scheduleEntriesUpdate(nextEntries);
  }, [apiAvailable, getQueryAPIOrNull, scheduleEntriesUpdate]);

  useEffect(() => {
    void refreshEntries(sessions);
  }, [refreshEntries, sessions]);

  const resolvedEntries = useMemo<ResolvedBuildSessionEntry[]>(() => {
    return entries.map((entry) => {
      const progressSummary = isProgressSummary(entry.session.progress)
        ? entry.session.progress
        : resolveProgressSummary(entry.session.progress);
      const counts = progressSummary
        ? {
            total: progressSummary.total,
            completed: progressSummary.completed,
            failed: progressSummary.failed,
            skipped: progressSummary.skipped,
          }
        : {
            total: 0,
            completed: 0,
            failed: 0,
            skipped: 0,
          };
      const percentage = progressSummary?.percentage ?? 0;
      const stageId = progressSummary?.stage;
      const stageTitle = stageId ? stageById.get(stageId)?.title ?? stageId : undefined;
      const status = normalizeSessionStatus(entry.session.status);
      const rawCounts = counts.total > 0 ? counts : counts;
      const stageLabel = stageTitle ?? (() => {
        if (status === 'running') return t('stage.progress.unknownStage', 'processing');
        if (status === 'paused') return t('stage.progress.pausedStage', 'paused');
        if (status === 'completed') return t('stage.progress.completedStage', 'completed');
        return t('stage.progress.idleStage', 'idle');
      })();
      const taskLabel = (() => {
        if (status === 'completed') return t('stage.progress.done', 'Completed');
        if (status === 'failed') return t('stage.progress.failed', 'Failed');
        if (status === 'paused') return t('stage.progress.paused', 'Paused');
        if (status !== 'running') {
          if (status === 'idle' && rawCounts.total > 0) {
            const doneCount = rawCounts.completed + rawCounts.failed + rawCounts.skipped;
            return doneCount >= rawCounts.total
              ? t('stage.progress.done', 'Completed')
              : t('stage.progress.working', 'Working...');
          }
          return t('stage.progress.ready', 'Ready');
        }
        return stageTitle || t('stage.progress.working', 'Working...');
      })();
      const taskUnitLabel = t('stage.progress.taskUnitTasks', 'Tasks');
      return {
        ...entry,
        stageLabel,
        taskLabel,
        taskUnitLabel,
        counts,
        percentage,
        status,
      };
    });
  }, [entries, stageById, t]);

  const filteredEntries = useMemo(() => {
    if (!excludeNodeId) return resolvedEntries;
    return resolvedEntries.filter((entry) => String(entry.session.nodeId) !== String(excludeNodeId));
  }, [excludeNodeId, resolvedEntries]);

  const handleOpenMenu = useCallback((event: MouseEvent<HTMLButtonElement>, entry: ResolvedBuildSessionEntry) => {
    setMenuAnchorEl(event.currentTarget);
    setMenuEntry(entry);
  }, []);

  const handleCloseMenu = useCallback(() => {
    setMenuAnchorEl(null);
    setMenuEntry(null);
  }, []);

  return {
    filteredEntries,
    menuAnchorEl,
    menuEntry,
    handleOpenMenu,
    handleCloseMenu,
  };
};
