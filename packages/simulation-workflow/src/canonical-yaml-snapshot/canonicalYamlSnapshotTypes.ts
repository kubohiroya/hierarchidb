import type { CanonicalYamlZipPlanError } from '@hierarchidb/folder-plugin/canonical-yaml-zip-plan';
import type { ExportFilter } from '@hierarchidb/ide-gsm-client';

export type CanonicalYamlSnapshotStep = 'import' | 'calibrate' | 'simulate' | 'export';

export type CanonicalYamlSnapshotStepStatus = 'running' | 'done' | 'failed';

export type CanonicalYamlSnapshotOnStepChange = (
  step: CanonicalYamlSnapshotStep,
  status: CanonicalYamlSnapshotStepStatus
) => void;

export interface CanonicalYamlSnapshotClientPort {
  importProject(projectSnapshot: string, projectRelativePath: string): Promise<string>;
  awaitTask(taskId: string): Promise<unknown>;
  calibrate(projectRelativePath: string): Promise<string>;
  simulate(projectRelativePath: string): Promise<string>;
  exportProject(projectRelativePath: string, filter?: ExportFilter): Promise<string>;
}

export type CanonicalYamlSnapshotWorkflowErrorCode =
  | 'SNAPSHOT_PLANNING_FAILED'
  | 'IMPORT_FAILED'
  | 'CALIBRATE_FAILED'
  | 'SIMULATE_FAILED'
  | 'EXPORT_FAILED'
  | 'STEP_CALLBACK_FAILED';

export interface CanonicalYamlSnapshotWorkflowErrorContext {
  readonly step?: CanonicalYamlSnapshotStep;
  readonly planningErrors?: readonly CanonicalYamlZipPlanError[];
}
