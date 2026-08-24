import { describe, expect, it } from 'vitest';
import {
  parseStagedFolderActionManifest,
  stagedFolderActionRegistry,
  StagedFolderActionManifestError,
  validateStagedFolderActionCliOptions,
} from '../index.js';

const validManifest = {
  version: 1,
  staging: {
    mode: 'temporary-copy',
    name: 'tokyo-map-capture',
    cleanup: 'retain',
  },
  overlay: {
    nodes: [
      {
        match: { path: 'routes/main' },
        data: { buildConfig: { routeGeneration: { method: 'direct' } } },
      },
    ],
  },
  actions: [
    { type: 'build', mode: 'session-manager' },
    {
      type: 'map-image-capture',
      mode: 'map-ui',
      output: { path: 'exports/tokyo.png', width: 1280, height: 720 },
      viewport: { bbox: [139.5, 35.5, 140, 36] },
      layers: [{ path: 'routes/main', visible: true }],
    },
  ],
};

const validYamlManifest = `
version: 1
staging:
  mode: temporary-copy
  name: tokyo-map-capture
  cleanup: retain
overlay:
  nodes:
    - match:
        path: routes/main
      data:
        buildConfig:
          routeGeneration:
            method: direct
actions:
  - type: build
    mode: session-manager
  - type: map-image-capture
    mode: map-ui
    output:
      path: exports/tokyo.png
      width: 1280
      height: 720
    viewport:
      bbox: [139.5, 35.5, 140, 36]
    layers:
      - path: routes/main
        visible: true
`;

const parseJson = (value: unknown) =>
  parseStagedFolderActionManifest(JSON.stringify(value), { format: 'json' });

const expectManifestError = (
  action: () => unknown,
  code: StagedFolderActionManifestError['code']
): void => {
  expect(action).toThrow(StagedFolderActionManifestError);
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(StagedFolderActionManifestError);
    expect((error as StagedFolderActionManifestError).code).toBe(code);
    return;
  }
  throw new Error('expected staged folder action manifest error');
};

