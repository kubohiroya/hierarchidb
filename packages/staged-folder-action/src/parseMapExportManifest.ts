import { parse as parseYaml } from 'yaml';
import type { MapExportManifestErrorCode } from './MapExportManifestError.js';
import { MapExportManifestError } from './MapExportManifestError.js';
import type {
  MapExportBbox,
  MapExportJob,
  MapExportLayerSelection,
  MapExportManifest,
  MapExportNodePayload,
  MapExportNodeType,
  ParseMapExportManifestOptions,
} from './MapExportManifestTypes.js';

const supportedNodeTypes = new Set<MapExportNodeType>(['shape', 'location', 'route']);

const fail = (code: MapExportManifestErrorCode, path: string, reason: string): never => {
  throw new MapExportManifestError({ code, path, reason });
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const requireRecord = (value: unknown, path: string): Record<string, unknown> => {
  if (!isRecord(value)) {
    fail('MAP_EXPORT_MANIFEST_ROOT_INVALID', path, 'expected an object');
  }
  return value as Record<string, unknown>;
};

const requireString = (value: unknown, path: string, code: MapExportManifestErrorCode): string => {
  if (typeof value !== 'string' || value.length === 0 || value !== value.trim()) {
    fail(code, path, 'expected a non-empty trimmed string');
  }
  return value as string;
};

const requirePositiveInteger = (
  value: unknown,
  path: string,
  code: MapExportManifestErrorCode
): number => {
  if (!Number.isInteger(value) || (value as number) <= 0) {
    fail(code, path, 'expected a positive integer');
  }
  return value as number;
};

const requireFiniteNumber = (
  value: unknown,
  path: string,
  code: MapExportManifestErrorCode
): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    fail(code, path, 'expected a finite number');
  }
  return value as number;
};

const parseDocument = (source: string, options: ParseMapExportManifestOptions): unknown => {
  try {
    if (options.format === 'json') {
      return JSON.parse(source) as unknown;
    }
    if (options.format === 'yaml') {
      return parseYaml(source);
    }
  } catch (error) {
    fail(
      'MAP_EXPORT_MANIFEST_PARSE_ERROR',
      '$',
      error instanceof Error ? error.message : String(error)
    );
  }
  fail(
    'MAP_EXPORT_MANIFEST_PARSE_ERROR',
    '$.format',
    `unsupported format ${String(options.format)}`
  );
};

const requireOutputPath = (value: unknown, path: string): string => {
  const outputPath = requireString(value, path, 'MAP_EXPORT_MANIFEST_INVALID_OUTPUT_PATH');
  if (
    outputPath.startsWith('/') ||
    outputPath.includes('\0') ||
    outputPath.split('/').some((segment) => segment === '..' || segment.length === 0)
  ) {
    fail(
      'MAP_EXPORT_MANIFEST_INVALID_OUTPUT_PATH',
      path,
      'expected a relative path without empty or parent-directory segments'
    );
  }
  return outputPath;
};

const requireBbox = (value: unknown, path: string): MapExportBbox => {
  if (!Array.isArray(value) || value.length !== 4) {
    fail('MAP_EXPORT_MANIFEST_INVALID_BBOX', path, 'expected [west, south, east, north]');
  }
  const bbox = value as readonly unknown[];
  const west = requireFiniteNumber(bbox[0], `${path}[0]`, 'MAP_EXPORT_MANIFEST_INVALID_BBOX');
  const south = requireFiniteNumber(bbox[1], `${path}[1]`, 'MAP_EXPORT_MANIFEST_INVALID_BBOX');
  const east = requireFiniteNumber(bbox[2], `${path}[2]`, 'MAP_EXPORT_MANIFEST_INVALID_BBOX');
  const north = requireFiniteNumber(bbox[3], `${path}[3]`, 'MAP_EXPORT_MANIFEST_INVALID_BBOX');
  if (west < -180 || west > 180 || east < -180 || east > 180 || west >= east) {
    fail(
      'MAP_EXPORT_MANIFEST_INVALID_BBOX',
      path,
      'longitude bounds must satisfy -180 <= west < east <= 180'
    );
  }
  if (south < -90 || south > 90 || north < -90 || north > 90 || south >= north) {
    fail(
      'MAP_EXPORT_MANIFEST_INVALID_BBOX',
      path,
      'latitude bounds must satisfy -90 <= south < north <= 90'
    );
  }
  return [west, south, east, north];
};

