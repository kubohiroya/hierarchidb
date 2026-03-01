import type { ShapeBuildTaskSummary } from '~/ui/atoms/shapeBuildProgressAtoms';
import { isTaskSkipped, resolveTaskMetadataMessage } from '~/common/utils/taskMessages';
import { formatGeometrySimplifySummary, parseGeometrySimplifyError } from '~/ui/components/build-progress/geometrySimplifyError';
import { formatTaskDisplayMessage } from '~/ui/components/build-progress/taskDisplayText';
import type { TaskOutcomeSummary } from '~/ui/components/build-progress/TaskItem/TaskItem';

type Translate = (key: string, fallback?: string) => string;

export type TaskOutcomeSummaryBuilderContext = {
  task: ShapeBuildTaskSummary;
  stageId: string;
  taskTitle: string;
  translate: Translate;
};

export type TaskOutcomeSummaryBuilder = (
  context: TaskOutcomeSummaryBuilderContext,
) => TaskOutcomeSummary;

const numberFormatter = new Intl.NumberFormat('en-US');

const formatInt = (value: number | null): string => {
  if (value === null || !Number.isFinite(value)) return 'N/A';
  return numberFormatter.format(Math.round(value));
};

const formatPercent = (value: number | null): string => {
  if (value === null || !Number.isFinite(value)) return 'N/A';
  return `${Math.round(value * 1000) / 10}%`;
};

