import type { NodeId } from '@hierarchidb/common-types';
import type { CoreDB } from './CoreDB.js';
import { discardWorkingCopy } from './WorkingCopyTreeNodeOperations.js';

const DEFAULT_TTL_MS = resolveEnvNumber('HDB_WORKING_COPY_TTL_MS', 24 * 60 * 60 * 1000);
const DEFAULT_INTERVAL_MS = resolveEnvNumber('HDB_WORKING_COPY_GC_INTERVAL_MS', 5 * 60 * 1000);
const DEFAULT_BATCH_SIZE = 100;

export interface WorkingCopyCleanerOptions {
  ttlMs: number;
  intervalMs: number;
  batchSize: number;
}

export interface CleanOptions {
  maxEntries?: number;
}

const cleanerRegistry = new WeakMap<CoreDB, WorkingCopyCleaner>();

export class WorkingCopyCleaner {
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private options: WorkingCopyCleanerOptions;

  constructor(
    private readonly coreDB: CoreDB,
    options?: Partial<WorkingCopyCleanerOptions>
  ) {
    this.options = {
      ttlMs: DEFAULT_TTL_MS,
      intervalMs: DEFAULT_INTERVAL_MS,
      batchSize: DEFAULT_BATCH_SIZE,
      ...options,
    } satisfies WorkingCopyCleanerOptions;
  }

  configure(options?: Partial<WorkingCopyCleanerOptions>): void {
    if (!options) return;
    this.options = { ...this.options, ...options };
    if (this.intervalHandle) {
      this.stop();
      this.start();
    }
  }

  start(): void {
    if (this.intervalHandle || this.options.intervalMs <= 0) {
      return;
    }
    this.intervalHandle = setInterval(() => {
      this.cleanStaleEntries().catch((error) => {
        console.warn('[WorkingCopyCleaner] background cleanup failed', error);
      });
    }, this.options.intervalMs);
    (this.intervalHandle as unknown as { unref?: () => void })?.unref?.();
  }

  stop(): void {
    if (!this.intervalHandle) return;
    clearInterval(this.intervalHandle);
    this.intervalHandle = null;
  }

  get ttlMs(): number {
    return this.options.ttlMs;
  }

  async cleanStaleEntries(options?: CleanOptions): Promise<number> {
    if (this.options.ttlMs <= 0) return 0;
    const cutoff = Date.now() - this.options.ttlMs;
    const maxEntries = Math.max(1, options?.maxEntries ?? this.options.batchSize);

    const staleHolders = await this.coreDB.nodes
      .where('holderType')
      .equals('workingCopy')
      .and((node) => {
        const touched = node.lastTouchedAt ?? node.updatedAt ?? 0;
        return touched < cutoff;
      })
      .limit(maxEntries)
      .toArray();

    if (!staleHolders.length) {
      return 0;
    }

    let removed = 0;
    for (const holder of staleHolders) {
      const child = await this.coreDB.nodes.where('parentId').equals(holder.id).first();
      if (!child?.id) continue;
      try {
        await discardWorkingCopy(this.coreDB, [holder.id as NodeId, child.id as NodeId]);
        removed += 1;
      } catch (error) {
        console.warn('[WorkingCopyCleaner] Failed to discard stale working copy', {
          holderId: holder.id,
          workingCopyId: child.id,
          error,
        });
      }
    }

    if (removed > 0) {
      console.info('[WorkingCopyCleaner] removed stale working copies', {
        removed,
        cutoff,
      });
    }

    return removed;
  }
}

export function getWorkingCopyCleaner(
  coreDB: CoreDB,
  options?: Partial<WorkingCopyCleanerOptions>
): WorkingCopyCleaner {
  let cleaner = cleanerRegistry.get(coreDB);
  if (!cleaner) {
    cleaner = new WorkingCopyCleaner(coreDB, options);
    cleanerRegistry.set(coreDB, cleaner);
  } else if (options) {
    cleaner.configure(options);
  }
  return cleaner;
}

function resolveEnvNumber(key: string, fallback: number): number {
  const value =
    (typeof process !== 'undefined' && typeof process?.env?.[key] === 'string'
      ? process.env[key]
      : undefined) ?? undefined;
  const parsed = typeof value === 'string' ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
