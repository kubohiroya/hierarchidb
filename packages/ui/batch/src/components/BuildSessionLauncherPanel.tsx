import {
  createElement,
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type MouseEvent,
} from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  LinearProgress,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import type { BuildStage } from '@hierarchidb/components';
import type { BuildSessionSnapshot } from '../hooks/useBuildSessionSnapshots.js';
import type { NodeId, NodeType, TreeId } from '@hierarchidb/core-types';
import { useGlobalI18nTranslator } from '@hierarchidb/ui-i18n';
import { useIconRegistry } from '@hierarchidb/ui-icon';
import type { TreeNode } from '@hierarchidb/tree-api';
import {
  CloudDownload as CloudDownloadIcon,
  Layers as LayersIcon,
  Tune as TuneIcon,
} from '@mui/icons-material';
import { useWorkerAPI } from '@hierarchidb/ui-worker-provider';
import { useBuildSessionSnapshots } from '../hooks/useBuildSessionSnapshots.js';

export type BuildSessionLauncherEntry = {
  session: BuildSessionSnapshot;
  node: TreeNode | null;
  nodePath: string;
};

type BuildSessionLauncherPanelProps = {
  treeId?: TreeId;
  pageNodeId?: NodeId;
  nodeType: NodeType;
  excludeNodeId?: NodeId;
  onNavigateToBuild?: (entry: BuildSessionLauncherEntry, options?: { openInNewTab?: boolean }) => void;
};

type ProgressSummary = {
  total: number;
  completed: number;
  failed: number;
  skipped: number;
  percentage: number;
  taskType?: string;
};

type LoadingButtonProps = ComponentProps<typeof Button> & { loading?: boolean };

type NormalizedStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed';

type ResolvedBuildSessionEntry = BuildSessionLauncherEntry & {
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

const LoadingButton = forwardRef<HTMLButtonElement, LoadingButtonProps>(
  ({ loading = false, disabled, endIcon, ...rest }, ref) => {
    const spinner = (
      <CircularProgress
        size={16}
        thickness={5}
        color="inherit"
      />
    );
    return (
      <Button
        {...rest}
        ref={ref}
        disabled={disabled}
        endIcon={loading ? spinner : endIcon}
        aria-busy={loading ? 'true' : undefined}
      />
    );
  }
);
LoadingButton.displayName = 'LoadingButton';

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
  const taskType = typeof record.taskType === 'string' ? record.taskType : undefined;
  return {
    total,
    completed,
    failed,
    skipped,
    percentage,
    taskType,
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
        id: 'fetch',
        title: t('processing.fetch.title', 'Fetch'),
        description: t('stage.stages.fetch.description', 'Fetch and normalize source data.'),
        icon: createElement(CloudDownloadIcon, { color: 'primary' }),
      },
      {
        id: 'transform',
        title: t('processing.transform.title', 'Transform'),
        description: t('stage.stages.transform.description', 'Simplify features per zoom band.'),
        icon: createElement(TuneIcon, { color: 'primary' }),
      },
      {
        id: 'vt',
        title: t('processing.vt.title', 'VT Generation'),
        description: t('stage.stages.vt.description', 'Generate vector tiles for the selected zoom range.'),
        icon: createElement(LayersIcon, { color: 'primary' }),
      },
    ],
    [t]
  );
};

const resolveRequestedAt = (session: BuildSessionSnapshot): number => session.updatedAt ?? 0;

