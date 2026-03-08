// Performance and resource monitoring type definitions

export interface PerformanceMetrics {
  taskSnapshotGenerationTime: number;
  eventDeliveryLatency: number[];
  uiUpdateResponseTime: number[];
  memoryUsage: MemoryUsage;
  cpuUsage: CPUUsage;
}

export interface MemoryUsage {
  heapUsed: number; // bytes
  heapTotal: number; // bytes
  external: number; // bytes
  arrayBuffers: number; // bytes
  timestamp: number;
}

export interface CPUUsage {
  user: number; // microseconds
  system: number; // microseconds
  timestamp: number;
}

export interface ResourceUsage {
  peakMemoryMB: number;
  averageMemoryMB: number;
  cpuUtilizationPercent: number;
  eventBufferSize: number;
  subscriberCount: number;
}

export interface PerformanceConstraints {
  maxTaskSnapshotGenerationTimeMs: number;
  maxEventDeliveryLatencyMs: number;
  maxUIUpdateResponseTimeMs: number;
  maxMemoryUsageMB: number;
}

export interface ResourceLimits {
  maxMemoryMB: number;
  maxCpuPercent: number;
  maxEventBufferSize: number;
  maxSubscriberCount: number;
}

export interface PerformanceBenchmark {
  benchmarkId: string;
  scenario: string;
  metrics: PerformanceMetrics;
  constraints: PerformanceConstraints;
  passed: boolean;
  violations: PerformanceViolation[];
}

export interface PerformanceViolation {
  metric: string;
  expected: number;
  actual: number;
  severity: 'warning' | 'error' | 'critical';
}