/**
 * Tests for SimulationWorkflow.
 *
 * Uses vitest + fast-check for property-based tests.
 * All imports are relative (no ~/ aliases).
 */
import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import { SimulationWorkflow } from '../src/SimulationWorkflow.js';
import type { IdeGsmClient } from '@hierarchidb/ide-gsm-client';
import type { ExportableNode } from '@hierarchidb/folder-plugin';
import type { OnStepChange, StepName, StepStatus } from '../src/simulationWorkflowTypes.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal mock IdeGsmClient. All methods resolve successfully by default. */
function makeMockClient(overrides: Partial<Record<keyof IdeGsmClient, unknown>> = {}): IdeGsmClient {
    return {
        importProject: vi.fn().mockResolvedValue('task-import'),
        calibrate: vi.fn().mockResolvedValue('task-calibrate'),
        simulate: vi.fn().mockResolvedValue('task-simulate'),
        exportProject: vi.fn().mockResolvedValue('task-export'),
        rsyncPush: vi.fn().mockResolvedValue('task-rsync-push'),
        rsyncPull: vi.fn().mockResolvedValue('task-rsync-pull'),
        awaitTask: vi.fn().mockResolvedValue({ id: 'task-id', status: 'FINISHED', paramsJson: 'snapshot-result' }),
        ...overrides,
    } as unknown as IdeGsmClient;
}

/** Build a minimal ExportableNode array (empty is valid per spec). */
const emptyNodes: readonly ExportableNode[] = [];

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

describe('SimulationWorkflow — unit tests', () => {
    it('constructor stores IdeGsmClient without throwing', () => {
        const client = makeMockClient();
        expect(() => new SimulationWorkflow(client)).not.toThrow();
    });

    it('runSimulation without onStepChange executes all steps without error', async () => {
        const client = makeMockClient();
        const wf = new SimulationWorkflow(client);
        await expect(wf.runSimulation(emptyNodes, 'project/path')).resolves.toBe('snapshot-result');
    });

    it('runSimulationWithRsync without onStepChange executes all steps without error', async () => {
        const client = makeMockClient();
        const wf = new SimulationWorkflow(client);
        await expect(wf.runSimulationWithRsync('project/path', 'remote')).resolves.toBeUndefined();
    });

    it('rsyncPush / rsyncPull omit filter when not provided', async () => {
        const client = makeMockClient();
        const wf = new SimulationWorkflow(client);
        await wf.runSimulationWithRsync('project/path', 'ssh');
        expect(client.rsyncPush).toHaveBeenCalledWith('project/path', 'ssh');
        expect(client.rsyncPull).toHaveBeenCalledWith('project/path', 'ssh');
    });
});

// ---------------------------------------------------------------------------
// Property 1: Import flow step order invariant
// ---------------------------------------------------------------------------

describe('Property 1: Import flow step order invariant', () => {
    // Feature: simulation-workflow, Property 1: Import flow step order invariant
    it('onStepChange is called in exact order for successful runSimulation', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.string({ minLength: 1 }),
                async (path) => {
                    const client = makeMockClient();
                    const wf = new SimulationWorkflow(client);
                    const events: Array<[StepName, StepStatus]> = [];
                    const cb: OnStepChange = (step, status) => events.push([step, status]);

                    await wf.runSimulation(emptyNodes, path, undefined, cb);

                    expect(events).toEqual([
                        ['import', 'running'],
                        ['import', 'done'],
                        ['calibrate', 'running'],
                        ['calibrate', 'done'],
                        ['simulate', 'running'],
                        ['simulate', 'done'],
                        ['export', 'running'],
                        ['export', 'done'],
                    ]);
                },
            ),
            { numRuns: 100 },
        );
    });
});

// ---------------------------------------------------------------------------
// Property 2: Rsync flow step order invariant
// ---------------------------------------------------------------------------

