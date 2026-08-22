import type { BuildStatus as CanonicalBuildStatus } from '@hierarchidb/build-api';
import type { NodeId } from '@hierarchidb/core-types';
import type { RouteEntity, RouteTransportSelection } from '@hierarchidb/route-api';
import {
  type BuildStage,
  resolveBuildStages,
  type BuildStatus as UiBuildStatus,
} from '@hierarchidb/ui-build-progress';
import { CheckCircle } from '@mui/icons-material';
import { createElement } from 'react';
import { PLUGIN_NODE_TYPE } from '~/plugin-manifest';

const ROUTE_STAGE_IDS = ['source', 'geometry', 'tileEmit'] as const;
export type RouteBuildStageId = (typeof ROUTE_STAGE_IDS)[number];

type Translate = (key: string, fallback?: string) => string;

type RouteProgressSnapshot = {
  stage: string;
  percentage: number;
};

const TRANSPORT_SELECTION_LABELS: Record<
  RouteTransportSelection,
  { key: string; fallback: string }
> = {
  air: { key: 'transportModes.air', fallback: 'Air' },
  sea: { key: 'transportModes.sea', fallback: 'Sea' },
  rail: { key: 'transportModes.rail', fallback: 'Rail' },
  'high-speed-rail': {
    key: 'transportModes.highSpeedRail',
    fallback: 'High-speed rail',
  },
  highway: { key: 'transportModes.highway', fallback: 'Highway' },
  road: { key: 'transportModes.road', fallback: 'General road' },
};

const resolveStageId = (value: unknown): RouteBuildStageId => {
  if (value === 'source' || value === 'geometry' || value === 'tileEmit') return value;
  throw new Error(`[routeBuildUiAdapter] unsupported canonical stage: ${String(value)}`);
};

const requireStagePercentage = (value: number): number => {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(
      `[routeBuildUiAdapter] canonical stage progress must be finite 0..100: ${String(value)}`
    );
  }
  return value;
};

const resolveUiBuildStatus = (status: CanonicalBuildStatus | undefined): UiBuildStatus => {
  if (status === undefined || status === 'idle' || status === 'queued') return 'idle';
  if (
    status === 'running' ||
    status === 'paused' ||
    status === 'completed' ||
    status === 'failed'
  ) {
    return status;
  }
  throw new Error(`[routeBuildUiAdapter] unsupported canonical session status: ${status}`);
};

const resolveOverallProgress = (
  status: UiBuildStatus,
  progress: RouteProgressSnapshot | null
): number => {
  if (status === 'completed') return 100;
  if (!progress) return 0;
  const stageId = resolveStageId(progress.stage);
  const stageIndex = ROUTE_STAGE_IDS.indexOf(stageId);
  const stagePercentage = requireStagePercentage(progress.percentage);
  return ((stageIndex + stagePercentage / 100) / ROUTE_STAGE_IDS.length) * 100;
};

const resolveStageProgress = (
  status: UiBuildStatus,
  progress: RouteProgressSnapshot | null
): Record<RouteBuildStageId, number> => {
  const activeStageId = progress ? resolveStageId(progress.stage) : null;
  const activeIndex = activeStageId ? ROUTE_STAGE_IDS.indexOf(activeStageId) : -1;
  const activePercentage = progress ? requireStagePercentage(progress.percentage) : 0;
  return Object.fromEntries(
    ROUTE_STAGE_IDS.map((stageId, index) => {
      if (status === 'completed' || index < activeIndex) return [stageId, 100];
      if (index > activeIndex || !progress) return [stageId, 0];
      return [stageId, activePercentage];
    })
  ) as Record<RouteBuildStageId, number>;
};

const resolveStages = (t: Translate): BuildStage[] =>
  resolveBuildStages({
    t,
    includeDescriptions: true,
    overrides: {
      source: {
        title: t('processing.source.title', 'Source'),
        description: t(
          'build.stages.source.description',
          'Generate and persist canonical route source artifacts.'
        ),
      },
      geometry: {
        title: t('processing.geometry.title', 'Geometry'),
        description: t(
          'build.stages.geometry.description',
          'Build geometry cache and the tile transpose index.'
        ),
      },
      tileEmit: {
        title: t('processing.tileEmit.title', 'TileEmit'),
        description: t(
          'build.stages.tileEmit.description',
          'Generate and persist canonical route vector tiles.'
        ),
        icon: createElement(CheckCircle),
      },
    },
  });

const isTransportSelection = (value: unknown): value is RouteTransportSelection =>
  typeof value === 'string' && value in TRANSPORT_SELECTION_LABELS;

const resolveTransportLabel = (draft: Partial<RouteEntity>, t: Translate): string => {
  const selection = draft.transportSelection;
  if (selection == null) return t('build.notConfigured', 'Not configured');
  if (!isTransportSelection(selection)) {
    throw new Error(`Unsupported transportSelection: ${String(selection)}`);
  }
  const entry = TRANSPORT_SELECTION_LABELS[selection];
  return t(entry.key, entry.fallback);
};

const hasRequiredFields = (nodeId: NodeId | null, draft: Partial<RouteEntity>): boolean =>
  Boolean(
    nodeId &&
      draft.buildConfig &&
      draft.routeMode &&
      draft.startLocationId &&
      draft.endLocationId &&
      Array.isArray(draft.lineGeometry) &&
      draft.lineGeometry.length >= 2
  );

export const routeBuildUiAdapter = {
  nodeType: PLUGIN_NODE_TYPE,
  stageIds: ROUTE_STAGE_IDS,
  defaultActiveStageId: 'source' as const,
  subscriptionTransport: 'worker' as const,
  commandTransport: {
    kind: 'worker' as const,
    nodeType: PLUGIN_NODE_TYPE,
  },
  resolveStageId,
  resolveUiBuildStatus,
  resolveOverallProgress,
  resolveStageProgress,
  resolveStages,
  resolveTransportLabel,
  hasRequiredFields,
};
