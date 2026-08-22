import { planCanonicalYamlZipExport } from '@hierarchidb/folder-plugin/canonical-yaml-zip-plan';
import type { ExportFilter, IdeGsmClient } from '@hierarchidb/ide-gsm-client';
import { CanonicalYamlSnapshotWorkflowError } from './canonical-yaml-snapshot/CanonicalYamlSnapshotWorkflowError.js';
import type {
  CanonicalYamlSnapshotStep,
  CanonicalYamlSnapshotWorkflowErrorCode,
} from './canonical-yaml-snapshot/canonicalYamlSnapshotTypes.js';
import type {
  ConnectionType,
  OnStepChange,
  RsyncFilter,
  StepName,
} from './simulationWorkflowTypes.js';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Invoke onStepChange only when the callback is provided.
 * Avoids repeated undefined checks throughout the workflow methods.
 */
function notify(
  onStepChange: OnStepChange | undefined,
  step: StepName,
  status: 'running' | 'done' | 'failed'
): void {
  if (onStepChange !== undefined) {
    onStepChange(step, status);
  }
}

function notifyCanonical(
  onStepChange: OnStepChange | undefined,
  step: CanonicalYamlSnapshotStep,
  status: 'running' | 'done' | 'failed'
): void {
  try {
    notify(onStepChange, step, status);
  } catch {
    throw new CanonicalYamlSnapshotWorkflowError('STEP_CALLBACK_FAILED', { step });
  }
}

const STEP_ERROR_CODES: Readonly<
  Record<CanonicalYamlSnapshotStep, CanonicalYamlSnapshotWorkflowErrorCode>
> = Object.freeze({
  import: 'IMPORT_FAILED',
  calibrate: 'CALIBRATE_FAILED',
  simulate: 'SIMULATE_FAILED',
  export: 'EXPORT_FAILED',
});

// ---------------------------------------------------------------------------
// SimulationWorkflow
// ---------------------------------------------------------------------------

/**
 * Orchestrates multi-step simulation workflows against the IDE-GSM API.
 *
 * Two high-level methods are provided:
 * - runSimulation: import → calibrate → simulate → export (ZIP-based)
 * - runSimulationWithRsync: rsync-push → calibrate → simulate → rsync-pull
 *
 * All errors propagate to the caller unchanged. No step is executed after a
 * failure. The onStepChange callback is optional; when omitted, no callbacks
 * are invoked.
 */
export class SimulationWorkflow {
  private readonly client: IdeGsmClient;

  constructor(client: IdeGsmClient) {
    this.client = client;
  }

  // -------------------------------------------------------------------------
  // runSimulation: import → calibrate → simulate → export
  // -------------------------------------------------------------------------

  /**
   * Run the full ZIP-based simulation workflow.
   *
   * @param nodes - YAML nodes to serialize and import.
   * @param projectRelativePath - IDE-GSM project path.
   * @param exportFilter - Optional file-glob filter for the export step.
   * @param onStepChange - Optional progress callback.
   */
  async runSimulation(
    nodes: readonly unknown[],
    projectRelativePath: string,
    exportFilter?: ExportFilter,
    onStepChange?: OnStepChange
  ): Promise<void> {
    const snapshotPlan = planCanonicalYamlZipExport({ slot: 'committed', nodes });
    if (!snapshotPlan.ok) {
      throw new CanonicalYamlSnapshotWorkflowError('SNAPSHOT_PLANNING_FAILED', {
        planningErrors: snapshotPlan.errors,
      });
    }
    await this.runCanonicalTask(
      'import',
      () => this.client.importProject(snapshotPlan.plan.archive.base64, projectRelativePath),
      onStepChange
    );
    await this.runCanonicalTask(
      'calibrate',
      () => this.client.calibrate(projectRelativePath),
      onStepChange
    );
    await this.runCanonicalTask(
      'simulate',
      () => this.client.simulate(projectRelativePath),
      onStepChange
    );
    await this.runCanonicalTask(
      'export',
      () =>
        exportFilter === undefined
          ? this.client.exportProject(projectRelativePath)
          : this.client.exportProject(projectRelativePath, exportFilter),
      onStepChange
    );
  }

  private async runCanonicalTask(
    step: 'import' | 'calibrate' | 'simulate' | 'export',
    start: () => Promise<string>,
    onStepChange: OnStepChange | undefined
  ): Promise<void> {
    notifyCanonical(onStepChange, step, 'running');
    try {
      const taskId = await start();
      if (typeof taskId !== 'string' || taskId.length === 0) {
        throw new Error('Invalid task contract');
      }
      await this.client.awaitTask(taskId);
    } catch {
      notifyCanonical(onStepChange, step, 'failed');
      throw new CanonicalYamlSnapshotWorkflowError(STEP_ERROR_CODES[step], { step });
    }
    notifyCanonical(onStepChange, step, 'done');
  }

  // -------------------------------------------------------------------------
  // runSimulationWithRsync: rsync-push → calibrate → simulate → rsync-pull
  // -------------------------------------------------------------------------

  /**
   * Run the rsync-based simulation workflow.
   *
   * @param projectRelativePath - IDE-GSM project path.
   * @param connectionType - Rsync connection type.
   * @param rsyncFilter - Optional file-glob filter for rsync steps.
   * @param onStepChange - Optional progress callback.
   */
  async runSimulationWithRsync(
    projectRelativePath: string,
    connectionType: ConnectionType,
    rsyncFilter?: RsyncFilter,
    onStepChange?: OnStepChange
  ): Promise<void> {
    // rsync-push step
    notify(onStepChange, 'rsync-push', 'running');
    try {
      const pushTaskId =
        rsyncFilter !== undefined
          ? await this.client.rsyncPush(projectRelativePath, connectionType, rsyncFilter)
          : await this.client.rsyncPush(projectRelativePath, connectionType);
      await this.client.awaitTask(pushTaskId);
    } catch (err) {
      notify(onStepChange, 'rsync-push', 'failed');
      throw err;
    }
    notify(onStepChange, 'rsync-push', 'done');

    // calibrate step
    notify(onStepChange, 'calibrate', 'running');
    try {
      const calibrateTaskId = await this.client.calibrate(projectRelativePath);
      await this.client.awaitTask(calibrateTaskId);
    } catch (err) {
      notify(onStepChange, 'calibrate', 'failed');
      throw err;
    }
    notify(onStepChange, 'calibrate', 'done');

    // simulate step
    notify(onStepChange, 'simulate', 'running');
    try {
      const simulateTaskId = await this.client.simulate(projectRelativePath);
      await this.client.awaitTask(simulateTaskId);
    } catch (err) {
      notify(onStepChange, 'simulate', 'failed');
      throw err;
    }
    notify(onStepChange, 'simulate', 'done');

    // rsync-pull step
    notify(onStepChange, 'rsync-pull', 'running');
    try {
      const pullTaskId =
        rsyncFilter !== undefined
          ? await this.client.rsyncPull(projectRelativePath, connectionType, rsyncFilter)
          : await this.client.rsyncPull(projectRelativePath, connectionType);
      await this.client.awaitTask(pullTaskId);
    } catch (err) {
      notify(onStepChange, 'rsync-pull', 'failed');
      throw err;
    }
    notify(onStepChange, 'rsync-pull', 'done');
  }
}
