export type BuildMonitorStage = string;

export type BuildMonitorSample<TStage extends BuildMonitorStage = BuildMonitorStage> = {
  timestamp: number;
  stage?: TStage;
  usedJSHeapSize?: number;
  totalJSHeapSize?: number;
  jsHeapSizeLimit?: number;
};

export type BuildMonitorRecord<
  TStage extends BuildMonitorStage = BuildMonitorStage,
  TConfig = unknown
> = {
  version: 1;
  nodeId?: string;
  buildStartedAt?: number;
  buildFinishedAt?: number;
  configSnapshot?: TConfig;
  samples: BuildMonitorSample<TStage>[];
};

export type CrashInsight<
  TStage extends BuildMonitorStage = BuildMonitorStage,
  TConfig = unknown
> = {
  stage?: TStage;
  peakRatio?: number;
  memoryPressure?: boolean;
  buildStartedAt: number;
  lastSampleAt?: number;
  configSnapshot?: TConfig;
};

export type HeapPressureSnapshot = {
  ratio: number;
  usedBytes: number;
  limitBytes: number;
  level: 'warning' | 'critical';
};

export type BuildMonitorKeyMode = 'node';

export type BuildMonitorConfig = {
  storagePrefix: string;
  maxSamples?: number;
  memoryPressureRatio?: number;
  heapWarningRatio?: number;
  heapCriticalRatio?: number;
};

type MemoryInfo = {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
};

export const BUILD_MONITOR_SAMPLE_INTERVAL_MS = 10000;

const DEFAULT_MAX_SAMPLES = 3;
const DEFAULT_MEMORY_PRESSURE_RATIO = 0.85;
const DEFAULT_HEAP_WARNING_RATIO = 0.85;
const DEFAULT_HEAP_CRITICAL_RATIO = 0.9;

