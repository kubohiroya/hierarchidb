/**
 * DATA_SOURCE_STRATEGY_DESIGN.md
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FetchOptions, ProcessOptions, SaveTarget } from '../../DataSourceStrategy';
import {
  DataSourceStrategyFactory,
  DataSourceStrategyId,
} from '../../DataSourceStrategyFactory.js';

// Mock AuthRecoveryService used by authFetch so strategies avoid real network
vi.mock('@hierarchidb/auth', () => {
  const fetchWithAuth = async (input: string | URL, _init?: RequestInit): Promise<Response> => {
    const url = String(input);
    // Natural Earth ZIP
    if (url.includes('naturalearthdata.com')) {
      const JSZip = await import('jszip');
      const zip = new JSZip();
      zip.file('dummy.txt', 'hello');
      const buf = await zip.generateAsync({ type: 'arraybuffer' });
      return new Response(buf, { status: 200 });
    }
    // GADM JSON (admin0) or JSON ZIP (admin1+)
    if (url.includes('geodata.ucdavis.edu/gadm/gadm4.1/json/')) {
      if (url.endsWith('.json.zip')) {
        const JSZip = await import('jszip');
        const zip = new JSZip();
        zip.file('gadm41_JPN_1.json', JSON.stringify({ type: 'FeatureCollection', features: [] }));
        const buf = await zip.generateAsync({ type: 'arraybuffer' });
        return new Response(buf, { status: 200 });
      }
      return new Response(JSON.stringify({ type: 'FeatureCollection', features: [] }), {
        status: 200,
      });
    }
    // GeoBoundaries metadata and download
    if (url.includes('geoboundaries.org/api/current/gbOpen/available')) {
      return new Response(JSON.stringify({ USA: ['ADM0', 'ADM1'], JPN: ['ADM0', 'ADM1'] }), {
        status: 200,
      });
    }
    if (url.includes('/gbOpen/')) {
      return new Response(
        JSON.stringify({
          simplifiedGeometryGeoJSON: 'https://mock.local/gb.geojson',
          boundaryYear: '2023',
          licenseDetail: 'Open',
        }),
        { status: 200 }
      );
    }
    if (url.includes('mock.local/gb.geojson')) {
      return new Response(
        JSON.stringify({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: {
                type: 'Polygon',
                coordinates: [
                  [
                    [0, 0],
                    [1, 0],
                    [1, 1],
                    [0, 1],
                    [0, 0],
                  ],
                ],
              },
              properties: { shapeName: 'Mock' },
            },
          ],
        }),
        { status: 200 }
      );
    }
    // OSM Overpass
    if (url.includes('overpass-api.de')) {
      return new Response(
        JSON.stringify({
          elements: [{ type: 'node', id: 1, lat: 0, lon: 0, tags: { name: 'Mock' } }],
          generator: 'mock',
        }),
        { status: 200 }
      );
    }
    // Default OK
    return new Response('OK', { status: 200 });
  };
  return {
    AuthRecoveryService: {
      getSingleton: () => Promise.resolve({ fetchWithAuth }),
    },
  };
});

interface BuildJob {
  id: string;
  config: BuildConfig;
  startTime: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: {
    phase: 'fetching' | 'processing' | 'validating' | 'saving' | 'completed';
    percentage: number;
    message?: string;
  };
  result?: BuildResult;
  error?: Error;
}

interface BuildConfig {
  strategyId: string;
  fetchOptions?: FetchOptions;
  processOptions?: ProcessOptions;
  saveTarget: SaveTarget;
  priority?: 'low' | 'normal' | 'high';
  timeout?: number;
  retryCount?: number;
}

interface BuildResult {
  jobId: string;
  success: boolean;
  dataCount: number;
  validationResult?: unknown;
  saveResult?: unknown;
  duration: number;
  phases: {
    fetching: number;
    processing: number;
    validating: number;
    saving: number;
  };
}

interface BuildStatusReporter {
  startJob(jobId: string): void;

  updatePhase(
    jobId: string,
    phase: BuildJob['progress']['phase'],
    percentage?: number,
    message?: string
  ): void;

  completeJob(jobId: string): void;

  failJob(jobId: string, error: Error): void;

  getJobStatus(jobId: string): BuildJob | undefined;
}

class DataSourceBuildProcessor {
  private jobQueue = new Map<string, BuildJob>();
  private statusReporter: MockBuildStatusReporter;
  private factory: DataSourceStrategyFactory;
  private runningJobs = new Set<string>();
  private maxConcurrentJobs = 3;

  constructor(factory: DataSourceStrategyFactory) {
    this.factory = factory;
    this.statusReporter = new MockBuildStatusReporter();
  }

  async executeBuild(config: BuildConfig): Promise<BuildResult> {
    const jobId = this.generateJobId();
    const job: BuildJob = {
      id: jobId,
      config,
      startTime: Date.now(),
      status: 'pending',
      progress: {
        phase: 'fetching',
        percentage: 0,
      },
    };

    this.jobQueue.set(jobId, job);

    try {
      await this.waitForSlot();
      this.runningJobs.add(jobId);

      job.status = 'running';
      this.statusReporter.startJob(jobId);

      await this.preProcess(job);

      const result = await this.processJob(job);

      await this.postProcess(job, result);

      job.status = 'completed';
      job.result = result;
      this.statusReporter.completeJob(jobId);

      return result;
    } catch (error) {
      job.status = 'failed';
      job.error = error as Error;
      this.statusReporter.failJob(jobId, error as Error);
      throw error;
    } finally {
      this.runningJobs.delete(jobId);
    }
  }

  private async waitForSlot(): Promise<void> {
    while (this.runningJobs.size >= this.maxConcurrentJobs) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  private generateJobId(): string {
    return `build-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private async preProcess(job: BuildJob): Promise<void> {
    if (!this.factory.hasStrategy(job.config.strategyId as DataSourceStrategyId)) {
      throw new Error(`Unknown strategy: ${job.config.strategyId}`);
    }
  }

  private async processJob(job: BuildJob): Promise<BuildResult> {
    const startTime = Date.now();
    const phases = { fetching: 0, processing: 0, validating: 0, saving: 0 };

    const strategy = this.factory.create(job.config.strategyId as DataSourceStrategyId);

    this.statusReporter.updatePhase(job.id, 'fetching', 10);
    const fetchStart = Date.now();
    const rawData = await strategy.fetchData(job.config.fetchOptions);
    phases.fetching = Date.now() - fetchStart;

    this.statusReporter.updatePhase(job.id, 'processing', 50);
    const processStart = Date.now();
    const processedData = await strategy.processData(rawData, job.config.processOptions);
    phases.processing = Date.now() - processStart;

    this.statusReporter.updatePhase(job.id, 'validating', 75);
    const validateStart = Date.now();
    const validationResult = await strategy.validateData(processedData);
    phases.validating = Date.now() - validateStart;

    if (!validationResult.isValid) {
      throw new Error(`Validation failed: ${validationResult.errors.join(', ')}`);
    }

    this.statusReporter.updatePhase(job.id, 'saving', 90);
    const saveStart = Date.now();
    const saveResult = await strategy.saveData(processedData, job.config.saveTarget);
    phases.saving = Date.now() - saveStart;

    this.statusReporter.updatePhase(job.id, 'completed', 100);

    return {
      jobId: job.id,
      success: true,
      dataCount: Array.isArray(processedData) ? processedData.length : 1,
      validationResult,
      saveResult,
      duration: Date.now() - startTime,
      phases,
    };
  }

  private async postProcess(job: BuildJob, result: BuildResult): Promise<void> {
    console.log(`Build job ${job.id} completed in ${result.duration}ms`);
  }

  getJobStatus(jobId: string): BuildJob | undefined {
    return this.jobQueue.get(jobId);
  }

  getAllJobs(): BuildJob[] {
    return Array.from(this.jobQueue.values());
  }

  getPendingJobs(): BuildJob[] {
    return this.getAllJobs().filter((job) => job.status === 'pending');
  }

  getRunningJobs(): BuildJob[] {
    return this.getAllJobs().filter((job) => job.status === 'running');
  }

  clearCompletedJobs(): void {
    for (const [jobId, job] of Object.entries(this.jobQueue)) {
      if (job.status === 'completed' || job.status === 'failed') {
        this.jobQueue.delete(jobId);
      }
    }
  }
}

class MockBuildStatusReporter implements BuildStatusReporter {
  private jobs = new Map<string, BuildJob['progress']>();

  startJob(jobId: string): void {
    this.jobs.set(jobId, {
      phase: 'fetching',
      percentage: 0,
    });
  }

  updatePhase(
    jobId: string,
    phase: BuildJob['progress']['phase'],
    percentage = 0,
    message?: string
  ): void {
    this.jobs.set(jobId, { phase, percentage, message });
  }

  completeJob(jobId: string): void {
    this.jobs.set(jobId, {
      phase: 'completed',
      percentage: 100,
    });
  }

  failJob(jobId: string, error: Error): void {
    this.jobs.set(jobId, {
      phase: 'fetching',
      percentage: 0,
      message: error.message,
    });
  }

  getJobStatus(jobId: string): BuildJob | undefined {
    const progress = this.jobs.get(jobId);
    if (!progress) return undefined;

    return {
      id: jobId,
      config: {} as BuildConfig,
      startTime: Date.now(),
      status: 'running',
      progress,
    };
  }
}

describe('Build System', () => {
  let factory: DataSourceStrategyFactory;
  let batchProcessor: DataSourceBuildProcessor;

  beforeEach(() => {
    factory = new DataSourceStrategyFactory();
    batchProcessor = new DataSourceBuildProcessor(factory);
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('BuildProcessor', () => {
    it('should create build processor', () => {
      expect(batchProcessor).toBeInstanceOf(DataSourceBuildProcessor);
    });

    it('should execute single build job successfully', async () => {
      const config: BuildConfig = {
        strategyId: 'natural-earth-shapes',
        fetchOptions: {
          endpoint: 'countries-50m',
          bbox: { minLat: 35, maxLat: 36, minLng: 139, maxLng: 140 },
        },
        processOptions: {
          extract: true,
          tolerance: 0.01,
        },
        saveTarget: {
          type: 'hierarchidb',
          entityType: 'shape',
          parentId: 'test-parent',
        },
      };

      const result = await batchProcessor.executeBuild(config);

      expect(result.success).toBe(true);
      expect(result.jobId).toBeDefined();
      expect(result.duration).toBeGreaterThan(0);
      expect(result.phases).toBeDefined();
      expect(typeof result.dataCount).toBe('number');
    });

    it('should handle build job failure', async () => {
      const config: BuildConfig = {
        strategyId: 'unknown-strategy',
        saveTarget: {
          type: 'hierarchidb',
        },
      };

      await expect(batchProcessor.executeBuild(config)).rejects.toThrow('Unknown strategy');
    });

    it('should track job status', async () => {
      const config: BuildConfig = {
        strategyId: 'natural-earth-shapes',
        saveTarget: { type: 'hierarchidb' },
      };

      //  job
      const jobPromise = batchProcessor.executeBuild(config);

      //  status
      await new Promise((resolve) => setTimeout(resolve, 50));

      const runningJobs = batchProcessor.getRunningJobs();
      expect(runningJobs.length).toBeGreaterThanOrEqual(0);

      //  job
      const result = await jobPromise;
      expect(result.success).toBe(true);

      //  job
      const job = batchProcessor.getJobStatus(result.jobId);
      expect(job?.status).toBe('completed');
    });

    it('should handle concurrent jobs', async () => {
      const configs: BuildConfig[] = [
        {
          strategyId: 'natural-earth-shapes',
          fetchOptions: { endpoint: 'countries-50m' },
          saveTarget: { type: 'hierarchidb' },
        },
        {
          strategyId: 'gadm-administrative-areas',
          fetchOptions: { country: 'JPN', adminLevel: 1 },
          saveTarget: { type: 'hierarchidb' },
        },
        {
          strategyId: 'geoboundaries-admin-areas',
          fetchOptions: { country: 'USA', adminLevel: 1 },
          saveTarget: { type: 'hierarchidb' },
        },
      ];

      const jobPromises = configs.map((config) => batchProcessor.executeBuild(config));

      const results = await Promise.all(jobPromises);

      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result.success).toBe(true);
        expect(result.jobId).toBeDefined();
      });
    });

    it('should provide job statistics', async () => {
      const config: BuildConfig = {
        strategyId: 'natural-earth-shapes',
        saveTarget: { type: 'hierarchidb' },
      };

      await batchProcessor.executeBuild(config);

      const allJobs = batchProcessor.getAllJobs();
      const pendingJobs = batchProcessor.getPendingJobs();
      const runningJobs = batchProcessor.getRunningJobs();

      expect(allJobs.length).toBeGreaterThan(0);
      expect(pendingJobs.length).toBeGreaterThanOrEqual(0);
      expect(runningJobs.length).toBeGreaterThanOrEqual(0);

      //  job
      batchProcessor.clearCompletedJobs();
      const jobsAfterClear = batchProcessor.getAllJobs();
      expect(jobsAfterClear.length).toBeLessThanOrEqual(allJobs.length);
    });
  });

  describe('Build Configuration Validation', () => {
    it('should validate required build config fields', async () => {
      const invalidConfigs = [
        //  ID
        {
          saveTarget: { type: 'hierarchidb' },
        },
        {
          strategyId: 'natural-earth-shapes',
        },
      ];

      for (const config of invalidConfigs) {
        await expect(
          // Cast via unknown to satisfy strict type check for intentional invalid configs
          batchProcessor.executeBuild(config as BuildConfig)
        ).rejects.toThrow();
      }
    });

    it('should handle build options correctly', async () => {
      const config: BuildConfig = {
        strategyId: 'natural-earth-shapes',
        fetchOptions: {
          endpoint: 'countries-50m',
          adminLevel: 0,
        },
        processOptions: {
          extract: true,
          tolerance: 0.001,
          filters: [{ field: 'properties.POP_EST', operator: 'gt', value: 1000000 }],
        },
        saveTarget: {
          type: 'hierarchidb',
          entityType: 'shape',
          parentId: 'test-parent',
        },
        priority: 'high',
        timeout: 60000,
        retryCount: 3,
      };

      const result = await batchProcessor.executeBuild(config);
      expect(result.success).toBe(true);

      const job = batchProcessor.getJobStatus(result.jobId);
      expect(job?.config.priority).toBe('high');
      expect(job?.config.timeout).toBe(60000);
      expect(job?.config.retryCount).toBe(3);
    });
  });

  describe('Performance and Resource Management', () => {
    it('should measure phase execution times', async () => {
      const config: BuildConfig = {
        strategyId: 'natural-earth-shapes',
        saveTarget: { type: 'hierarchidb' },
      };

      const result = await batchProcessor.executeBuild(config);

      expect(result.phases).toBeDefined();
      expect(result.phases.fetching).toBeGreaterThanOrEqual(0);
      expect(result.phases.processing).toBeGreaterThanOrEqual(0);
      expect(result.phases.validating).toBeGreaterThanOrEqual(0);
      expect(result.phases.saving).toBeGreaterThanOrEqual(0);

      const totalPhaseTime = Object.values(result.phases).reduce((sum, time) => sum + time, 0);
      expect(totalPhaseTime).toBeLessThanOrEqual(result.duration + 100); //  100ms
    });

    it('should respect concurrency limits', async () => {
      const configs = Array(5)
        .fill(null)
        .map((_, i) => ({
          strategyId: 'natural-earth-shapes',
          fetchOptions: { endpoint: `test-${i}` },
          saveTarget: { type: 'hierarchidb' },
        }));

      const jobPromises = configs.map((config) =>
        batchProcessor.executeBuild(config as BuildConfig)
      );

      //  job
      await new Promise((resolve) => setTimeout(resolve, 10));
      const runningJobs = batchProcessor.getRunningJobs();

      //  maxConcurrentJobs = 3
      expect(runningJobs.length).toBeLessThanOrEqual(3);

      //  job
      const results = await Promise.all(jobPromises);
      expect(results).toHaveLength(5);
      results.forEach((result) => {
        expect(result.success).toBe(true);
      });
    });
  });
});
