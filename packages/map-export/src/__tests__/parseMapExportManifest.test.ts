import { describe, expect, it } from 'vitest';
import { MapExportManifestError, parseMapExportManifest } from '../index.js';

const jsonManifest = JSON.stringify({
  version: 1,
  jobs: [
    {
      id: 'tokyo-routes',
      output: { path: 'exports/tokyo-routes.png' },
      viewport: { width: 1280, height: 720 },
      bbox: [139.5, 35.5, 140, 36],
      nodes: [
        {
          nodeId: 'route-node',
          nodeType: 'route',
          data: {
            buildConfig: { routeGeneration: { method: 'direct' } },
          },
        },
      ],
      layers: [{ nodeId: 'route-node', visible: true }],
    },
  ],
});

const yamlManifest = `
version: 1
jobs:
  - id: tokyo-routes
    output:
      path: exports/tokyo-routes.png
    viewport:
      width: 1280
      height: 720
    bbox: [139.5, 35.5, 140, 36]
    nodes:
      - nodeId: route-node
        nodeType: route
        data:
          buildConfig:
            routeGeneration:
              method: direct
    layers:
      - nodeId: route-node
        visible: true
`;

const expectManifestError = (action: () => unknown, code: MapExportManifestError['code']): void => {
  expect(action).toThrow(MapExportManifestError);
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(MapExportManifestError);
    expect((error as MapExportManifestError).code).toBe(code);
    return;
  }
  throw new Error('expected manifest error');
};

describe('parseMapExportManifest', () => {
  it('normalizes equivalent JSON and YAML manifests', () => {
    expect(parseMapExportManifest(jsonManifest, { format: 'json' })).toEqual(
      parseMapExportManifest(yamlManifest, { format: 'yaml' })
    );
  });

  it('rejects draftData in node payloads', () => {
    expectManifestError(
      () =>
        parseMapExportManifest(
          JSON.stringify({
            version: 1,
            jobs: [
              {
                id: 'bad',
                output: { path: 'bad.png' },
                viewport: { width: 100, height: 100 },
                bbox: [0, 0, 1, 1],
                nodes: [{ nodeType: 'shape', draftData: {}, data: {} }],
              },
            ],
          }),
          { format: 'json' }
        ),
      'MAP_EXPORT_MANIFEST_INVALID_NODE_DATA'
    );
  });

  it('rejects invalid bbox ordering', () => {
    expectManifestError(
      () =>
        parseMapExportManifest(
          JSON.stringify({
            version: 1,
            jobs: [
              {
                id: 'bad',
                output: { path: 'bad.png' },
                viewport: { width: 100, height: 100 },
                bbox: [10, 0, 10, 1],
                nodes: [{ nodeType: 'shape', data: {} }],
              },
            ],
          }),
          { format: 'json' }
        ),
      'MAP_EXPORT_MANIFEST_INVALID_BBOX'
    );
  });

  it('rejects unsupported node types', () => {
    expectManifestError(
      () =>
        parseMapExportManifest(
          JSON.stringify({
            version: 1,
            jobs: [
              {
                id: 'bad',
                output: { path: 'bad.png' },
                viewport: { width: 100, height: 100 },
                bbox: [0, 0, 1, 1],
                nodes: [{ nodeType: 'folder', data: {} }],
              },
            ],
          }),
          { format: 'json' }
        ),
      'MAP_EXPORT_MANIFEST_INVALID_NODE_TYPE'
    );
  });

  it('rejects unsafe output paths', () => {
    expectManifestError(
      () =>
        parseMapExportManifest(
          JSON.stringify({
            version: 1,
            jobs: [
              {
                id: 'bad',
                output: { path: '../bad.png' },
                viewport: { width: 100, height: 100 },
                bbox: [0, 0, 1, 1],
                nodes: [{ nodeType: 'shape', data: {} }],
              },
            ],
          }),
          { format: 'json' }
        ),
      'MAP_EXPORT_MANIFEST_INVALID_OUTPUT_PATH'
    );
  });
});
