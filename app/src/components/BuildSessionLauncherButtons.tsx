import { createElement, useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  LinearProgress,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import type { BuildStage } from '@hierarchidb/components';
import type { NodeId, NodeType, TreeId } from '@hierarchidb/core-types';
import { useGlobalI18nTranslator } from '@hierarchidb/ui-i18n';
import { useIconRegistry } from '@hierarchidb/ui-icon';
import type { TreeNode } from '@hierarchidb/tree-api';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import {
  CloudDownload as CloudDownloadIcon,
  Layers as LayersIcon,
  Tune as TuneIcon,
} from '@mui/icons-material';
import type { ShapeBuildSessionRecord } from '@hierarchidb/shape-api';
import { proxy } from 'comlink';
import { useWorker } from '~/contexts/WorkerProvider.js';
import { startBuildFlow } from '~/router/pages/tree/console/buildFlow.ts';

type BuildSessionLauncherButtonsProps = {
  treeId?: TreeId;
  pageNodeId?: NodeId;
};

type BuildSessionEntry = {
  session: ShapeBuildSessionRecord;
  node: TreeNode | null;
  nodePath: string;
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

const LoadingButton = ({ loading = false, disabled, endIcon, ...rest }: LoadingButtonProps) => {
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
      disabled={disabled}
      endIcon={loading ? spinner : endIcon}
      aria-busy={loading ? 'true' : undefined}
    />
  );
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

export function BuildSessionLauncherButtons({ treeId, pageNodeId }: BuildSessionLauncherButtonsProps) {
  const navigate = useNavigate();
  const { client: workerClient } = useWorker();
  const { t } = useGlobalI18nTranslator();
  const { resolveIcon } = useIconRegistry();
  const shapeNodeType = 'shape' as NodeType;
  const stages = useBuildStages(t);
  const stageById = useMemo(() => new Map(stages.map((stage) => [stage.id, stage])), [stages]);
  const [entries, setEntries] = useState<BuildSessionEntry[]>([]);
  const nodeCacheRef = useRef<Map<string, { node: TreeNode | null; nodePath: string }>>(new Map());
  const location = useRouterState({ select: (state) => state.location });
  const returnTo = useMemo(() => `${location.pathname}${location.searchStr ?? ''}`, [location.pathname, location.searchStr]);

  useEffect(() => {
    if (!workerClient) {
      setEntries([]);
      return;
    }
    let active = true;
    let unsubscribe: (() => void) | null = null;
    const subscribe = async () => {
      const queryAPI = await workerClient.getQueryAPI().catch(() => null);
      if (!queryAPI) return;
      const unsub = await workerClient.subscribeBuildSessionRecordsByStatus(
        shapeNodeType,
        ['running'],
        proxy(async (sessions: ShapeBuildSessionRecord[]) => {
          if (!active) return;
          const nodeIds = Array.from(new Set(sessions.map((session) => String(session.nodeId))));
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
          nodeCacheRef.current = updatedCache;
          const nextEntries = sessions.map((session) => {
            const nodeKey = String(session.nodeId);
            const cached = updatedCache.get(nodeKey);
            return {
              session,
              node: cached?.node ?? null,
              nodePath: cached?.nodePath ?? '',
            };
          });
          setEntries(nextEntries);
        })
      );
      unsubscribe = () => {
        if (typeof unsub === 'function') {
          unsub();
        }
      };
    };
    void subscribe();
    return () => {
      active = false;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [workerClient]);

  const handleNavigateToBuild = useCallback(
    async (entry: BuildSessionEntry) => {
      if (!treeId || !pageNodeId || !workerClient) return;
      if (!entry.node?.id) return;
      await startBuildFlow({
        treeId,
        pageNodeId,
        node: entry.node,
        returnTo,
        workerClient,
        navigate: (to) => navigate({ to }),
      });
    },
    [navigate, pageNodeId, returnTo, treeId, workerClient]
  );

  const resolvedEntries = useMemo(() => {
    return entries.map((entry) => {
      const progressSummary = isProgressSummary(entry.session.progress)
        ? entry.session.progress
        : null;
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
      const status = entry.session.status ?? 'idle';
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

  if (resolvedEntries.length === 0) return null;

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
        {resolvedEntries.map((entry) => {
          const nodeName = entry.node?.metadata?.name ?? String(entry.session.nodeId);
          const nodeType = entry.node?.nodeType ?? 'folder';
          const nodePath = entry.nodePath || nodeName;
          const icon = resolveIcon({ nodeType });
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
              <LoadingButton
                loading
                size="small"
                variant="outlined"
                startIcon={icon}
                onClick={() => handleNavigateToBuild(entry)}
              >
                {nodeName}
              </LoadingButton>
            </Tooltip>
          );
        })}
      </Stack>
    </Card>
  );
}