const requireNodes = (value: unknown, path: string): MapExportNodePayload[] => {
  if (!Array.isArray(value) || value.length === 0) {
    fail('MAP_EXPORT_MANIFEST_REQUIRED_FIELD_MISSING', path, 'expected at least one node payload');
  }
  const nodes = value as readonly unknown[];
  return nodes.map((entry, index) => {
    const nodePath = `${path}[${String(index)}]`;
    const node = requireRecord(entry, nodePath);
    if (Object.hasOwn(node, 'draftData')) {
      fail(
        'MAP_EXPORT_MANIFEST_INVALID_NODE_DATA',
        `${nodePath}.draftData`,
        'draftData is not part of the manifest schema'
      );
    }
    const nodeType = requireString(
      node.nodeType,
      `${nodePath}.nodeType`,
      'MAP_EXPORT_MANIFEST_INVALID_NODE_TYPE'
    );
    if (!supportedNodeTypes.has(nodeType as MapExportNodeType)) {
      fail(
        'MAP_EXPORT_MANIFEST_INVALID_NODE_TYPE',
        `${nodePath}.nodeType`,
        `unsupported nodeType ${nodeType}`
      );
    }
    const data = requireRecord(node.data, `${nodePath}.data`);
    return {
      ...(node.nodeId === undefined
        ? {}
        : {
            nodeId: requireString(
              node.nodeId,
              `${nodePath}.nodeId`,
              'MAP_EXPORT_MANIFEST_INVALID_NODE_DATA'
            ),
          }),
      nodeType: nodeType as MapExportNodeType,
      data,
    };
  });
};

const requireLayers = (value: unknown, path: string): MapExportLayerSelection[] => {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    fail('MAP_EXPORT_MANIFEST_INVALID_LAYER_SELECTION', path, 'expected an array');
  }
  const layers = value as readonly unknown[];
  return layers.map((entry, index) => {
    const layerPath = `${path}[${String(index)}]`;
    const layer = requireRecord(entry, layerPath);
    return {
      nodeId: requireString(
        layer.nodeId,
        `${layerPath}.nodeId`,
        'MAP_EXPORT_MANIFEST_INVALID_LAYER_SELECTION'
      ),
      visible:
        layer.visible === undefined ? true : requireBoolean(layer.visible, `${layerPath}.visible`),
    };
  });
};

const requireBoolean = (value: unknown, path: string): boolean => {
  if (typeof value !== 'boolean') {
    fail('MAP_EXPORT_MANIFEST_INVALID_LAYER_SELECTION', path, 'expected a boolean');
  }
  return value as boolean;
};

const requireJob = (value: unknown, path: string): MapExportJob => {
  const job = requireRecord(value, path);
  const output = requireRecord(job.output, `${path}.output`);
  const viewport = requireRecord(job.viewport, `${path}.viewport`);
  return {
    id: requireString(job.id, `${path}.id`, 'MAP_EXPORT_MANIFEST_REQUIRED_FIELD_MISSING'),
    output: {
      path: requireOutputPath(output.path, `${path}.output.path`),
    },
    viewport: {
      width: requirePositiveInteger(
        viewport.width,
        `${path}.viewport.width`,
        'MAP_EXPORT_MANIFEST_INVALID_VIEWPORT_SIZE'
      ),
      height: requirePositiveInteger(
        viewport.height,
        `${path}.viewport.height`,
        'MAP_EXPORT_MANIFEST_INVALID_VIEWPORT_SIZE'
      ),
    },
    bbox: requireBbox(job.bbox, `${path}.bbox`),
    nodes: requireNodes(job.nodes, `${path}.nodes`),
    layers: requireLayers(job.layers, `${path}.layers`),
  };
};

export const parseMapExportManifest = (
  source: string,
  options: ParseMapExportManifestOptions
): MapExportManifest => {
  const root = requireRecord(parseDocument(source, options), '$');
  if (root.version !== 1) {
    fail('MAP_EXPORT_MANIFEST_UNSUPPORTED_VERSION', '$.version', 'expected version 1');
  }
  if (!Array.isArray(root.jobs) || root.jobs.length === 0) {
    fail('MAP_EXPORT_MANIFEST_REQUIRED_FIELD_MISSING', '$.jobs', 'expected at least one job');
  }
  const jobs = root.jobs as readonly unknown[];
  return {
    version: 1,
    jobs: jobs.map((job, index) => requireJob(job, `$.jobs[${String(index)}]`)),
  };
};
