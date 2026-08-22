import type { BuildStatus as CanonicalBuildStatus } from '@hierarchidb/build-api';
import type { NodeId } from '@hierarchidb/core-types';
import type { BuildStage, BuildStatus as UiBuildStatus } from '@hierarchidb/ui-build-progress';
import { CloudDownload } from '@mui/icons-material';
import { createElement } from 'react';
import type { LocationEntity } from '~/common/types/index.js';
import { PLUGIN_MANIFEST } from '~/plugin-manifest.js';
import { canonicalBuildAPI } from '~/worker/canonicalBuildAPI.js';

const LOCATION_STAGE_IDS = ['source'] as const;
export type LocationBuildStageId = (typeof LOCATION_STAGE_IDS)[number];

type Translate = (key: string, fallback?: string) => string;

type LocationProgressSnapshot = {
  stage: string;
  percentage: number;
};

const resolveStageId = (value: unknown): LocationBuildStageId => {
  if (value === 'source') return value;
  throw new Error(`[locationBuildUiAdapter] unsupported canonical stage: ${String(value)}`);
};

const requireStagePercentage = (value: number): number => {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(
      `[locationBuildUiAdapter] canonical stage progress must be finite 0..100: ${String(value)}`
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
  throw new Error(`[locationBuildUiAdapter] unsupported canonical session status: ${status}`);
};

const resolveOverallProgress = (
  status: UiBuildStatus,
  progress: LocationProgressSnapshot | null
): number => {
  if (status === 'completed') return 100;
  if (!progress) return 0;
  resolveStageId(progress.stage);
  return requireStagePercentage(progress.percentage);
};

const resolveStageProgress = (
  status: UiBuildStatus,
  progress: LocationProgressSnapshot | null
): Record<LocationBuildStageId, number> => ({
  source: resolveOverallProgress(status, progress),
});

const resolveStages = (t: Translate): BuildStage[] => [
  {
    id: 'source',
    title: t('batch.stages.source', 'Source'),
    description: t(
      'build.stages.source.description',
      'Download and persist selected location source records.'
    ),
    icon: createElement(CloudDownload, { color: 'primary' }),
  },
];

const hasRequiredFields = (nodeId: NodeId | null, draft: Partial<LocationEntity> | null): boolean =>
  Boolean(
    nodeId &&
      draft?.dataSource &&
      Number.isInteger(draft.concurrentDownloads) &&
      (draft.concurrentDownloads as number) > 0 &&
      draft.selectedArrayByCountries &&
      Object.values(draft.selectedArrayByCountries).some(
        (row) => Array.isArray(row) && row.some((selected) => selected === true)
      )
  );

const createCommandTransport = (draft: Partial<LocationEntity> | null) => ({
  kind: 'same-realm' as const,
  commands: {
    startBuildSession: (nodeId: NodeId) =>
      canonicalBuildAPI.startBuildSession({ nodeId, draftData: draft ?? {} }),
    pauseBuildSession: (nodeId: NodeId, reason?: string) =>
      canonicalBuildAPI.pauseBuildSession(nodeId, reason),
    cancelQueuedBuildSession: (nodeId: NodeId, reason?: string) =>
      canonicalBuildAPI.cancelQueuedBuildSession(nodeId, reason),
  },
});

export const locationBuildUiAdapter = {
  nodeType: PLUGIN_MANIFEST.nodeType,
  stageIds: LOCATION_STAGE_IDS,
  defaultActiveStageId: 'source' as const,
  subscriptionTransport: 'same-realm' as const,
  resolveStageId,
  resolveUiBuildStatus,
  resolveOverallProgress,
  resolveStageProgress,
  resolveStages,
  hasRequiredFields,
  createCommandTransport,
};
