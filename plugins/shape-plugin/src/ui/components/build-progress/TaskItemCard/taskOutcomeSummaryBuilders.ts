import type { ShapeBuildTaskSummary } from '~/ui/atoms/shapeBuildProgressTypes';
import { isTaskSkipped, resolveTaskMetadataMessage } from '~/common/utils/taskMessageUtils';
import { formatGeometrySimplifySummary, parseGeometrySimplifyError } from '~/ui/components/build-progress/geometrySimplifyError';
import { formatTaskDisplayMessage } from '~/ui/components/build-progress/formatTaskDisplayMessage';
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

  const vertexLimitValidationMessage = formatVertexLimitValidationMessage(task.metadata);
  const info = vertexLimitValidationMessage || resolveTaskMetadataMessage(task.metadata) || displayMessage || taskTitle;
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

const readMessageNumber = (message: string | null, patterns: RegExp[]): number | null => {
  if (!message) return null;
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (!match?.[1]) continue;
    const parsed = Number.parseFloat(match[1]);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const resolveRatio = (output: number | null, input: number | null): number | null => {
  if (output === null || input === null || input <= 0) return null;
  return Math.max(0, Math.min(1, output / input));
};

const formatVertexLimitValidationMessage = (metadata: Record<string, unknown> | undefined): string | null => {
  if (!metadata) return null;
  const raw = metadata.vertexLimitValidation;
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  const processed = readNumber(record.processedFeatures);
  const total = readNumber(record.totalFeatures);
  const overLimit = readNumber(record.overLimitFeatures);
  const maxVertices = readNumber(record.maxVertexCount);
  const limit = readNumber(record.retryVertexLimit);
  const tolerance = readNumber(record.effectiveTolerance);
  if (
    processed === null
    || total === null
    || overLimit === null
    || maxVertices === null
    || limit === null
    || tolerance === null
  ) {
    return null;
  }
  return `Vertex limit validate: ${Math.floor(processed)}/${Math.floor(total)} features, `
    + `over-limit ${Math.floor(overLimit)}, `
    + `max vertices ${Math.floor(maxVertices)}, `
    + `limit ${Math.floor(limit)}, `
    + `tol ${Number.parseFloat(tolerance.toFixed(6))}`;
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
    'fetchDetail.polygons.input',
    'fetchDetail.polygonsPerFeature.input',
  ]);
  const polygonsOutput = readMetadataNumber(task.metadata, [
    'fetchDetail.polygons.output',
    'fetchDetail.polygonsPerFeature.output',
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

  const vertexLimitValidationMessage = formatVertexLimitValidationMessage(task.metadata);
  const info = vertexLimitValidationMessage || resolveTaskMetadataMessage(task.metadata) || displayMessage || taskTitle;
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
    'finalTolerance',
    'finalEffectiveTolerance',
    'effectiveTolerance',
    'effective_tolerance',
    'metadata.finalTolerance',
    'metadata.finalEffectiveTolerance',
    'metadata.effectiveTolerance',
    'tolerance',
  ]);
  const effectiveTolerance = effectiveToleranceRaw;
  const effectiveToleranceText = effectiveTolerance === null
    ? 'N/A'
    : `${Number.parseFloat(effectiveTolerance.toFixed(6))}`;
  const baseTolerance = readMetadataNumber(task.metadata, [
    'baseTolerance',
    'fetchDetail.baseTolerance',
    'metadata.baseTolerance',
  ]);
  const initialTolerance = readMetadataNumber(task.metadata, [
    'initialTolerance',
    'metadata.initialTolerance',
  ]);

  const retryAttemptRaw = readMetadataNumber(task.metadata, [
    'finalRetryAttempts',
    'metadata.finalRetryAttempts',
    'retryAttempt',
    'metadata.retryAttempt',
  ]) ?? readNumber(task.retryAttempt);
  const retryAttempt = retryAttemptRaw !== null && retryAttemptRaw >= 0 ? Math.floor(retryAttemptRaw) : null;

  const retryMaxRaw = readMetadataNumber(task.metadata, [
    'retryMax',
    'finalRetryCount',
    'finalRetryLimit',
    'retryCount',
    'retryLimit',
    'maxRetryAttempts',
    'metadata.finalRetryCount',
    'metadata.finalRetryLimit',
    'metadata.retryMax',
    'metadata.retryCount',
    'metadata.retryLimit',
    'metadata.maxRetryAttempts',
  ]);
  const retryMax = retryMaxRaw !== null && retryMaxRaw >= 0 ? Math.floor(retryMaxRaw) : null;

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

  const sourceMetrics = {
    features: {
      input: readMetadataNumber(task.metadata, ['fetchDetail.features.input']),
      output: readMetadataNumber(task.metadata, ['fetchDetail.features.output']),
    },
    polygons: {
      input: readMetadataNumber(task.metadata, [
        'fetchDetail.polygons.input',
        'fetchDetail.polygonsPerFeature.input',
      ]),
      output: readMetadataNumber(task.metadata, [
        'fetchDetail.polygons.output',
        'fetchDetail.polygonsPerFeature.output',
      ]),
    },
  };
  const adminLevelRaw = readMetadataNumber(task.metadata, [
    'fetchDetail.adminLevel',
    'adminLevel',
    'metadata.adminLevel',
  ]);
  const adminLevel = adminLevelRaw !== null ? Math.floor(adminLevelRaw) : null;

  const maxPolygonVertices = {
    input: readMetadataNumber(task.metadata, [
      'maxPolygonVertices.input',
      'maxPolygonVertexCount.input',
      'largestPolygonVertices.input',
      'metadata.maxPolygonVertices.input',
      'metadata.maxPolygonVertexCount.input',
      'metadata.largestPolygonVertices.input',
    ]) ?? readMessageNumber(failedMessage, [/maxVertices=(\d+)/i]),
    output: readMetadataNumber(task.metadata, [
      'maxPolygonVertices.output',
      'maxPolygonVertexCount.output',
      'largestPolygonVertices.output',
      'metadata.maxPolygonVertices.output',
      'metadata.maxPolygonVertexCount.output',
      'metadata.largestPolygonVertices.output',
    ]) ?? readMessageNumber(failedMessage, [/finalVertexCount=(\d+)/i]),
  };

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
      summaryLine: `${translate('task.status.skipped', 'Skipped')}: ${compact(reason)}`,
      detailLines: [`${translate('task.status.reason', 'Reason')}: ${reason}`],
    };
  }

  if (kind === 'completed' || kind === 'failed') {
    if (retryAttempt === null) {
      throw new Error(`[shape-plugin] geometry retryAttempt is missing for terminal task: ${task.taskId}`);
    }
    if (retryMax === null) {
      throw new Error(`[shape-plugin] geometry retryMax is missing for terminal task: ${task.taskId}`);
    }
    const prefix = kind === 'failed' ? translate('task.status.failed', 'Failed') : translate('task.status.completed', 'Completed');
    const retryText = `${translate('task.status.attempt', 'Attempt')}: ${retryAttempt}/${retryMax}`;
    const summaryLine = `${prefix} (Tol: ${effectiveToleranceText}, ${retryText}, F/Pol/V: ${formatInt(metrics.features.output)}/${formatInt(metrics.polygons.output)}/${formatInt(metrics.vertices.output)})`;

    const detailLines = [
      `${translate('task.details.baseTolerance', 'Base Tolerance')}: ${baseTolerance === null ? 'N/A' : Number.parseFloat(baseTolerance.toFixed(6))}`,
      `${translate('task.details.initialTolerance', 'Initial Tolerance')}: ${initialTolerance === null ? 'N/A' : Number.parseFloat(initialTolerance.toFixed(6))}`,
      `${translate('task.details.effectiveTolerance', 'Effective Tolerance')}: ${effectiveToleranceText}`,
      `${translate('task.details.retryCount', 'Retry Count')}: ${retryAttempt} / ${retryMax}`,
      `${translate('task.details.finalDataSize', 'Final Data Size (F/Pol/V)')}: ${formatInt(metrics.features.output)} / ${formatInt(metrics.polygons.output)} / ${formatInt(metrics.vertices.output)}`,
      `${translate('task.details.originalDataSize', 'Original Data Size (F/Pol/V)')}: ${formatInt(metrics.features.input)} / ${formatInt(metrics.polygons.input)} / ${formatInt(metrics.vertices.input)}`,
      `${translate('task.details.vertexReductionRate', 'Vertex Reduction Rate')}: ${formatPercent(vertexReductionRate)}`,
      `${translate('task.details.extractionRate', 'Extraction Rate')}: ${formatPercent(extractionRatio)}`,
    ];
    if (vertexLimit !== null) {
      detailLines.push(`${translate('task.details.vertexLimit', 'Vertex Limit')}: ${formatInt(vertexLimit)}`);
    }
    if (kind === 'failed') {
      detailLines.push(`${translate('task.details.failureReason', 'Failure Reason')}: ${failedMessage ?? 'N/A'}`);
    }
    if (geometryDetails) {
      detailLines.push(...formatGeometrySimplifySummary(geometryDetails));
    }

    return {
      kind,
      visualization: 'transformMetrics',
      adminLevel,
      summaryLine,
      detailLines,
      baseTolerance,
      initialTolerance,
      effectiveTolerance,
      retryAttempt,
      retryMax,
      vertexReductionRate,
      metrics,
      sourceMetrics,
      maxPolygonVertices,
      vertexLimit,
    };
  }

  const vertexLimitValidationMessage = formatVertexLimitValidationMessage(task.metadata);
  const info = vertexLimitValidationMessage || resolveTaskMetadataMessage(task.metadata) || displayMessage || taskTitle;
  return {
    kind,
    visualization: 'none',
    adminLevel,
    summaryLine: info,
    detailLines: [info],
  };
};

export const buildFetchTaskOutcomeSummary = buildSourceTaskOutcomeSummary;
export const buildTransformTaskOutcomeSummary = buildGeometryTaskOutcomeSummary;