const readNumber = (rawValue: unknown): number | null => {
  if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
    return rawValue;
  }
  if (typeof rawValue === 'string') {
    const parsed = Number.parseFloat(rawValue);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const readMetadataNumber = (metadata: Record<string, unknown> | undefined, keys: string[]): number | null => {
  for (const key of keys) {
    const rawValue = key.split('.').reduce<unknown>((current, segment) => {
      if (!current || typeof current !== 'object') {
        return undefined;
      }
      return (current as Record<string, unknown>)[segment];
    }, metadata);
    const parsed = readNumber(rawValue);
    if (parsed !== null) return parsed;
  }
  return null;
};

const readDisplayMetric = (
  task: ShapeBuildTaskSummary,
  metric: 'features' | 'polygons' | 'vertices',
): { input: number | null; output: number | null } => {
  if (task.display?.kind !== 'summary') {
    return { input: null, output: null };
  }
  const target = task.display.metrics?.[metric];
  return {
    input: readNumber(target?.input),
    output: readNumber(target?.output),
  };
};

const resolveFailedMessage = (task: ShapeBuildTaskSummary): string | null => {
  const errorMessage = typeof task.errorMessage === 'string' ? task.errorMessage.trim() : '';
  const fallbackError = typeof task.error === 'string' ? task.error.trim() : '';
  const metadataMessage = resolveTaskMetadataMessage(task.metadata) ?? '';
  const failed = errorMessage || fallbackError || metadataMessage || '';
  return failed.length > 0 ? failed : null;
};

const compact = (value: string, max = 72): string => (value.length > max ? `${value.slice(0, max)}...` : value);

const resolveSummaryKind = (task: ShapeBuildTaskSummary): TaskOutcomeSummary['kind'] => {
  if (isTaskSkipped(task.display)) return 'skipped';
  if (task.status === 'completed') return 'completed';
  if (task.status === 'failed') return 'failed';
  return 'other';
};

export const buildSimpleTaskOutcomeSummary: TaskOutcomeSummaryBuilder = ({ task, taskTitle, translate }) => {
  const kind = resolveSummaryKind(task);
  const displayMessage = formatTaskDisplayMessage(task.display, translate);
  const failedMessage = resolveFailedMessage(task);

  if (kind === 'skipped') {
    const reason = (displayMessage || resolveTaskMetadataMessage(task.metadata) || taskTitle).trim();
    return {
      kind,
      visualization: 'none',
      summaryLine: `Skipped: ${compact(reason)}`,
      detailLines: [`Reason: ${reason}`],
    };
  }

  if (kind === 'failed') {
    const reason = failedMessage || displayMessage || taskTitle;
    return {
      kind,
      visualization: 'none',
      summaryLine: `Failed: ${compact(reason)}`,
      detailLines: [`Failure: ${reason}`],
    };
  }

  if (kind === 'completed') {
    const summary = displayMessage || 'Completed';
    return {
      kind,
      visualization: 'none',
      summaryLine: summary,
      detailLines: [summary],
    };
  }

  const info = displayMessage || resolveTaskMetadataMessage(task.metadata) || taskTitle;
  return {
    kind,
    visualization: 'none',
    summaryLine: info,
    detailLines: [info],
  };
};

const readMetadataString = (metadata: Record<string, unknown> | undefined, keys: string[]): string | null => {
  for (const key of keys) {
    const rawValue = key.split('.').reduce<unknown>((current, segment) => {
      if (!current || typeof current !== 'object') {
        return undefined;
      }
      return (current as Record<string, unknown>)[segment];
    }, metadata);
    if (typeof rawValue !== 'string') continue;
    const trimmed = rawValue.trim();
    if (trimmed.length > 0) return trimmed;
  }
  return null;
};

const resolveRatio = (output: number | null, input: number | null): number | null => {
  if (output === null || input === null || input <= 0) return null;
  return Math.max(0, Math.min(1, output / input));
};

export const buildSourceTaskOutcomeSummary: TaskOutcomeSummaryBuilder = ({ task, taskTitle, translate }) => {
  const kind = resolveSummaryKind(task);
  const displayMessage = formatTaskDisplayMessage(task.display, translate);
  const failedMessage = resolveFailedMessage(task);

  const countryName = readMetadataString(task.metadata, [
    'fetchDetail.countryName',
  ]);
  const countryCode = readMetadataString(task.metadata, [
    'fetchDetail.countryCode',
  ]);
  const adminLevelRaw = readMetadataNumber(task.metadata, [
    'fetchDetail.adminLevel',
  ]);
  const adminLevel = adminLevelRaw !== null ? Math.floor(adminLevelRaw) : null;
  const url = readMetadataString(task.metadata, [
    'fetchDetail.url',
  ]);

  const featuresInput = readMetadataNumber(task.metadata, [
    'fetchDetail.features.input',
  ]);
  const featuresOutput = readMetadataNumber(task.metadata, [
    'fetchDetail.features.output',
  ]);
  const polygonsInput = readMetadataNumber(task.metadata, [
    'fetchDetail.polygonsPerFeature.input',
    'fetchDetail.polygons.input',
  ]);
  const polygonsOutput = readMetadataNumber(task.metadata, [
    'fetchDetail.polygonsPerFeature.output',
    'fetchDetail.polygons.output',
  ]);
  const featuresRatio = resolveRatio(featuresOutput, featuresInput);
  const polygonsRatio = resolveRatio(polygonsOutput, polygonsInput);
  const hasSourceDetails = url !== null
    || featuresInput !== null
    || featuresOutput !== null
    || polygonsInput !== null
    || polygonsOutput !== null;

  if (kind === 'skipped') {
    const reason = (displayMessage || resolveTaskMetadataMessage(task.metadata) || taskTitle).trim();
    return {
      kind,
      visualization: 'none',
      summaryLine: `Skipped: ${compact(reason)}`,
      detailLines: [`Reason: ${reason}`],
    };
  }

  if (kind === 'failed') {
    const reason = failedMessage || displayMessage || taskTitle;
    return {
      kind,
      visualization: 'none',
      summaryLine: `Failed: ${compact(reason)}`,
      detailLines: [`Failure: ${reason}`],
    };
  }

  if (kind === 'completed') {
    const summaryLine = (
      featuresInput !== null
      && featuresOutput !== null
      && polygonsInput !== null
      && polygonsOutput !== null
    )
      ? `F ${formatInt(featuresOutput)}/${formatInt(featuresInput)} (${formatPercent(featuresRatio)}), `
        + `P ${formatInt(polygonsOutput)}/${formatInt(polygonsInput)} (${formatPercent(polygonsRatio)})`
      : (displayMessage || 'Completed');
    return {
      kind,
      visualization: hasSourceDetails ? 'fetchMetrics' : 'none',
      summaryLine,
      detailLines: [summaryLine],
      fetchDetails: {
        countryName,
        countryCode,
        adminLevel,
        url,
        features: { input: featuresInput, output: featuresOutput },
        polygons: { input: polygonsInput, output: polygonsOutput },
      },
    };
  }

  const info = displayMessage || resolveTaskMetadataMessage(task.metadata) || taskTitle;
  return {
    kind,
    visualization: hasSourceDetails ? 'fetchMetrics' : 'none',
    summaryLine: info,
    detailLines: [info],
    fetchDetails: {
      countryName,
      countryCode,
      adminLevel,
      url,
      features: { input: featuresInput, output: featuresOutput },
      polygons: { input: polygonsInput, output: polygonsOutput },
    },
  };
};

export const buildGeometryTaskOutcomeSummary: TaskOutcomeSummaryBuilder = ({ task, taskTitle, translate }) => {
  const kind = resolveSummaryKind(task);
  const displayMessage = formatTaskDisplayMessage(task.display, translate);
  const failedMessage = resolveFailedMessage(task);
  const geometryDetails = parseGeometrySimplifyError(failedMessage ?? undefined);

  const effectiveToleranceRaw = readMetadataNumber(task.metadata, [
    'effectiveTolerance',
    'effective_tolerance',
    'finalTolerance',
    'finalEffectiveTolerance',
    'metadata.effectiveTolerance',
    'metadata.finalTolerance',
    'tolerance',
  ]);
  const effectiveTolerance = effectiveToleranceRaw;
  const effectiveToleranceText = effectiveTolerance === null
    ? 'N/A'
    : `${Number.parseFloat(effectiveTolerance.toFixed(6))}`;

  const retryAttemptRaw = readNumber(task.retryAttempt ?? task.metadata?.retryAttempt ?? task.metadata?.retries ?? task.metadata?.attempts);
  const retryAttempt = retryAttemptRaw !== null && retryAttemptRaw >= 0 ? Math.floor(retryAttemptRaw) : null;

  const retryMaxRaw = readMetadataNumber(task.metadata, [
    'retryCount',
    'retryLimit',
    'maxRetryAttempts',
    'metadata.retryCount',
    'metadata.retryLimit',
    'metadata.maxRetryAttempts',
  ]);
  const retryMax = retryMaxRaw !== null && retryMaxRaw >= 0 ? Math.floor(retryMaxRaw) : 10;

  const metrics = {
    features: readDisplayMetric(task, 'features'),
    polygons: readDisplayMetric(task, 'polygons'),
    vertices: readDisplayMetric(task, 'vertices'),
  };

  const vertexReductionRate = (
    metrics.vertices.input !== null
    && metrics.vertices.input > 0
    && metrics.vertices.output !== null
  )
    ? Math.max(0, Math.min(1, (metrics.vertices.input - metrics.vertices.output) / metrics.vertices.input))
    : null;

  const extractionRatio = readMetadataNumber(task.metadata, [
    'extractionRatio',
    'metadata.extractionRatio',
  ]);

  const vertexLimit = (() => {
    const metadataLimit = readMetadataNumber(task.metadata, [
      'retryVertexLimit',
      'vertexLimit',
      'maxVerticesPerFeature',
      'metadata.retryVertexLimit',
      'metadata.vertexLimit',
      'metadata.maxVerticesPerFeature',
    ]);
    if (metadataLimit !== null && metadataLimit > 0) return metadataLimit;
    const source = failedMessage || resolveTaskMetadataMessage(task.metadata) || '';
    const match = source.match(/limit=(\d+)/i);
    if (!match) return null;
    const parsed = Number.parseInt(match[1] ?? '', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  })();

  if (kind === 'skipped') {
    const reason = (displayMessage || resolveTaskMetadataMessage(task.metadata) || taskTitle).trim();
    return {
      kind,
      visualization: 'none',
      summaryLine: `Skipped: ${compact(reason)}`,
      detailLines: [`Reason: ${reason}`],
    };
  }

  if (kind === 'completed' || kind === 'failed') {
    const prefix = kind === 'failed' ? 'Failed(final)' : 'Completed';
    const vertexReductionText = vertexReductionRate === null ? 'N/A' : `-${formatPercent(vertexReductionRate)}`;
    const summaryLine = `${prefix}: Tol ${effectiveToleranceText}, Retry ${retryAttempt ?? 'N/A'}/${retryMax ?? 'N/A'}, `
      + `F/P/V ${formatInt(metrics.features.output)}/${formatInt(metrics.polygons.output)}/${formatInt(metrics.vertices.output)}, `
      + `Vertex ${vertexReductionText}`;

    const detailLines = [
      `Effective tolerance: ${effectiveToleranceText}`,
      `Retry attempts: ${retryAttempt ?? 'N/A'} / ${retryMax ?? 'N/A'}`,
      `Final data size (F/P/V): ${formatInt(metrics.features.output)} / ${formatInt(metrics.polygons.output)} / ${formatInt(metrics.vertices.output)}`,
      `Original data size (F/P/V): ${formatInt(metrics.features.input)} / ${formatInt(metrics.polygons.input)} / ${formatInt(metrics.vertices.input)}`,
      `Vertex reduction: ${formatPercent(vertexReductionRate)}`,
      `Extraction ratio: ${formatPercent(extractionRatio)}`,
    ];
    if (vertexLimit !== null) {
      detailLines.push(`Vertex limit: ${formatInt(vertexLimit)}`);
    }
    if (kind === 'failed') {
      detailLines.push(`Failure: ${failedMessage ?? 'N/A'}`);
    }
    if (geometryDetails) {
      detailLines.push(...formatGeometrySimplifySummary(geometryDetails));
    }

    return {
      kind,
      visualization: 'transformMetrics',
      summaryLine,
      detailLines,
      effectiveTolerance,
      retryAttempt,
      retryMax,
      vertexReductionRate,
      metrics,
      vertexLimit,
    };
  }

  const info = displayMessage || resolveTaskMetadataMessage(task.metadata) || taskTitle;
  return {
    kind,
    visualization: 'none',
    summaryLine: info,
    detailLines: [info],
  };
};

export const buildFetchTaskOutcomeSummary = buildSourceTaskOutcomeSummary;
export const buildTransformTaskOutcomeSummary = buildGeometryTaskOutcomeSummary;
