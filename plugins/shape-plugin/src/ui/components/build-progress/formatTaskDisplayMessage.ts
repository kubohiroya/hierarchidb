import type { TaskDisplayMetric, TaskDisplayPayload } from '@hierarchidb/build-api';

type Translate = (key: string, fallback?: string, options?: Record<string, unknown>) => string;

const numberFormatter = new Intl.NumberFormat('en-US');

const formatInt = (value: number): string => numberFormatter.format(Math.round(value));

const toCamelCase = (value: string): string => {
  const tokens = value.split(/[^A-Za-z0-9]+/).filter(Boolean);
  if (tokens.length === 0) return '';
  return tokens.map((token, index) => {
    if (index === 0) {
      return token.charAt(0).toLowerCase() + token.slice(1);
    }
    return token.charAt(0).toUpperCase() + token.slice(1);
  }).join('');
};

const toPhaseKey = (display: TaskDisplayPayload): string | null => {
  if (display.key) return display.key;
  if (!display.phaseCode || !display.phaseState) return null;
  const phaseKey = toCamelCase(display.phaseCode);
  if (!phaseKey) return null;
  const phaseState = display.phaseState.charAt(0).toUpperCase() + display.phaseState.slice(1);
  return `stage.taskPhase.${phaseKey}${phaseState}`;
};

const toPhaseFallback = (display: TaskDisplayPayload): string => {
  const phaseCode = (display.phaseCode ?? 'task')
    .replace(/[:_-]+/g, ' ')
    .trim()
    .toLowerCase();
  const phaseState = display.phaseState ?? 'progress';
  const base = `${phaseCode} ${phaseState}`.trim();
  if (display.phaseCode === 'retry-simplify-feature') {
    const attemptRaw = (display.params as Record<string, unknown> | undefined)?.attempt;
    const attempt = typeof attemptRaw === 'number'
      ? attemptRaw
      : typeof attemptRaw === 'string'
        ? Number.parseInt(attemptRaw, 10)
        : Number.NaN;
    if (Number.isFinite(attempt) && attempt > 0) {
      return `${base}: ${attempt}`;
    }
  }
  return base;
};

const formatRate = (metric: TaskDisplayMetric): string => {
  if (metric.input === metric.output) return '';
  if (metric.output === 0) return '';
  if (metric.input === 0) return '';
  const ratio = Math.round(((metric.output - metric.input) / metric.input) * 100);
  if (!Number.isFinite(ratio) || ratio === 0) return '';
  const sign = ratio > 0 ? '+' : '';
  return ` (${sign}${ratio}%)`;
};

const formatMetric = (label: string, metric: TaskDisplayMetric): string => (
  `${label}: ${formatInt(metric.input)} -> ${formatInt(metric.output)}${formatRate(metric)}`
);

const formatSummary = (
  metrics: TaskDisplayPayload['metrics'],
  t: Translate,
): string | null => {
  if (!metrics) return null;
  const entries: string[] = [];
  const ordered: Array<keyof NonNullable<TaskDisplayPayload['metrics']>> = ['features', 'polygons', 'vertices'];
  ordered.forEach((metricKey) => {
    const metric = metrics[metricKey];
    if (!metric) return;
    const label = t(`stage.taskSummary.${metricKey}Label`, metricKey);
    entries.push(formatMetric(label, metric));
  });
  return entries.length > 0 ? entries.join(', ') : null;
};

export const formatTaskDisplayMessage = (
  display: TaskDisplayPayload | undefined,
  t: Translate,
): string | null => {
  if (!display) return null;
  if (display.kind === 'phase') {
    const phaseKey = toPhaseKey(display);
    if (!phaseKey) return toPhaseFallback(display);
    return t(phaseKey, toPhaseFallback(display), display.params);
  }
  if (display.kind === 'summary') {
    const summary = formatSummary(display.metrics, t);
    if (summary) return summary;
    return t(display.key ?? 'stage.taskSummary.completed', 'Completed', display.params);
  }
  if (display.kind === 'skip') {
    return t(display.key ?? 'stage.taskSkip.generic', 'Skipped', display.params);
  }
  if (display.kind === 'error') {
    return t(display.key ?? 'stage.taskError.generic', 'Failed', display.params);
  }
  return t(display.key ?? 'stage.taskInfo.generic', 'Working', display.params);
};
