export type BuildMonitorStage = 'fetch' | 'parse' | 'waypoints' | 'save' | 'build';

export type BuildConfigSnapshot = {
  fetchWorkers?: number;
  parseWorkers?: number;
  waypointWorkers?: number;
  saveWorkers?: number;
};

export type BuildMonitorSample = {
  timestamp: number;
  stage?: BuildMonitorStage;
  usedJSHeapSize?: number;
  totalJSHeapSize?: number;
  jsHeapSizeLimit?: number;
};

export type BuildMonitorRecord = {
  version: 1;
  nodeId?: string;
  buildStartedAt?: number;
  buildFinishedAt?: number;
  configSnapshot?: BuildConfigSnapshot;
  samples: BuildMonitorSample[];
};

export type CrashInsight = {
  stage?: BuildMonitorStage;
  peakRatio?: number;
  memoryPressure?: boolean;
  buildStartedAt: number;
  lastSampleAt?: number;
  configSnapshot?: BuildConfigSnapshot;
};

type MemoryInfo = {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
};

const STORAGE_PREFIX = 'hdb:route:build-monitor';
export const BUILD_MONITOR_SAMPLE_INTERVAL_MS = 10000;
const MAX_SAMPLES = 3;
const MEMORY_PRESSURE_RATIO = 0.85;

const getLocalStorage = (): Storage | null => {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

export const getBuildMonitorKey = (nodeId?: string | null): string | null => {
  if (!nodeId) return null;
  return `${STORAGE_PREFIX}:${nodeId}`;
};

export const loadBuildMonitor = (key: string): BuildMonitorRecord | null => {
  const storage = getLocalStorage();
  if (!storage) return null;
  const raw = storage.getItem(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as BuildMonitorRecord;
    if (!parsed || parsed.version !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const saveBuildMonitor = (key: string, record: BuildMonitorRecord): void => {
  const storage = getLocalStorage();
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(record));
  } catch {
    // Ignore storage quota errors.
  }
};

export const clearBuildMonitor = (key: string): void => {
  const storage = getLocalStorage();
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    // Ignore storage removal errors.
  }
};

export const recordBuildStart = (
  key: string,
  payload: {
    nodeId?: string;
    startedAt: number;
    configSnapshot?: BuildConfigSnapshot;
  },
): BuildMonitorRecord | null => {
  const existing = loadBuildMonitor(key);
  const record: BuildMonitorRecord = {
    version: 1,
    nodeId: payload.nodeId ?? existing?.nodeId,
    buildStartedAt: existing?.buildStartedAt ?? payload.startedAt,
    buildFinishedAt: undefined,
    configSnapshot: payload.configSnapshot ?? existing?.configSnapshot,
    samples: existing?.samples ?? [],
  };
  saveBuildMonitor(key, record);
  return record;
};

export const recordBuildFinish = (key: string, finishedAt: number): BuildMonitorRecord | null => {
  const existing = loadBuildMonitor(key);
  if (!existing) return null;
  const record = {
    ...existing,
    buildFinishedAt: finishedAt,
  };
  saveBuildMonitor(key, record);
  return record;
};

export const appendBuildSample = (
  key: string,
  sample: BuildMonitorSample,
  maxSamples: number = MAX_SAMPLES,
): BuildMonitorRecord | null => {
  const existing = loadBuildMonitor(key);
  const record: BuildMonitorRecord = existing ?? {
    version: 1,
    samples: [],
  };
  const nextSamples = [...record.samples, sample];
  const trimmed = nextSamples.length > maxSamples
    ? nextSamples.slice(nextSamples.length - maxSamples)
    : nextSamples;
  const nextRecord = { ...record, samples: trimmed };
  saveBuildMonitor(key, nextRecord);
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

const resolvePeakMemory = (samples: BuildMonitorSample[]): { stage?: BuildMonitorStage; peakRatio?: number; lastSampleAt?: number } => {
  let peakRatio = 0;
  let stage: BuildMonitorStage | undefined;
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

export const getCrashInsight = (
  record: BuildMonitorRecord | null,
  processingStatus?: string | null,
): CrashInsight | null => {
  if (!record?.buildStartedAt || record.buildFinishedAt) return null;
  if (processingStatus === 'processing' || processingStatus === 'paused') return null;
  const { stage, peakRatio, lastSampleAt } = resolvePeakMemory(record.samples);
  const memoryPressure = Boolean(peakRatio && peakRatio >= MEMORY_PRESSURE_RATIO);
  return {
    stage,
    peakRatio,
    memoryPressure,
    buildStartedAt: record.buildStartedAt,
    lastSampleAt,
    configSnapshot: record.configSnapshot,
  };
};