export function BuildSessionLauncherPanel({
  nodeType,
  onNavigateToBuild,
  excludeNodeId,
}: BuildSessionLauncherPanelProps) {
  const { api } = useWorkerAPI();
  const { t } = useGlobalI18nTranslator();
  const { resolveIcon } = useIconRegistry();
  const { sessions, isRunnerTab, activeSessionId } = useBuildSessionSnapshots(nodeType);
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

  const refreshEntries = useCallback(async (sessionSnapshots: BuildSessionSnapshot[]) => {
    if (!api) {
      scheduleEntriesUpdate([]);
      return;
    }
    if (sessionSnapshots.length === 0) {
      scheduleEntriesUpdate([]);
      return;
    }
    const currentRefreshId = refreshIdRef.current + 1;
    refreshIdRef.current = currentRefreshId;
    const queryAPI = await api.getQueryAPI().catch(() => null);
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
    const nextEntries: BuildSessionLauncherEntry[] = sessionSnapshots.map((session) => {
      const nodeKey = String(session.nodeId);
      const cached = updatedCache.get(nodeKey);
      return {
        session,
        node: cached?.node ?? null,
        nodePath: cached?.nodePath ?? '',
      };
    }).sort((a, b) => {
      const aRequestedAt = resolveRequestedAt(a.session);
      const bRequestedAt = resolveRequestedAt(b.session);
      if (aRequestedAt !== bRequestedAt) return aRequestedAt - bRequestedAt;
      return a.nodePath.localeCompare(b.nodePath);
    });
    scheduleEntriesUpdate(nextEntries);
  }, [api, scheduleEntriesUpdate]);

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
      const stageId = progressSummary?.taskType;
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

  if (filteredEntries.length === 0) return null;
  return (
    <Card
      variant="outlined"
      sx={{
        px: 1,
        py: 0.5,
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
        {filteredEntries.map((entry) => {
          const nodeName = entry.node?.metadata?.name ?? String(entry.session.nodeId);
          const nodeTypeResolved = entry.node?.nodeType ?? 'folder';
          const nodePath = entry.nodePath || nodeName;
          const icon = resolveIcon({ nodeType: nodeTypeResolved });
          const isActive = isRunnerTab && activeSessionId === String(entry.session.nodeId);
          const variant = isRunnerTab ? 'outlined' : 'text';
          const color = isActive ? 'primary' : 'inherit';
          const countsText = t(
            'stage.progress.countsWithUnit',
            '{{percentage}}% ・ {{completed}}/{{total}} {{unit}} completed ・ failed {{failed}} ・ skipped {{skipped}}',
          );
          return (
            <Tooltip
              key={String(entry.session.nodeId)}
              arrow
              placement="bottom-end"
              title={
                <Box sx={{ minWidth: 320, maxWidth: 420 }}>
                  <Stack spacing={1}>
                    <Stack spacing={0.5}>
                      <Typography variant="caption" color="text.secondary">
                        {t('stage.progress.nodePath', 'Path')}
                      </Typography>
                      <Typography variant="body2">{nodePath}</Typography>
                    </Stack>
                    <Divider />
                    <Card variant="outlined">
                      <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
                          <Stack spacing={0.25} flex={1}>
                            <Typography variant="caption" color="text.secondary">
                              {t('stage.progress.stage', 'Stage')}
                            </Typography>
                            <Typography variant="body2">{entry.stageLabel}</Typography>
                          </Stack>
                          <Stack spacing={0.25} flex={1}>
                            <Typography variant="caption" color="text.secondary">
                              {entry.taskUnitLabel || t('stage.progress.task', 'Tasks')}
                            </Typography>
                            <Typography
                              variant="body2"
                              sx={{
                                overflow: 'hidden',
                                display: '-webkit-box',
                                WebkitBoxOrient: 'vertical',
                                WebkitLineClamp: 2,
                                lineHeight: 1.4,
                                minHeight: '2.8em',
                                maxHeight: '2.8em',
                              }}
                            >
                              {entry.taskLabel}
                            </Typography>
                          </Stack>
                        </Stack>
                        <Stack gap={1}>
                          <LinearProgress variant="determinate" value={entry.percentage} />
                          <Typography variant="caption" color="text.secondary">
                            {countsText
                              .replace('{{percentage}}', String(Math.round(entry.percentage)))
                              .replace('{{completed}}', String(entry.counts.completed))
                              .replace('{{total}}', String(entry.counts.total))
                              .replace('{{unit}}', entry.taskUnitLabel || t('stage.progress.task', 'Tasks'))
                              .replace('{{failed}}', String(entry.counts.failed))
                              .replace('{{skipped}}', String(entry.counts.skipped))}
                          </Typography>
                        </Stack>
                      </CardContent>
                    </Card>
                  </Stack>
                </Box>
              }
            >
              <Button
                size="small"
                variant={variant}
                color={color}
                startIcon={icon}
                onClick={(event) => handleOpenMenu(event, entry)}
              >
                {nodeName}
              </Button>
            </Tooltip>
          );
        })}
      </Stack>
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl && menuEntry)}
        onClose={handleCloseMenu}
      >
        <MenuItem
          disabled={!menuEntry || !onNavigateToBuild}
          onClick={() => {
            if (!menuEntry || !onNavigateToBuild) return;
            onNavigateToBuild(menuEntry);
            handleCloseMenu();
          }}
        >
          <ListItemIcon>
            <FolderOpenIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary={t('stage.progress.menu.open', 'Open')} />
        </MenuItem>
      </Menu>
    </Card>
  );
}
