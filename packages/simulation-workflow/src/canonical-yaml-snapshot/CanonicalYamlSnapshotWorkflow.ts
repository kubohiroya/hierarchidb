import { planCanonicalYamlZipExport } from '@hierarchidb/folder-plugin/canonical-yaml-zip-plan';
import type { ExportFilter } from '@hierarchidb/ide-gsm-client';
import { CanonicalYamlSnapshotWorkflowError } from './CanonicalYamlSnapshotWorkflowError.js';
import type {
  CanonicalYamlSnapshotClientPort,
  CanonicalYamlSnapshotOnStepChange,
  CanonicalYamlSnapshotStep,
  CanonicalYamlSnapshotWorkflowErrorCode,
} from './canonicalYamlSnapshotTypes.js';

const STEP_ERROR_CODES: Readonly<
  Record<CanonicalYamlSnapshotStep, CanonicalYamlSnapshotWorkflowErrorCode>
> = Object.freeze({
  import: 'IMPORT_FAILED',
  calibrate: 'CALIBRATE_FAILED',
  simulate: 'SIMULATE_FAILED',
  export: 'EXPORT_FAILED',
});

function notify(
  onStepChange: CanonicalYamlSnapshotOnStepChange | undefined,
  step: CanonicalYamlSnapshotStep,
  status: 'running' | 'done' | 'failed'
): void {
  if (onStepChange === undefined) return;
  try {
    onStepChange(step, status);
  } catch {
    throw new CanonicalYamlSnapshotWorkflowError('STEP_CALLBACK_FAILED', { step });
  }
}

/**
 * Dormant canonical counterpart of the legacy production SimulationWorkflow.
 *
 * The class is intentionally exported only from the canonical-yaml-snapshot
 * subpath. Production routing must remain disconnected until storage activation.
 */
export class CanonicalYamlSnapshotWorkflow {
  private readonly client: CanonicalYamlSnapshotClientPort;

  constructor(client: CanonicalYamlSnapshotClientPort) {
    this.client = client;
  }

  async runSimulation(
    nodes: readonly unknown[],
    projectRelativePath: string,
    exportFilter?: ExportFilter,
    onStepChange?: CanonicalYamlSnapshotOnStepChange
  ): Promise<void> {
    const snapshotPlan = planCanonicalYamlZipExport({ slot: 'committed', nodes });
    if (!snapshotPlan.ok) {
      throw new CanonicalYamlSnapshotWorkflowError('SNAPSHOT_PLANNING_FAILED', {
        planningErrors: snapshotPlan.errors,
      });
    }

    await this.runTask(
      'import',
      () => this.client.importProject(snapshotPlan.plan.archive.base64, projectRelativePath),
      onStepChange
    );
    await this.runTask('calibrate', () => this.client.calibrate(projectRelativePath), onStepChange);
    await this.runTask('simulate', () => this.client.simulate(projectRelativePath), onStepChange);
    await this.runTask(
      'export',
      () =>
        exportFilter === undefined
          ? this.client.exportProject(projectRelativePath)
          : this.client.exportProject(projectRelativePath, exportFilter),
      onStepChange
    );
  }

  private async runTask(
    step: CanonicalYamlSnapshotStep,
    start: () => Promise<string>,
    onStepChange: CanonicalYamlSnapshotOnStepChange | undefined
  ): Promise<void> {
    notify(onStepChange, step, 'running');
    try {
      const taskId = await start();
      if (typeof taskId !== 'string' || taskId.length === 0) {
        throw new Error('Invalid task contract');
      }
      await this.client.awaitTask(taskId);
    } catch {
      notify(onStepChange, step, 'failed');
      throw new CanonicalYamlSnapshotWorkflowError(STEP_ERROR_CODES[step], { step });
    }
    notify(onStepChange, step, 'done');
  }
}