describe('Property 2: Rsync flow step order invariant', () => {
    // Feature: simulation-workflow, Property 2: Rsync flow step order invariant
    it('onStepChange is called in exact order for successful runSimulationWithRsync', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.string({ minLength: 1 }),
                fc.constantFrom('remote' as const, 'ssh' as const, 'ec2' as const),
                async (path, connType) => {
                    const client = makeMockClient();
                    const wf = new SimulationWorkflow(client);
                    const events: Array<[StepName, StepStatus]> = [];
                    const cb: OnStepChange = (step, status) => events.push([step, status]);

                    await wf.runSimulationWithRsync(path, connType, undefined, cb);

                    expect(events).toEqual([
                        ['rsync-push', 'running'],
                        ['rsync-push', 'done'],
                        ['calibrate', 'running'],
                        ['calibrate', 'done'],
                        ['simulate', 'running'],
                        ['simulate', 'done'],
                        ['rsync-pull', 'running'],
                        ['rsync-pull', 'done'],
                    ]);
                },
            ),
            { numRuns: 100 },
        );
    });
});

// ---------------------------------------------------------------------------
// Property 3: Error stops subsequent steps (runSimulation)
// ---------------------------------------------------------------------------

describe('Property 3: Error stops subsequent steps — runSimulation', () => {
    // Feature: simulation-workflow, Property 3: Error stops subsequent steps
    it('when a step throws, no subsequent onStepChange events are emitted', async () => {
        // Steps in order: import, calibrate, simulate, export
        const stepMethods: Array<keyof IdeGsmClient> = ['importProject', 'calibrate', 'simulate', 'exportProject'];
        const stepNames: StepName[] = ['import', 'calibrate', 'simulate', 'export'];

        await fc.assert(
            fc.asyncProperty(
                fc.integer({ min: 0, max: 3 }),
                fc.string({ minLength: 1 }),
                async (failIndex, errMsg) => {
                    const error = new Error(errMsg);
                    const overrides: Partial<Record<keyof IdeGsmClient, unknown>> = {};
                    overrides[stepMethods[failIndex]] = vi.fn().mockRejectedValue(error);

                    const client = makeMockClient(overrides);
                    const wf = new SimulationWorkflow(client);
                    const events: Array<[StepName, StepStatus]> = [];
                    const cb: OnStepChange = (step, status) => events.push([step, status]);

                    await expect(wf.runSimulation(emptyNodes, 'path', undefined, cb)).rejects.toThrow(errMsg);

                    // No 'running' or 'done' event for any step after the failed one
                    const failedStepName = stepNames[failIndex];
                    const failedIdx = events.findIndex(([s, st]) => s === failedStepName && st === 'failed');
                    expect(failedIdx).toBeGreaterThanOrEqual(0);

                    const eventsAfterFail = events.slice(failedIdx + 1);
                    expect(eventsAfterFail).toHaveLength(0);
                },
            ),
            { numRuns: 100 },
        );
    });
});

// ---------------------------------------------------------------------------
// Property 3: Error stops subsequent steps (runSimulationWithRsync)
// ---------------------------------------------------------------------------

describe('Property 3: Error stops subsequent steps — runSimulationWithRsync', () => {
    // Feature: simulation-workflow, Property 3: Error stops subsequent steps (rsync flow)
    it('when a step throws, no subsequent onStepChange events are emitted', async () => {
        const stepMethods: Array<keyof IdeGsmClient> = ['rsyncPush', 'calibrate', 'simulate', 'rsyncPull'];
        const stepNames: StepName[] = ['rsync-push', 'calibrate', 'simulate', 'rsync-pull'];

        await fc.assert(
            fc.asyncProperty(
                fc.integer({ min: 0, max: 3 }),
                fc.string({ minLength: 1 }),
                async (failIndex, errMsg) => {
                    const error = new Error(errMsg);
                    const overrides: Partial<Record<keyof IdeGsmClient, unknown>> = {};
                    overrides[stepMethods[failIndex]] = vi.fn().mockRejectedValue(error);

                    const client = makeMockClient(overrides);
                    const wf = new SimulationWorkflow(client);
                    const events: Array<[StepName, StepStatus]> = [];
                    const cb: OnStepChange = (step, status) => events.push([step, status]);

                    await expect(wf.runSimulationWithRsync('path', 'remote', undefined, cb)).rejects.toThrow(errMsg);

                    const failedStepName = stepNames[failIndex];
                    const failedIdx = events.findIndex(([s, st]) => s === failedStepName && st === 'failed');
                    expect(failedIdx).toBeGreaterThanOrEqual(0);

                    const eventsAfterFail = events.slice(failedIdx + 1);
                    expect(eventsAfterFail).toHaveLength(0);
                },
            ),
            { numRuns: 100 },
        );
    });
});