describe('parseStagedFolderActionManifest', () => {
  it('normalizes equivalent JSON and YAML manifests', () => {
    expect(parseJson(validManifest)).toEqual(
      parseStagedFolderActionManifest(validYamlManifest, { format: 'yaml' })
    );
  });

  it('accepts an empty actions array as staging and overlay only', () => {
    expect(parseJson({ ...validManifest, actions: [] }).actions).toEqual([]);
  });

  it('defines registry entries for the initial action types', () => {
    expect(Object.keys(stagedFolderActionRegistry).sort()).toEqual([
      'build',
      'export-archive',
      'export-csv',
      'export-xlsx',
      'import-mount',
      'map-image-capture',
    ]);
    for (const entry of Object.values(stagedFolderActionRegistry)) {
      expect(entry.schema).toBeTruthy();
      expect(entry.prerequisite).toBeTruthy();
      expect(entry.executionOwner).toBeTruthy();
      expect(entry.resultSchema).toBeTruthy();
      expect(entry.artifactPolicy).toBeTruthy();
      expect(entry.errorCategory).toBeTruthy();
    }
  });

  it('rejects unsupported versions and staging modes', () => {
    expectManifestError(
      () => parseJson({ ...validManifest, version: 2 }),
      'STAGED_FOLDER_ACTION_MANIFEST_UNSUPPORTED_VERSION'
    );
    expectManifestError(
      () =>
        parseJson({
          ...validManifest,
          staging: { ...validManifest.staging, mode: 'copy-source' },
        }),
      'STAGED_FOLDER_ACTION_MANIFEST_INVALID_STAGING_MODE'
    );
  });

  it('rejects unknown action types', () => {
    expectManifestError(
      () => parseJson({ ...validManifest, actions: [{ type: 'unknown-action' }] }),
      'STAGED_FOLDER_ACTION_MANIFEST_INVALID_ACTION'
    );
  });

  it('rejects unsupported build modes', () => {
    expectManifestError(
      () =>
        parseJson({
          ...validManifest,
          actions: [{ type: 'build', mode: 'inline' }],
        }),
      'STAGED_FOLDER_ACTION_MANIFEST_INVALID_ACTION'
    );
  });

  it('rejects map-image-capture without a preceding build action', () => {
    expectManifestError(
      () => parseJson({ ...validManifest, actions: [validManifest.actions[1]] }),
      'STAGED_FOLDER_ACTION_MANIFEST_INVALID_ACTION'
    );
  });

  it('rejects invalid map-image-capture mode and bbox', () => {
    expectManifestError(
      () =>
        parseJson({
          ...validManifest,
          actions: [
            validManifest.actions[0],
            { ...validManifest.actions[1], mode: 'headless-browser' },
          ],
        }),
      'STAGED_FOLDER_ACTION_MANIFEST_INVALID_ACTION'
    );
    expectManifestError(
      () =>
        parseJson({
          ...validManifest,
          actions: [
            validManifest.actions[0],
            {
              ...validManifest.actions[1],
              viewport: { bbox: [10, 0, 10, 1] },
            },
          ],
        }),
      'STAGED_FOLDER_ACTION_MANIFEST_INVALID_BBOX'
    );
  });

  it('validates export and import action path contracts', () => {
    expect(parseJson({
      ...validManifest,
      actions: [
        {
          type: 'export-archive',
          format: 'canonical-yaml-zip',
          source: { path: '.' },
          output: { path: 'exports/archive.zip' },
        },
        {
          type: 'import-mount',
          format: 'canonical-yaml-zip',
          input: { path: 'imports/archive.zip' },
          mount: { parentPath: '.', name: 'mounted', lifetime: 'run' },
        },
      ],
    }).actions).toHaveLength(2);

    expectManifestError(
      () =>
        parseJson({
          ...validManifest,
          actions: [
            {
              type: 'export-archive',
              format: 'canonical-yaml-zip',
              source: { path: '.' },
              output: { path: '../archive.zip' },
            },
          ],
        }),
      'STAGED_FOLDER_ACTION_MANIFEST_INVALID_PATH'
    );
    expectManifestError(
      () =>
        parseJson({
          ...validManifest,
          actions: [
            {
              type: 'export-archive',
              format: 'json',
              source: { path: '.' },
              output: { path: 'exports/archive.zip' },
            },
          ],
        }),
      'STAGED_FOLDER_ACTION_MANIFEST_INVALID_ACTION'
    );
    expectManifestError(
      () =>
        parseJson({
          ...validManifest,
          actions: [
            {
              type: 'import-mount',
              format: 'canonical-yaml-zip',
              input: { path: 'imports/archive.zip' },
              mount: { parentPath: '.', name: 'mounted', lifetime: 'session' },
            },
          ],
        }),
      'STAGED_FOLDER_ACTION_MANIFEST_INVALID_ACTION'
    );
  });

  it('validates location and route CSV/XLSX export actions', () => {
    expect(parseJson({
      ...validManifest,
      actions: [
        {
          type: 'export-csv',
          entityType: 'location',
          source: { path: 'locations' },
          output: { path: 'exports/locations.csv' },
          includeDependencyStatus: true,
        },
        {
          type: 'export-xlsx',
          entityType: 'route',
          source: { path: 'routes' },
          output: { path: 'exports/routes.xlsx', sheetName: 'routes' },
          columns: ['name', 'start', 'end'],
        },
      ],
    }).actions).toHaveLength(2);

    expectManifestError(
      () =>
        parseJson({
          ...validManifest,
          actions: [
            {
              type: 'export-csv',
              entityType: 'shape',
              source: { path: 'shapes' },
              output: { path: 'exports/shapes.csv' },
            },
          ],
        }),
      'STAGED_FOLDER_ACTION_MANIFEST_INVALID_ACTION'
    );
    expectManifestError(
      () =>
        parseJson({
          ...validManifest,
          actions: [
            {
              type: 'export-xlsx',
              entityType: 'route',
              source: { path: 'routes' },
              output: { path: 'exports/routes.xlsx', sheetName: 'invalid:name' },
            },
          ],
        }),
      'STAGED_FOLDER_ACTION_MANIFEST_INVALID_ACTION'
    );
  });

  it('rejects unsafe overlay paths and duplicate overlay paths', () => {
    expectManifestError(
      () =>
        parseJson({
          ...validManifest,
          overlay: { nodes: [{ match: { path: '../bad' }, data: {} }] },
        }),
      'STAGED_FOLDER_ACTION_MANIFEST_INVALID_PATH'
    );
    expectManifestError(
      () =>
        parseJson({
          ...validManifest,
          overlay: {
            nodes: [
              { match: { path: 'routes/main' }, data: {} },
              { match: { path: 'routes/main' }, data: {} },
            ],
          },
        }),
      'STAGED_FOLDER_ACTION_MANIFEST_INVALID_OVERLAY'
    );
  });

  it('validates CLI source and output parent argument combinations', () => {
    const temporaryConfig = parseJson(validManifest);
    expectManifestError(
      () =>
        validateStagedFolderActionCliOptions({
          config: temporaryConfig,
        }),
      'STAGED_FOLDER_ACTION_MANIFEST_INVALID_CLI_ARGUMENTS'
    );
    expect(() =>
      validateStagedFolderActionCliOptions({
        config: temporaryConfig,
        sourceNodeId: 'source-folder',
      })
    ).not.toThrow();
    expectManifestError(
      () =>
        validateStagedFolderActionCliOptions({
          config: temporaryConfig,
          sourceNodeId: 'source-folder',
          outputParentNodeId: 'parent-folder',
        }),
      'STAGED_FOLDER_ACTION_MANIFEST_INVALID_CLI_ARGUMENTS'
    );

    const permanentConfig = parseJson({
      ...validManifest,
      staging: { ...validManifest.staging, mode: 'permanent-copy' },
    });
    expectManifestError(
      () =>
        validateStagedFolderActionCliOptions({
          config: permanentConfig,
          sourceNodeId: 'source-folder',
        }),
      'STAGED_FOLDER_ACTION_MANIFEST_INVALID_CLI_ARGUMENTS'
    );
    expect(() =>
      validateStagedFolderActionCliOptions({
        config: permanentConfig,
        sourceNodeId: 'source-folder',
        outputParentNodeId: 'parent-folder',
      })
    ).not.toThrow();

    const patchSourceConfig = parseJson({
      ...validManifest,
      staging: { mode: 'patch-source', cleanup: 'retain' },
    });
    expect(() =>
      validateStagedFolderActionCliOptions({
        config: patchSourceConfig,
        sourceNodeId: 'source-folder',
      })
    ).not.toThrow();
    expectManifestError(
      () =>
        validateStagedFolderActionCliOptions({
          config: patchSourceConfig,
          sourceNodeId: 'source-folder',
          outputParentNodeId: 'parent-folder',
        }),
      'STAGED_FOLDER_ACTION_MANIFEST_INVALID_CLI_ARGUMENTS'
    );
  });

  it('rejects cleanup deletion for patch-source', () => {
    expectManifestError(
      () =>
        parseJson({
          ...validManifest,
          staging: { mode: 'patch-source', cleanup: 'delete-on-success' },
        }),
      'STAGED_FOLDER_ACTION_MANIFEST_INVALID_CLEANUP'
    );
  });
});
