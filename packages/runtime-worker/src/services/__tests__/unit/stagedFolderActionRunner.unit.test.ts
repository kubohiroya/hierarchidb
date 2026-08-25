import 'fake-indexeddb/auto';
import path from 'node:path';
import type { NodeId, NodeType } from '@hierarchidb/core-types';
import type {
  MapImageCaptureBrowserPagePort,
  PlaywrightLikeMapImageCapturePage,
  StagedFolderActionConfig,
} from '@hierarchidb/staged-folder-action';
import { createMapImageCaptureBrowserActionRunner } from '@hierarchidb/staged-folder-action/map-image-capture-browser-host';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  runStagedFolderAction,
  type StagedFolderActionRunnerDependencies,
} from '../../runStagedFolderAction.js';
import { StagedFolderActionProgressStore } from '../../stagedFolderActionProgressStore.js';

describe('runStagedFolderAction', () => {
  let store: StagedFolderActionProgressStore;
  let nowValue: number;

  beforeEach(async () => {
    store = new StagedFolderActionProgressStore(`staged-action-runner-${crypto.randomUUID()}`);
    await store.open();
    nowValue = 100;
  });

  afterEach(async () => {
    await store.delete();
  });

  it('completes after staging and overlay when actions is empty', async () => {
    const dependencies = createDependencies();
    const result = await runStagedFolderAction(dependencies, {
      runId: 'run-empty' as NodeId,
      sourceNodeId: 'source-empty' as NodeId,
      config: createConfig({ actions: [] }),
    });

    expect(dependencies.prepareStaging).toHaveBeenCalledOnce();
    expect(dependencies.applyOverlays).toHaveBeenCalledOnce();
    expect(dependencies.runBuildAction).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      status: 'completed',
      phase: 'completed',
      progress: {
        total: 0,
        completed: 0,
        percentage: 100,
      },
    });
  });

  it('runs a build action through the injected build session handoff', async () => {
    const dependencies = createDependencies();
    const result = await runStagedFolderAction(dependencies, {
      runId: 'run-build' as NodeId,
      sourceNodeId: 'source-build' as NodeId,
      config: createConfig({
        actions: [{ type: 'build', mode: 'session-manager' }],
      }),
    });

    expect(dependencies.runBuildAction).toHaveBeenCalledWith({
      action: { type: 'build', mode: 'session-manager' },
      config: expect.any(Object),
      stagingRootNodeId: 'staging-root',
      runId: 'run-build',
    });
    expect(result).toMatchObject({
      status: 'completed',
      phase: 'completed',
      buildSession: {
        nodeType: 'shape',
        nodeId: 'staging-root',
        status: 'completed',
      },
      progress: {
        total: 1,
        completed: 1,
        percentage: 100,
      },
    });
  });

  it('persists pending references and resolved references from the injected resolver', async () => {
    const resolveReferences = vi
      .fn<StagedFolderActionRunnerDependencies['resolveReferences']>()
      .mockResolvedValueOnce({
        warnings: [
          {
            category: 'reference',
            code: 'STAGED_FOLDER_ACTION_REFERENCE_PENDING',
            message: 'lazy reference is unresolved',
            referencePath: 'imports/shape-a',
          },
        ],
        pendingReferences: [
          {
            status: 'pending',
            code: 'STAGED_FOLDER_ACTION_REFERENCE_PENDING',
            referencePath: 'imports/shape-a',
            expectedTargetType: 'shape',
          },
        ],
      })
      .mockResolvedValueOnce({
        warnings: [
          {
            category: 'reference',
            code: 'STAGED_FOLDER_ACTION_REFERENCE_PENDING',
            message: 'lazy reference is unresolved before build',
            actionIndex: 0,
            actionType: 'build',
            referencePath: 'imports/shape-a',
          },
        ],
        pendingReferences: [
          {
            status: 'pending',
            code: 'STAGED_FOLDER_ACTION_REFERENCE_PENDING',
            actionIndex: 0,
            actionType: 'build',
            referencePath: 'imports/shape-a',
            expectedTargetType: 'shape',
          },
        ],
      })
      .mockResolvedValueOnce({
        warnings: [],
        pendingReferences: [
          {
            status: 'resolved',
            code: 'STAGED_FOLDER_ACTION_REFERENCE_RESOLVED',
            actionIndex: 0,
            actionType: 'build',
            referencePath: 'imports/shape-a',
            expectedTargetType: 'shape',
            resolvedTargetNodeId: 'target-shape-a',
          },
        ],
      });
    const dependencies = createDependencies({ resolveReferences });

    const result = await runStagedFolderAction(dependencies, {
      runId: 'run-reference-resolution' as NodeId,
      sourceNodeId: 'source-reference-resolution' as NodeId,
      config: createConfig({
        actions: [{ type: 'build', mode: 'session-manager' }],
      }),
    });

    expect(resolveReferences).toHaveBeenCalledTimes(3);
    expect(resolveReferences.mock.calls.map(([input]) => input?.phase)).toEqual([
      'after-overlay',
      'before-action',
      'after-action',
    ]);
    expect(resolveReferences.mock.calls[2]?.[0]?.pendingReferences).toEqual([
      expect.objectContaining({
        status: 'pending',
        referencePath: 'imports/shape-a',
        actionType: 'build',
      }),
    ]);
    expect(result).toMatchObject({
      status: 'completed',
      phase: 'completed',
      warnings: [],
      pendingReferences: [
        {
          status: 'resolved',
          referencePath: 'imports/shape-a',
          resolvedTargetNodeId: 'target-shape-a',
        },
      ],
    });
  });

  it('fails dependency resolver errors without converting them to warnings', async () => {
    const dependencies = createDependencies({
      resolveReferences: vi.fn(async () => {
        throw new Error('stale edge missing rebuild target');
      }),
    });

    await expect(
      runStagedFolderAction(dependencies, {
        runId: 'run-dependency-failure' as NodeId,
        sourceNodeId: 'source-dependency-failure' as NodeId,
        config: createConfig({ actions: [] }),
      })
    ).rejects.toThrow(/stale edge missing rebuild target/);
    await expect(store.getRun('run-dependency-failure' as NodeId)).resolves.toMatchObject({
      status: 'failed',
      phase: 'failed',
      error: 'stale edge missing rebuild target',
      failure: {
        category: 'dependency',
        code: 'STAGED_FOLDER_ACTION_DEPENDENCY_CONTRACT_VIOLATION',
        message: 'stale edge missing rebuild target',
      },
      warnings: [],
      pendingReferences: [],
    });
  });

  it('runs map image capture only after the preceding build action completes', async () => {
    const order: string[] = [];
    const dependencies = createDependencies({
      runBuildAction: vi.fn(async () => {
        order.push('build');
        return {
          nodeType: 'shape' as NodeType,
          nodeId: 'staging-root' as NodeId,
          status: 'completed',
        };
      }),
      runMapImageCaptureAction: vi.fn(async () => {
        order.push('capture');
      }),
    });

    await runStagedFolderAction(dependencies, {
      runId: 'run-capture' as NodeId,
      sourceNodeId: 'source-capture' as NodeId,
      browserMode: 'headed',
      config: createConfig({
        actions: [
          { type: 'build', mode: 'session-manager' },
          {
            type: 'map-image-capture',
            mode: 'map-ui',
            output: { path: './out.png', width: 800, height: 600 },
            viewport: { bbox: [139, 35, 140, 36] },
            layers: [{ path: '.', visible: true }],
          },
        ],
      }),
    });

    expect(order).toEqual(['build', 'capture']);
    expect(dependencies.runMapImageCaptureAction).toHaveBeenCalledWith({
      intent: {
        intentId: 'run-capture:1',
        runId: 'run-capture',
        stagingRootNodeId: 'staging-root',
        browserMode: 'headed',
        mapRoute: {
          nodeId: 'staging-root',
          search: {
            captureIntentId: 'run-capture:1',
          },
        },
        viewport: {
          bbox: [139, 35, 140, 36],
          width: 800,
          height: 600,
        },
        layers: [{ path: '.', visible: true }],
        output: {
          path: './out.png',
        },
      },
      config: expect.any(Object),
      stagingRootNodeId: 'staging-root',
      runId: 'run-capture',
      reportProgress: expect.any(Function),
    });
    await expect(store.getMapImageCaptureIntent('run-capture:1')).resolves.toMatchObject({
      intentId: 'run-capture:1',
      runId: 'run-capture',
      stagingRootNodeId: 'staging-root',
      browserMode: 'headed',
    });
    await expect(store.getRun('run-capture' as NodeId)).resolves.toMatchObject({
      status: 'completed',
      phase: 'completed',
      progress: {
        total: 2,
        completed: 2,
        percentage: 100,
      },
    });
  });

  it('lets the map image capture runner report action-specific phases to the run progress store', async () => {
    const observedPhases: string[] = [];
    const dependencies = createDependencies({
      runMapImageCaptureAction: vi.fn(async ({ reportProgress }) => {
        await reportProgress({ phase: 'opening-map-ui', percentage: 25 });
        observedPhases.push(
          (await store.getRun('run-capture-progress' as NodeId))?.currentAction?.phase ?? ''
        );
        await reportProgress({ phase: 'waiting-render-ready', percentage: 50 });
        observedPhases.push(
          (await store.getRun('run-capture-progress' as NodeId))?.currentAction?.phase ?? ''
        );
        await reportProgress({ phase: 'writing-output', percentage: 90 });
        observedPhases.push(
          (await store.getRun('run-capture-progress' as NodeId))?.currentAction?.phase ?? ''
        );
      }),
    });

    await runStagedFolderAction(dependencies, {
      runId: 'run-capture-progress' as NodeId,
      sourceNodeId: 'source-capture-progress' as NodeId,
      browserMode: 'headless',
      config: createConfig({
        actions: [
          { type: 'build', mode: 'session-manager' },
          {
            type: 'map-image-capture',
            mode: 'map-ui',
            output: { path: './out.png', width: 800, height: 600 },
            viewport: { bbox: [139, 35, 140, 36] },
            layers: [{ path: '.', visible: true }],
          },
        ],
      }),
    });

    expect(observedPhases).toEqual(['opening-map-ui', 'waiting-render-ready', 'writing-output']);
    await expect(store.getRun('run-capture-progress' as NodeId)).resolves.toMatchObject({
      status: 'completed',
      phase: 'completed',
      currentAction: undefined,
    });
  });

  it('connects injected map image capture actions to the standard browser runner', async () => {
    const page = {} as PlaywrightLikeMapImageCapturePage;
    const browser = {
      newPage: vi.fn(async () => page),
      close: vi.fn(async () => {}),
    };
    const launchBrowser = vi.fn(async () => browser);
    const pagePort: MapImageCaptureBrowserPagePort = {
      startPageFailureMonitoring: vi.fn(async () => {}),
      setViewportSize: vi.fn(async () => {}),
      goto: vi.fn(async () => {}),
      waitForRenderStatus: vi.fn(async () => 'ready' as const),
      assertNonBlankCanvas: vi.fn(async () => true),
      collectPageFailures: vi.fn(async () => []),
      screenshot: vi.fn(async () => {}),
    };
    const dependencies = createDependencies({
      runMapImageCaptureAction: createMapImageCaptureBrowserActionRunner({
        baseUrl: 'http://localhost:3000/app/',
        routeMode: 'browser',
        timeoutMs: 5000,
        outputBasePath: '/tmp/hdb-capture-output',
        launchBrowser,
        createPagePort: () => pagePort,
      }),
    });

    const result = await runStagedFolderAction(dependencies, {
      runId: 'run-capture-browser-host' as NodeId,
      sourceNodeId: 'source-capture-browser-host' as NodeId,
      browserMode: 'headed',
      config: createConfig({
        actions: [
          { type: 'build', mode: 'session-manager' },
          {
            type: 'map-image-capture',
            mode: 'map-ui',
            output: { path: 'exports/map.png', width: 800, height: 600 },
            viewport: { bbox: [139, 35, 140, 36] },
            layers: [{ path: '.', visible: true }],
          },
        ],
      }),
    });

    expect(result).toMatchObject({
      status: 'completed',
      phase: 'completed',
      progress: { total: 2, completed: 2, percentage: 100 },
    });
    expect(launchBrowser).toHaveBeenCalledWith({ browserMode: 'headed' });
    expect(pagePort.goto).toHaveBeenCalledWith(
      'http://localhost:3000/app/map/staging-root?captureIntentId=run-capture-browser-host%3A1'
    );
    expect(pagePort.screenshot).toHaveBeenCalledWith({
      path: path.join('/tmp/hdb-capture-output', 'exports/map.png'),
      fullPage: false,
    });
    await expect(
      store.getMapImageCaptureIntent('run-capture-browser-host:1')
    ).resolves.toMatchObject({
      intentId: 'run-capture-browser-host:1',
      stagingRootNodeId: 'staging-root',
      browserMode: 'headed',
    });
  });

  it('requires browser mode before handing off map image capture', async () => {
    const dependencies = createDependencies({
      runMapImageCaptureAction: vi.fn(async () => {}),
    });

    await expect(
      runStagedFolderAction(dependencies, {
        runId: 'run-capture-no-browser' as NodeId,
        sourceNodeId: 'source-capture-no-browser' as NodeId,
        config: createConfig({
          actions: [
            { type: 'build', mode: 'session-manager' },
            {
              type: 'map-image-capture',
              mode: 'map-ui',
              output: { path: './out.png', width: 800, height: 600 },
              viewport: { bbox: [139, 35, 140, 36] },
              layers: [{ path: '.', visible: true }],
            },
          ],
        }),
      })
    ).rejects.toThrow(/map-image-capture action requires browserMode/);
    expect(dependencies.runMapImageCaptureAction).not.toHaveBeenCalled();
  });

  it('runs export file actions through the injected export runner and stores action results', async () => {
    const runExportFileAction = vi.fn(async () => ({
      type: 'export-csv' as const,
      status: 'completed' as const,
      outputPath: '/tmp/locations.csv',
      entityType: 'location' as const,
      rowCount: 2,
    }));
    const dependencies = createDependencies({ runExportFileAction });
    const action = {
      type: 'export-csv' as const,
      entityType: 'location' as const,
      source: { path: '.' },
      output: { path: 'locations.csv' },
      columns: ['name', 'lat', 'lng'],
    };

    const result = await runStagedFolderAction(dependencies, {
      runId: 'run-export-csv' as NodeId,
      sourceNodeId: 'source-export-csv' as NodeId,
      config: createConfig({
        actions: [action],
      }),
    });

    expect(runExportFileAction).toHaveBeenCalledWith({
      action,
      actionIndex: 0,
      config: expect.any(Object),
      stagingRootNodeId: 'staging-root',
      runId: 'run-export-csv',
    });
    expect(result).toMatchObject({
      status: 'completed',
      actionResults: [
        {
          type: 'export-csv',
          status: 'completed',
          outputPath: '/tmp/locations.csv',
          entityType: 'location',
          rowCount: 2,
        },
      ],
    });
  });

  it('records failure when export file action has no configured runner', async () => {
    const dependencies = createDependencies();

    await expect(
      runStagedFolderAction(dependencies, {
        runId: 'run-missing-export' as NodeId,
        sourceNodeId: 'source-missing-export' as NodeId,
        config: createConfig({
          actions: [
            {
              type: 'export-xlsx',
              entityType: 'route',
              source: { path: '.' },
              output: { path: 'routes.xlsx' },
            },
          ],
        }),
      })
    ).rejects.toThrow(/export-xlsx action runner is not configured/);
    await expect(store.getRun('run-missing-export' as NodeId)).resolves.toMatchObject({
      status: 'failed',
      phase: 'failed',
      error: 'export-xlsx action runner is not configured',
      currentAction: {
        actionIndex: 0,
        actionType: 'export-xlsx',
      },
    });
  });

  it('runs export archive actions through the injected archive runner and stores action results', async () => {
    const runExportArchiveAction = vi.fn(async () => ({
      type: 'export-archive' as const,
      status: 'completed' as const,
      outputPath: '/tmp/archive.zip',
      format: 'canonical-yaml-zip' as const,
      byteLength: 128,
      nodeIds: ['staging-root' as NodeId],
    }));
    const dependencies = createDependencies({ runExportArchiveAction });
    const action = {
      type: 'export-archive' as const,
      format: 'canonical-yaml-zip' as const,
      source: { path: '.' },
      output: { path: 'archive.zip' },
    };

    const result = await runStagedFolderAction(dependencies, {
      runId: 'run-export-archive' as NodeId,
      sourceNodeId: 'source-export-archive' as NodeId,
      config: createConfig({
        actions: [action],
      }),
    });

    expect(runExportArchiveAction).toHaveBeenCalledWith({
      action,
      actionIndex: 0,
      config: expect.any(Object),
      stagingRootNodeId: 'staging-root',
      runId: 'run-export-archive',
    });
    expect(result).toMatchObject({
      status: 'completed',
      actionResults: [
        {
          type: 'export-archive',
          status: 'completed',
          outputPath: '/tmp/archive.zip',
          format: 'canonical-yaml-zip',
          byteLength: 128,
          nodeIds: ['staging-root'],
        },
      ],
    });
  });

  it('safe unmounts run-lifetime import mounts before deleting staging roots', async () => {
    const order: string[] = [];
    const runImportMountAction = vi.fn(async () => {
      order.push('import-mount');
      return {
        type: 'import-mount' as const,
        status: 'completed' as const,
        mountId: 'mount-run',
        mountedRootNodeId: 'mounted-root' as NodeId,
        importedNodeIds: ['mounted-root' as NodeId],
        lifetime: 'run' as const,
      };
    });
    const safeUnmountImportMounts = vi.fn(async () => {
      order.push('safe-unmount');
    });
    const cleanup = vi.fn(async () => {
      order.push('cleanup');
    });
    const dependencies = createDependencies({
      runImportMountAction,
      safeUnmountImportMounts,
      cleanup,
    });
    const action = {
      type: 'import-mount' as const,
      format: 'canonical-yaml-zip' as const,
      input: { path: 'archive.zip' },
      mount: {
        parentPath: '.',
        name: 'Mounted',
        lifetime: 'run' as const,
      },
    };

    const result = await runStagedFolderAction(dependencies, {
      runId: 'run-import-mount' as NodeId,
      sourceNodeId: 'source-import-mount' as NodeId,
      config: createConfig({
        actions: [action],
      }),
    });

    expect(order).toEqual(['import-mount', 'safe-unmount', 'cleanup']);
    expect(safeUnmountImportMounts).toHaveBeenCalledWith({
      config: expect.any(Object),
      stagingRootNodeId: 'staging-root',
      runId: 'run-import-mount',
      mounts: [
        {
          type: 'import-mount',
          status: 'completed',
          mountId: 'mount-run',
          mountedRootNodeId: 'mounted-root',
          importedNodeIds: ['mounted-root'],
          lifetime: 'run',
        },
      ],
    });
    expect(result).toMatchObject({
      status: 'completed',
      actionResults: [
        {
          type: 'import-mount',
          mountId: 'mount-run',
          mountedRootNodeId: 'mounted-root',
          importedNodeIds: ['mounted-root'],
          lifetime: 'run',
        },
      ],
    });
  });

  it('does not safe unmount retained import mounts', async () => {
    const safeUnmountImportMounts = vi.fn(async () => {});
    const dependencies = createDependencies({
      runImportMountAction: vi.fn(async () => ({
        type: 'import-mount' as const,
        status: 'completed' as const,
        mountId: 'mount-retain',
        mountedRootNodeId: 'mounted-root' as NodeId,
        importedNodeIds: ['mounted-root' as NodeId],
        lifetime: 'retain' as const,
      })),
      safeUnmountImportMounts,
    });

    await runStagedFolderAction(dependencies, {
      runId: 'run-import-mount-retain' as NodeId,
      sourceNodeId: 'source-import-mount-retain' as NodeId,
      config: createConfig({
        actions: [
          {
            type: 'import-mount',
            format: 'canonical-yaml-zip',
            input: { path: 'archive.zip' },
            mount: {
              parentPath: '.',
              name: 'Mounted',
              lifetime: 'retain',
            },
          },
        ],
      }),
    });

    expect(safeUnmountImportMounts).not.toHaveBeenCalled();
  });

  it('keeps the primary failure when run-lifetime safe unmount also fails', async () => {
    const cleanup = vi.fn(async () => {});
    const dependencies = createDependencies({
      runImportMountAction: vi.fn(async () => ({
        type: 'import-mount' as const,
        status: 'completed' as const,
        mountId: 'mount-run',
        mountedRootNodeId: 'mounted-root' as NodeId,
        importedNodeIds: ['mounted-root' as NodeId],
        lifetime: 'run' as const,
      })),
      safeUnmountImportMounts: vi.fn(async () => {
        throw new Error('safe unmount failed');
      }),
      runBuildAction: vi.fn(async () => {
        throw new Error('build failed');
      }),
      cleanup,
    });

    await expect(
      runStagedFolderAction(dependencies, {
        runId: 'run-import-mount-unmount-failure' as NodeId,
        sourceNodeId: 'source-import-mount-unmount-failure' as NodeId,
        config: {
          ...createConfig({
            actions: [
              {
                type: 'import-mount',
                format: 'canonical-yaml-zip',
                input: { path: 'archive.zip' },
                mount: {
                  parentPath: '.',
                  name: 'Mounted',
                  lifetime: 'run',
                },
              },
              { type: 'build', mode: 'session-manager' },
            ],
          }),
          staging: {
            mode: 'temporary-copy',
            cleanup: 'delete-always',
          },
        },
      })
    ).rejects.toThrow(/build failed; cleanup failed: safe unmount failed/);
    await expect(store.getRun('run-import-mount-unmount-failure' as NodeId)).resolves.toMatchObject(
      {
        status: 'failed',
        error: 'build failed; cleanup failed: safe unmount failed',
      }
    );
    expect(cleanup).not.toHaveBeenCalled();
  });

  it('fails successful action sequences when run-lifetime safe unmount fails', async () => {
    const safeUnmountImportMounts = vi.fn(async () => {
      throw new Error('safe unmount failed');
    });
    const cleanup = vi.fn(async () => {});
    const dependencies = createDependencies({
      runImportMountAction: vi.fn(async () => ({
        type: 'import-mount' as const,
        status: 'completed' as const,
        mountId: 'mount-run',
        mountedRootNodeId: 'mounted-root' as NodeId,
        importedNodeIds: ['mounted-root' as NodeId],
        lifetime: 'run' as const,
      })),
      safeUnmountImportMounts,
      cleanup,
    });

    await expect(
      runStagedFolderAction(dependencies, {
        runId: 'run-import-mount-success-unmount-failure' as NodeId,
        sourceNodeId: 'source-import-mount-success-unmount-failure' as NodeId,
        config: {
          ...createConfig({
            actions: [
              {
                type: 'import-mount',
                format: 'canonical-yaml-zip',
                input: { path: 'archive.zip' },
                mount: {
                  parentPath: '.',
                  name: 'Mounted',
                  lifetime: 'run',
                },
              },
            ],
          }),
          staging: {
            mode: 'temporary-copy',
            cleanup: 'delete-always',
          },
        },
      })
    ).rejects.toThrow(/safe unmount failed/);

    expect(safeUnmountImportMounts).toHaveBeenCalledTimes(1);
    expect(cleanup).not.toHaveBeenCalled();
    await expect(
      store.getRun('run-import-mount-success-unmount-failure' as NodeId)
    ).resolves.toMatchObject({
      status: 'failed',
      error: 'safe unmount failed',
    });
  });

  it('rejects export runner results that do not match the executed action', async () => {
    const dependencies = createDependencies({
      runExportFileAction: vi.fn(async () => ({
        type: 'export-xlsx' as const,
        status: 'completed' as const,
        outputPath: '/tmp/locations.xlsx',
        entityType: 'location' as const,
        rowCount: 2,
        sheetName: 'location',
      })),
    });

    await expect(
      runStagedFolderAction(dependencies, {
        runId: 'run-export-mismatch' as NodeId,
        sourceNodeId: 'source-export-mismatch' as NodeId,
        config: createConfig({
          actions: [
            {
              type: 'export-csv',
              entityType: 'location',
              source: { path: '.' },
              output: { path: 'locations.csv' },
            },
          ],
        }),
      })
    ).rejects.toThrow(
      /export action result type export-xlsx does not match action type export-csv/
    );
    await expect(store.getRun('run-export-mismatch' as NodeId)).resolves.toMatchObject({
      status: 'failed',
      phase: 'failed',
      error: 'export action result type export-xlsx does not match action type export-csv',
    });
  });

  it('records failure when map image capture has no configured runner', async () => {
    const dependencies = createDependencies();

    await expect(
      runStagedFolderAction(dependencies, {
        runId: 'run-missing-capture' as NodeId,
        sourceNodeId: 'source-missing-capture' as NodeId,
        browserMode: 'headless',
        config: createConfig({
          actions: [
            { type: 'build', mode: 'session-manager' },
            {
              type: 'map-image-capture',
              mode: 'map-ui',
              output: { path: './out.png', width: 800, height: 600 },
              viewport: { bbox: [139, 35, 140, 36] },
              layers: [{ path: '.', visible: true }],
            },
          ],
        }),
      })
    ).rejects.toThrow(/map-image-capture action runner is not configured/);
    await expect(store.getRun('run-missing-capture' as NodeId)).resolves.toMatchObject({
      status: 'failed',
      phase: 'failed',
      error: 'map-image-capture action runner is not configured',
    });
  });

  it('runs cleanup on successful delete-on-success runs', async () => {
    const cleanup = vi.fn(async () => {});
    const dependencies = createDependencies({ cleanup });

    await runStagedFolderAction(dependencies, {
      runId: 'run-cleanup-success' as NodeId,
      sourceNodeId: 'source-cleanup-success' as NodeId,
      config: createConfig({ actions: [] }),
    });

    expect(cleanup).toHaveBeenCalledWith({
      config: expect.any(Object),
      stagingRootNodeId: 'staging-root',
      runId: 'run-cleanup-success',
    });
  });

  it('runs cleanup after a failed action when cleanup is delete-always', async () => {
    const cleanup = vi.fn(async () => {});
    const dependencies = createDependencies({
      cleanup,
      runBuildAction: vi.fn(async () => {
        throw new Error('build failed');
      }),
    });

    await expect(
      runStagedFolderAction(dependencies, {
        runId: 'run-cleanup-failure' as NodeId,
        sourceNodeId: 'source-cleanup-failure' as NodeId,
        config: {
          ...createConfig({ actions: [{ type: 'build', mode: 'session-manager' }] }),
          staging: {
            mode: 'temporary-copy',
            cleanup: 'delete-always',
          },
        },
      })
    ).rejects.toThrow(/build failed/);

    expect(cleanup).toHaveBeenCalledWith({
      config: expect.any(Object),
      stagingRootNodeId: 'staging-root',
      runId: 'run-cleanup-failure',
    });
    await expect(store.getRun('run-cleanup-failure' as NodeId)).resolves.toMatchObject({
      status: 'failed',
      error: 'build failed',
    });
  });

  it('surfaces cleanup failure in both the rejected error and the run record', async () => {
    const dependencies = createDependencies({
      cleanup: vi.fn(async () => {
        throw new Error('cleanup failed');
      }),
      runBuildAction: vi.fn(async () => {
        throw new Error('build failed');
      }),
    });

    await expect(
      runStagedFolderAction(dependencies, {
        runId: 'run-cleanup-rejection' as NodeId,
        sourceNodeId: 'source-cleanup-rejection' as NodeId,
        config: {
          ...createConfig({ actions: [{ type: 'build', mode: 'session-manager' }] }),
          staging: {
            mode: 'temporary-copy',
            cleanup: 'delete-always',
          },
        },
      })
    ).rejects.toThrow(/build failed; cleanup failed: cleanup failed/);

    await expect(store.getRun('run-cleanup-rejection' as NodeId)).resolves.toMatchObject({
      status: 'failed',
      error: 'build failed; cleanup failed: cleanup failed',
    });
  });

  it('does not retry successful cleanup failures through the delete-always failure path', async () => {
    const cleanup = vi.fn(async () => {
      throw new Error('cleanup failed');
    });
    const dependencies = createDependencies({ cleanup });

    await expect(
      runStagedFolderAction(dependencies, {
        runId: 'run-success-cleanup-rejection' as NodeId,
        sourceNodeId: 'source-success-cleanup-rejection' as NodeId,
        config: {
          ...createConfig({ actions: [] }),
          staging: {
            mode: 'temporary-copy',
            cleanup: 'delete-always',
          },
        },
      })
    ).rejects.toThrow(/cleanup failed/);

    expect(cleanup).toHaveBeenCalledTimes(1);
    await expect(store.getRun('run-success-cleanup-rejection' as NodeId)).resolves.toMatchObject({
      status: 'failed',
      error: 'cleanup failed',
    });
  });

  it('runs delete-always failure cleanup when the success cleanup progress update fails', async () => {
    const cleanup = vi.fn(async () => {});
    const dependencies = createDependencies({ cleanup });
    const originalUpdateRun = store.updateRun.bind(store);
    vi.spyOn(store, 'updateRun').mockImplementation(async (runId, patch) => {
      if (patch.status === 'running' && patch.phase === 'cleanup' && patch.progress !== undefined) {
        throw new Error('cleanup progress update failed');
      }
      return originalUpdateRun(runId, patch);
    });

    await expect(
      runStagedFolderAction(dependencies, {
        runId: 'run-success-cleanup-progress-failure' as NodeId,
        sourceNodeId: 'source-success-cleanup-progress-failure' as NodeId,
        config: {
          ...createConfig({ actions: [] }),
          staging: {
            mode: 'temporary-copy',
            cleanup: 'delete-always',
          },
        },
      })
    ).rejects.toThrow(/cleanup progress update failed/);

    expect(cleanup).toHaveBeenCalledTimes(1);
    await expect(
      store.getRun('run-success-cleanup-progress-failure' as NodeId)
    ).resolves.toMatchObject({
      status: 'failed',
      error: 'cleanup progress update failed',
    });
  });

  const createDependencies = (
    overrides: Partial<StagedFolderActionRunnerDependencies> = {}
  ): StagedFolderActionRunnerDependencies => ({
    progressStore: store,
    now: () => nowValue++,
    prepareStaging: vi.fn(async () => ({
      stagingRootNodeId: 'staging-root' as NodeId,
    })),
    applyOverlays: vi.fn(async () => {}),
    runBuildAction: vi.fn(async () => ({
      nodeType: 'shape' as NodeType,
      nodeId: 'staging-root' as NodeId,
      status: 'completed',
    })),
    ...overrides,
  });
});

const createConfig = ({
  actions,
}: Pick<StagedFolderActionConfig, 'actions'>): StagedFolderActionConfig => ({
  version: 1,
  staging: {
    mode: 'temporary-copy',
    cleanup: 'delete-on-success',
  },
  overlay: {
    nodes: [],
  },
  actions,
});