const getLocalStorage = (): Storage | null => {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

export const getBuildMonitorKey = (
  config: BuildMonitorConfig,
  nodeId?: string | null,
): string | null => {
  if (!nodeId) return null;
  return `${config.storagePrefix}:${nodeId}`;
};

export const loadBuildMonitor = <
  TStage extends BuildMonitorStage = BuildMonitorStage,
  TConfig = unknown
>(
  config: BuildMonitorConfig,
  key: string,
): BuildMonitorRecord<TStage, TConfig> | null => {
  if (!key.startsWith(`${config.storagePrefix}:`)) return null;
  const storage = getLocalStorage();
  if (!storage) return null;
  const raw = storage.getItem(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as BuildMonitorRecord<TStage, TConfig>;
    if (!parsed || parsed.version !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const saveBuildMonitor = <
  TStage extends BuildMonitorStage = BuildMonitorStage,
  TConfig = unknown
>(
  config: BuildMonitorConfig,
  key: string,
  record: BuildMonitorRecord<TStage, TConfig>,
): void => {
  if (!key.startsWith(`${config.storagePrefix}:`)) return;
  const storage = getLocalStorage();
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(record));
  } catch {
    // Ignore storage quota errors.
  }
};

export const clearBuildMonitor = (config: BuildMonitorConfig, key: string): void => {
  if (!key.startsWith(`${config.storagePrefix}:`)) return;
  const storage = getLocalStorage();
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    // Ignore storage removal errors.
  }
};

export const recordBuildStart = <
  TStage extends BuildMonitorStage = BuildMonitorStage,
  TConfig = unknown
>(
  config: BuildMonitorConfig,
  key: string,
  payload: {
    nodeId?: string;
    startedAt: number;
    configSnapshot?: TConfig;
  },
): BuildMonitorRecord<TStage, TConfig> | null => {
  const existing = loadBuildMonitor<TStage, TConfig>(config, key);
  const record: BuildMonitorRecord<TStage, TConfig> = {
    version: 1,
    nodeId: payload.nodeId ?? existing?.nodeId,
    buildStartedAt: existing?.buildStartedAt ?? payload.startedAt,
    buildFinishedAt: undefined,
    configSnapshot: payload.configSnapshot ?? existing?.configSnapshot,
    samples: existing?.samples ?? [],
  };
  saveBuildMonitor(config, key, record);
  return record;
};

export const recordBuildFinish = <
  TStage extends BuildMonitorStage = BuildMonitorStage,
  TConfig = unknown
>(
  config: BuildMonitorConfig,
  key: string,
  finishedAt: number,
): BuildMonitorRecord<TStage, TConfig> | null => {
  const existing = loadBuildMonitor<TStage, TConfig>(config, key);
  if (!existing) return null;
  const record = {
    ...existing,
    buildFinishedAt: finishedAt,
  };
  saveBuildMonitor(config, key, record);
  return record;
};

export const appendBuildSample = <
  TStage extends BuildMonitorStage = BuildMonitorStage,
  TConfig = unknown
>(
  config: BuildMonitorConfig,
  key: string,
  sample: BuildMonitorSample<TStage>,
  maxSamples: number = config.maxSamples ?? DEFAULT_MAX_SAMPLES,
): BuildMonitorRecord<TStage, TConfig> | null => {
  const existing = loadBuildMonitor<TStage, TConfig>(config, key);
  const record: BuildMonitorRecord<TStage, TConfig> = existing ?? {
    version: 1,
    samples: [],
  };
  const nextSamples = [...record.samples, sample];
  const trimmed = nextSamples.length > maxSamples
    ? nextSamples.slice(nextSamples.length - maxSamples)
    : nextSamples;
  const nextRecord = { ...record, samples: trimmed };
  saveBuildMonitor(config, key, nextRecord);
  return nextRecord;
};

export const getMemorySnapshot = (): Partial<BuildMonitorSample> => {
  if (typeof performance === 'undefined') return {};
  const memory = (performance as Performance & { memory?: MemoryInfo }).memory;
  if (!memory) return {};
  return {
    usedJSHeapSize: memory.usedJSHeapSize,
    totalJSHeapSize: memory.totalJSHeapSize,
    jsHeapSizeLimit: memory.jsHeapSizeLimit,
  };
};

export const getHeapPressureSnapshot = (
  config: BuildMonitorConfig,
): HeapPressureSnapshot | null => {
  if (typeof performance === 'undefined') return null;
  const memory = (performance as Performance & { memory?: MemoryInfo }).memory;
  if (!memory || !memory.jsHeapSizeLimit) return null;
  const ratio = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
  const warningRatio = config.heapWarningRatio ?? DEFAULT_HEAP_WARNING_RATIO;
  const criticalRatio = config.heapCriticalRatio ?? DEFAULT_HEAP_CRITICAL_RATIO;
  if (!Number.isFinite(ratio) || ratio < warningRatio) return null;
  return {
    ratio,
    usedBytes: memory.usedJSHeapSize,
    limitBytes: memory.jsHeapSizeLimit,
    level: ratio >= criticalRatio ? 'critical' : 'warning',
  };
};

const resolvePeakMemory = <TStage extends BuildMonitorStage>(
  samples: BuildMonitorSample<TStage>[],
): { stage?: TStage; peakRatio?: number; lastSampleAt?: number } => {
  let peakRatio = 0;
  let stage: TStage | undefined;
  let lastSampleAt: number | undefined;
  for (const sample of samples) {
    if (!sample.jsHeapSizeLimit || !sample.usedJSHeapSize) continue;
    const ratio = sample.usedJSHeapSize / sample.jsHeapSizeLimit;
    if (ratio >= peakRatio) {
      peakRatio = ratio;
      stage = sample.stage;
      lastSampleAt = sample.timestamp;
    }
  }
  return {
    stage,
    peakRatio: peakRatio > 0 ? peakRatio : undefined,
    lastSampleAt,
  };
};

export const getCrashInsight = <
  TStage extends BuildMonitorStage = BuildMonitorStage,
  TConfig = unknown
>(
  config: BuildMonitorConfig,
  record: BuildMonitorRecord<TStage, TConfig> | null,
  processingStatus?: string | null,
): CrashInsight<TStage, TConfig> | null => {
  if (!record?.buildStartedAt || record.buildFinishedAt) return null;
  if (processingStatus === 'processing' || processingStatus === 'paused') return null;
  const { stage, peakRatio, lastSampleAt } = resolvePeakMemory(record.samples);
  const memoryPressureRatio = config.memoryPressureRatio ?? DEFAULT_MEMORY_PRESSURE_RATIO;
  const memoryPressure = Boolean(peakRatio && peakRatio >= memoryPressureRatio);
  return {
    stage,
    peakRatio,
    memoryPressure,
    buildStartedAt: record.buildStartedAt,
    lastSampleAt,
    configSnapshot: record.configSnapshot,
  };
};
