import type { YamlCoreDbMigrationError } from '@hierarchidb/yaml-api/migration';

export interface YamlCoreDbReadOnlyInventorySlotCounts {
  readonly legacyWithName: number;
  readonly hostSplitLegacy: number;
  readonly canonical: number;
  readonly temporaryPlaceholder: number;
  readonly metadataOnlyDraft: number;
}

export interface YamlCoreDbReadOnlyInventoryAcceptedReport {
  readonly contractVersion: 1;
  readonly status: 'accepted';
  readonly yamlNodeCount: number;
  readonly slotCount: number;
  readonly invalidRecordCount: 0;
  readonly errorCount: 0;
  readonly slotCounts: YamlCoreDbReadOnlyInventorySlotCounts;
}

export interface YamlCoreDbReadOnlyInventoryRejectedReport {
  readonly contractVersion: 1;
  readonly status: 'rejected';
  readonly yamlNodeCount: number;
  readonly invalidRecordCount: number;
  readonly errorCount: number;
  readonly errors: readonly YamlCoreDbMigrationError[];
}

export interface YamlCoreDbReadOnlyInventoryExecutionFailure {
  readonly contractVersion: 1;
  readonly status: 'failed';
  readonly code: 'COREDB_READ_FAILED' | 'INVENTORY_PLANNING_FAILED';
}

export type YamlCoreDbReadOnlyInventoryResult =
  | YamlCoreDbReadOnlyInventoryAcceptedReport
  | YamlCoreDbReadOnlyInventoryRejectedReport
  | YamlCoreDbReadOnlyInventoryExecutionFailure;
