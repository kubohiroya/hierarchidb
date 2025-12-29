export type HeapPressureLevel = 'warning' | 'critical';
export type HeapPressureSource = 'ui' | 'worker';

export type HeapPressureContext = {
  nodeType?: string;
  nodeId?: string;
};

export type HeapPressureEvent = {
  source: HeapPressureSource;
  level: HeapPressureLevel;
  ratio: number;
  usedBytes: number;
  limitBytes: number;
  timestamp: number;
  context?: HeapPressureContext;
};

export type HeapPressureMonitorOptions = {
  source?: HeapPressureSource;
  intervalMs?: number;
  warningRatio?: number;
  criticalRatio?: number;
};

export type HeapPressureMonitor = {
  start(): void;
  stop(): void;
  subscribe(listener: (event: HeapPressureEvent) => void): () => void;
  setContext(context: HeapPressureContext | null): void;
  getSnapshot(): HeapPressureEvent | null;
  isSupported(): boolean;
};

type MemoryInfo = {
  usedJSHeapSize: number;
  jsHeapSizeLimit: number;
};

const DEFAULT_INTERVAL_MS = 10_000;
const DEFAULT_WARNING_RATIO = 0.85;
const DEFAULT_CRITICAL_RATIO = 0.9;

const getHeapMemoryInfo = (): MemoryInfo | null => {
  if (typeof performance === 'undefined') return null;
  const memory = (performance as Performance & { memory?: MemoryInfo }).memory;
  if (!memory || !memory.jsHeapSizeLimit) return null;
  return memory;
};

export const createHeapPressureMonitor = (
  options: HeapPressureMonitorOptions = {}
): HeapPressureMonitor => {
  const {
    source = 'ui',
    intervalMs = DEFAULT_INTERVAL_MS,
    warningRatio = DEFAULT_WARNING_RATIO,
    criticalRatio = DEFAULT_CRITICAL_RATIO,
  } = options;

  const listeners = new Set<(event: HeapPressureEvent) => void>();
  let context: HeapPressureContext | null = null;
  let timerId: ReturnType<typeof setInterval> | null = null;
  let lastEvent: HeapPressureEvent | null = null;

  const isSupported = () => getHeapMemoryInfo() !== null;

  const emit = (event: HeapPressureEvent) => {
    lastEvent = event;
    listeners.forEach((listener) => listener(event));
  };

  const tick = () => {
    const memory = getHeapMemoryInfo();
    if (!memory) {
      lastEvent = null;
      return;
    }
    const ratio = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
    if (!Number.isFinite(ratio) || ratio < warningRatio) {
      lastEvent = null;
      return;
    }
    const level: HeapPressureLevel = ratio >= criticalRatio ? 'critical' : 'warning';
    emit({
      source,
      level,
      ratio,
      usedBytes: memory.usedJSHeapSize,
      limitBytes: memory.jsHeapSizeLimit,
      timestamp: Date.now(),
      context: context ?? undefined,
    });
  };

  return {
    start() {
      if (timerId) return;
      if (!isSupported()) {
        lastEvent = null;
        return;
      }
      tick();
      timerId = setInterval(tick, Math.max(intervalMs, 1000));
    },
    stop() {
      if (timerId) {
        clearInterval(timerId);
        timerId = null;
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setContext(next) {
      context = next;
    },
    getSnapshot() {
      return lastEvent;
    },
    isSupported,
  };
};