// ---------------------------------------------------------------------------
// Property 4: Error propagation without modification
// ---------------------------------------------------------------------------

describe('Property 4: Error propagation without modification', () => {
    // Feature: simulation-workflow, Property 4: Error propagation without modification
    it('the exact error thrown by a client method reaches the caller', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.string({ minLength: 1 }),
                async (errMsg) => {
                    const error = new Error(errMsg);
                    const client = makeMockClient({ importProject: vi.fn().mockRejectedValue(error) });
                    const wf = new SimulationWorkflow(client);

                    await expect(wf.runSimulation(emptyNodes, 'path')).rejects.toThrow(errMsg);
                },
            ),
            { numRuns: 100 },
        );
    });
});

// ---------------------------------------------------------------------------
// Property 5: Serialization error prevents any step execution
// ---------------------------------------------------------------------------

describe('Property 5: Serialization error prevents any step execution', () => {
    // Feature: simulation-workflow, Property 5: Serialization error prevents any step execution
    it('when exportYamlNodesToSnapshot returns error, no onStepChange is called and runSimulation throws', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.string({ minLength: 1 }),
                async (_errMsg) => {
                    // Inject a node that triggers duplicate-name error
                    // (two nodes with the same name and correct nodeType 'yaml-file')
                    const duplicateNodes: readonly ExportableNode[] = [
                        { nodeId: 'n1' as never, nodeType: 'yaml-file', data: { name: 'dup.yml', schemaId: '', content: '' } },
                        { nodeId: 'n2' as never, nodeType: 'yaml-file', data: { name: 'dup.yml', schemaId: '', content: '' } },
                    ];

                    const client = makeMockClient();
                    const wf = new SimulationWorkflow(client);
                    const events: Array<[StepName, StepStatus]> = [];
                    const cb: OnStepChange = (step, status) => events.push([step, status]);

                    await expect(wf.runSimulation(duplicateNodes, 'path', undefined, cb)).rejects.toThrow();
                    expect(events).toHaveLength(0);
                    expect(client.importProject).not.toHaveBeenCalled();
                },
            ),
            { numRuns: 100 },
        );
    });
});

// ---------------------------------------------------------------------------
// Property 6: ExportFilter passthrough
// ---------------------------------------------------------------------------

describe('Property 6: ExportFilter passthrough', () => {
    // Feature: simulation-workflow, Property 6: ExportFilter passthrough
    it('the exportFilter passed to runSimulation is forwarded unchanged to exportProject', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    include: fc.option(fc.array(fc.string()), { nil: undefined }),
                    exclude: fc.option(fc.array(fc.string()), { nil: undefined }),
                }),
                async (filter) => {
                    const client = makeMockClient();
                    const wf = new SimulationWorkflow(client);

                    await wf.runSimulation(emptyNodes, 'path', filter);

                    expect(client.exportProject).toHaveBeenCalledWith('path', filter);
                },
            ),
            { numRuns: 100 },
        );
    });
});

// ---------------------------------------------------------------------------
// Property 7: Export result round-trip
// ---------------------------------------------------------------------------

describe('Property 7: Export result round-trip', () => {
    // Feature: simulation-workflow, Property 7: Export result round-trip
    it('runSimulation returns the paramsJson from the export awaitTask result', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.string({ minLength: 1 }),
                async (paramsJson) => {
                    const client = makeMockClient({
                        awaitTask: vi.fn().mockResolvedValue({ id: 'task-export', status: 'FINISHED', paramsJson }),
                    });
                    const wf = new SimulationWorkflow(client);

                    const result = await wf.runSimulation(emptyNodes, 'path');
                    expect(result).toBe(paramsJson);
                },
            ),
            { numRuns: 100 },
        );
    });
});
