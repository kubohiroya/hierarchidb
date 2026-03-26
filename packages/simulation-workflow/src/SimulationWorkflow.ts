import type { IdeGsmClient } from '@hierarchidb/ide-gsm-client';
import type { ExportableNode } from '@hierarchidb/folder-plugin';
import { exportYamlNodesToSnapshot } from '@hierarchidb/folder-plugin';
import type { ExportFilter } from '@hierarchidb/ide-gsm-client';
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
    status: 'running' | 'done' | 'failed',
): void {
    if (onStepChange !== undefined) {
        onStepChange(step, status);
    }
}

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
     * @returns The ProjectSnapshot string from the export step's TaskResult.paramsJson.
     */
    async runSimulation(
        nodes: readonly ExportableNode[],
        projectRelativePath: string,
        exportFilter?: ExportFilter,
        onStepChange?: OnStepChange,
    ): Promise<string> {
        // Serialize nodes → ProjectSnapshot (no onStepChange on serialization error)
        const serializeResult = await exportYamlNodesToSnapshot(nodes);
        if (!serializeResult.ok) {
            throw new Error(serializeResult.error);
        }
        const projectSnapshot = serializeResult.snapshot;

        // import step
        notify(onStepChange, 'import', 'running');
        try {
            const importTaskId = await this.client.importProject(projectSnapshot, projectRelativePath);
            await this.client.awaitTask(importTaskId);
        } catch (err) {
            notify(onStepChange, 'import', 'failed');
            throw err;
        }
        notify(onStepChange, 'import', 'done');

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

        // export step
        notify(onStepChange, 'export', 'running');
        let exportParamsJson: string;
        try {
            const exportTaskId = exportFilter !== undefined
                ? await this.client.exportProject(projectRelativePath, exportFilter)
                : await this.client.exportProject(projectRelativePath);
            const exportResult = await this.client.awaitTask(exportTaskId);
            exportParamsJson = exportResult.paramsJson;
        } catch (err) {
            notify(onStepChange, 'export', 'failed');
            throw err;
        }
        notify(onStepChange, 'export', 'done');

        return exportParamsJson;
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
        onStepChange?: OnStepChange,
    ): Promise<void> {
        // rsync-push step
        notify(onStepChange, 'rsync-push', 'running');
        try {
            const pushTaskId = rsyncFilter !== undefined
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
            const pullTaskId = rsyncFilter !== undefined
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
