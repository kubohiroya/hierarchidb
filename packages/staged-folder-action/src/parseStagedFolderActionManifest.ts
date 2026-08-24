import { parse as parseYaml } from 'yaml';
import type { StagedFolderActionManifestErrorCode } from './StagedFolderActionManifestError.js';
import { StagedFolderActionManifestError } from './StagedFolderActionManifestError.js';
import type {
  ParseStagedFolderActionManifestOptions,
  StagedFolderAction,
  StagedFolderActionBbox,
  StagedFolderActionCleanup,
  StagedFolderActionConfig,
  StagedFolderActionOverlayNode,
  StagedFolderActionRegistryEntry,
  StagedFolderActionStagingMode,
  StagedFolderActionType,
  ValidateStagedFolderActionCliOptionsInput,
} from './StagedFolderActionManifestTypes.js';

const stagingModes = new Set<StagedFolderActionStagingMode>([
  'temporary-copy',
  'permanent-copy',
  'patch-source',
]);

const cleanupModes = new Set<StagedFolderActionCleanup>([
  'retain',
  'delete-on-success',
  'delete-always',
]);

const actionTypes = new Set<StagedFolderActionType>([
  'build',
  'export-archive',
  'import-mount',
  'export-csv',
  'export-xlsx',
  'map-image-capture',
]);

export const stagedFolderActionRegistry: Record<
  StagedFolderActionType,
  StagedFolderActionRegistryEntry
> = {
  build: {
    type: 'build',
    schema: 'StagedFolderBuildAction',
    prerequisite: 'build-targets-resolvable',
    executionOwner: 'runtime-worker',
    resultSchema: 'StagedFolderBuildActionResult',
    artifactPolicy: 'build-session',
    errorCategory: 'build',
  },
  'export-archive': {
    type: 'export-archive',
    schema: 'StagedFolderExportArchiveAction',
    prerequisite: 'source-path-resolvable',
    executionOwner: 'runtime-worker',
    resultSchema: 'StagedFolderExportArchiveActionResult',
    artifactPolicy: 'file-output',
    errorCategory: 'export-archive',
  },
  'import-mount': {
    type: 'import-mount',
    schema: 'StagedFolderImportMountAction',
    prerequisite: 'input-archive-readable',
    executionOwner: 'runtime-worker',
    resultSchema: 'StagedFolderImportMountActionResult',
    artifactPolicy: 'mounted-content',
    errorCategory: 'import-mount',
  },
  'export-csv': {
    type: 'export-csv',
    schema: 'StagedFolderExportCsvAction',
    prerequisite: 'location-route-step2-adapter',
    executionOwner: 'plugin-adapter',
    resultSchema: 'StagedFolderExportCsvActionResult',
    artifactPolicy: 'file-output',
    errorCategory: 'export-csv',
  },
  'export-xlsx': {
    type: 'export-xlsx',
    schema: 'StagedFolderExportXlsxAction',
    prerequisite: 'location-route-step2-adapter',
    executionOwner: 'plugin-adapter',
    resultSchema: 'StagedFolderExportXlsxActionResult',
    artifactPolicy: 'file-output',
    errorCategory: 'export-xlsx',
  },
  'map-image-capture': {
    type: 'map-image-capture',
    schema: 'StagedFolderMapImageCaptureAction',
    prerequisite: 'successful-build-action',
    executionOwner: 'existing-map-ui',
    resultSchema: 'StagedFolderMapImageCaptureActionResult',
    artifactPolicy: 'file-output',
    errorCategory: 'map-image-capture',
  },
};

const fail = (code: StagedFolderActionManifestErrorCode, path: string, reason: string): never => {
  throw new StagedFolderActionManifestError({ code, path, reason });
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const requireRecord = (
  value: unknown,
  path: string,
  code: StagedFolderActionManifestErrorCode = 'STAGED_FOLDER_ACTION_MANIFEST_ROOT_INVALID'
): Record<string, unknown> => {
  if (!isRecord(value)) {
    fail(code, path, 'expected an object');
  }
  return value as Record<string, unknown>;
};

const requireString = (
  value: unknown,
  path: string,
  code: StagedFolderActionManifestErrorCode
): string => {
  if (typeof value !== 'string' || value.length === 0 || value !== value.trim()) {
    fail(code, path, 'expected a non-empty trimmed string');
  }
  return value as string;
};

const requireBoolean = (
  value: unknown,
  path: string,
  code: StagedFolderActionManifestErrorCode
): boolean => {
  if (typeof value !== 'boolean') {
    fail(code, path, 'expected a boolean');
  }
  return value as boolean;
};

const requirePositiveInteger = (
  value: unknown,
  path: string,
  code: StagedFolderActionManifestErrorCode
): number => {
  if (!Number.isInteger(value) || (value as number) <= 0) {
    fail(code, path, 'expected a positive integer');
  }
  return value as number;
};

const requireFiniteNumber = (
  value: unknown,
  path: string,
  code: StagedFolderActionManifestErrorCode
): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    fail(code, path, 'expected a finite number');
  }
  return value as number;
};

const parseDocument = (
  source: string,
  options: ParseStagedFolderActionManifestOptions
): unknown => {
  try {
    if (options.format === 'json') {
      return JSON.parse(source) as unknown;
    }
    if (options.format === 'yaml') {
      return parseYaml(source);
    }
  } catch (error) {
    fail(
      'STAGED_FOLDER_ACTION_MANIFEST_PARSE_ERROR',
      '$',
      error instanceof Error ? error.message : String(error)
    );
  }
  fail(
    'STAGED_FOLDER_ACTION_MANIFEST_PARSE_ERROR',
    '$.format',
    `unsupported format ${String(options.format)}`
  );
};

const normalizeSafeRelativePath = (
  value: string,
  path: string,
  options: { allowDot: boolean }
): string => {
  if (options.allowDot && value === '.') {
    return value;
  }
  const pathWithoutExplicitRoot =
    options.allowDot && value.startsWith('./') ? value.slice(2) : value;
  if (
    (!options.allowDot && value === '.') ||
    value.startsWith('/') ||
    value.includes('\0') ||
    pathWithoutExplicitRoot
      .split('/')
      .some((segment) => segment === '..' || segment === '.' || segment.length === 0)
  ) {
    fail(
      'STAGED_FOLDER_ACTION_MANIFEST_INVALID_PATH',
      path,
      'expected a relative path without empty or parent-directory segments'
    );
  }
  return pathWithoutExplicitRoot;
};

const requireSafePath = (value: unknown, path: string, options = { allowDot: false }): string => {
  const safePath = requireString(value, path, 'STAGED_FOLDER_ACTION_MANIFEST_INVALID_PATH');
  return normalizeSafeRelativePath(safePath, path, options);
};

const requireStaging = (value: unknown, path: string): StagedFolderActionConfig['staging'] => {
  const staging = requireRecord(
    value,
    path,
    'STAGED_FOLDER_ACTION_MANIFEST_REQUIRED_FIELD_MISSING'
  );
  const mode = requireString(
    staging.mode,
    `${path}.mode`,
    'STAGED_FOLDER_ACTION_MANIFEST_INVALID_STAGING_MODE'
  );
  if (!stagingModes.has(mode as StagedFolderActionStagingMode)) {
    fail(
      'STAGED_FOLDER_ACTION_MANIFEST_INVALID_STAGING_MODE',
      `${path}.mode`,
      `unsupported staging mode ${mode}`
    );
  }
  const cleanup = requireString(
    staging.cleanup,
    `${path}.cleanup`,
    'STAGED_FOLDER_ACTION_MANIFEST_INVALID_CLEANUP'
  );
  if (!cleanupModes.has(cleanup as StagedFolderActionCleanup)) {
    fail(
      'STAGED_FOLDER_ACTION_MANIFEST_INVALID_CLEANUP',
      `${path}.cleanup`,
      `unsupported cleanup mode ${cleanup}`
    );
  }
  if (mode === 'patch-source' && cleanup !== 'retain') {
    fail(
      'STAGED_FOLDER_ACTION_MANIFEST_INVALID_CLEANUP',
      `${path}.cleanup`,
      'patch-source does not create a staging root and cannot be cleaned up'
    );
  }
  return {
    mode: mode as StagedFolderActionStagingMode,
    ...(staging.name === undefined
      ? {}
      : {
          name: requireString(
            staging.name,
            `${path}.name`,
            'STAGED_FOLDER_ACTION_MANIFEST_INVALID_STAGING_MODE'
          ),
        }),
    cleanup: cleanup as StagedFolderActionCleanup,
  };
};

const requireOverlay = (value: unknown, path: string): StagedFolderActionConfig['overlay'] => {
  const overlay = requireRecord(
    value,
    path,
    'STAGED_FOLDER_ACTION_MANIFEST_REQUIRED_FIELD_MISSING'
  );
  if (!Array.isArray(overlay.nodes)) {
    fail(
      'STAGED_FOLDER_ACTION_MANIFEST_REQUIRED_FIELD_MISSING',
      `${path}.nodes`,
      'expected an array'
    );
  }
  const seenPaths = new Set<string>();
  const nodes = (overlay.nodes as readonly unknown[]).map((entry, index) => {
    const nodePath = `${path}.nodes[${String(index)}]`;
    const node = requireRecord(entry, nodePath, 'STAGED_FOLDER_ACTION_MANIFEST_INVALID_OVERLAY');
    const match = requireRecord(
      node.match,
      `${nodePath}.match`,
      'STAGED_FOLDER_ACTION_MANIFEST_INVALID_OVERLAY'
    );
    const targetPath = requireSafePath(match.path, `${nodePath}.match.path`, { allowDot: true });
    if (seenPaths.has(targetPath)) {
      fail(
        'STAGED_FOLDER_ACTION_MANIFEST_INVALID_OVERLAY',
        `${nodePath}.match.path`,
        `duplicate overlay path ${targetPath}`
      );
    }
    seenPaths.add(targetPath);
    const data = requireRecord(
      node.data,
      `${nodePath}.data`,
      'STAGED_FOLDER_ACTION_MANIFEST_INVALID_OVERLAY'
    );
    return {
      match: { path: targetPath },
      data,
    } satisfies StagedFolderActionOverlayNode;
  });
  return { nodes };
};

const requireBbox = (value: unknown, path: string): StagedFolderActionBbox => {
  if (!Array.isArray(value) || value.length !== 4) {
    fail('STAGED_FOLDER_ACTION_MANIFEST_INVALID_BBOX', path, 'expected [west, south, east, north]');
  }
  const bbox = value as readonly unknown[];
  const west = requireFiniteNumber(
    bbox[0],
    `${path}[0]`,
    'STAGED_FOLDER_ACTION_MANIFEST_INVALID_BBOX'
  );
  const south = requireFiniteNumber(
    bbox[1],
    `${path}[1]`,
    'STAGED_FOLDER_ACTION_MANIFEST_INVALID_BBOX'
  );
  const east = requireFiniteNumber(
    bbox[2],
    `${path}[2]`,
    'STAGED_FOLDER_ACTION_MANIFEST_INVALID_BBOX'
  );
  const north = requireFiniteNumber(
    bbox[3],
    `${path}[3]`,
    'STAGED_FOLDER_ACTION_MANIFEST_INVALID_BBOX'
  );
  if (west < -180 || west > 180 || east < -180 || east > 180 || west >= east) {
    fail(
      'STAGED_FOLDER_ACTION_MANIFEST_INVALID_BBOX',
      path,
      'longitude bounds must satisfy -180 <= west < east <= 180'
    );
  }
  if (south < -90 || south > 90 || north < -90 || north > 90 || south >= north) {
    fail(
      'STAGED_FOLDER_ACTION_MANIFEST_INVALID_BBOX',
      path,
      'latitude bounds must satisfy -90 <= south < north <= 90'
    );
  }
  return [west, south, east, north];
};

const requireColumns = (value: unknown, path: string): string[] | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    fail('STAGED_FOLDER_ACTION_MANIFEST_INVALID_ACTION', path, 'expected an array');
  }
  return (value as readonly unknown[]).map((entry, index) =>
    requireString(
      entry,
      `${path}[${String(index)}]`,
      'STAGED_FOLDER_ACTION_MANIFEST_INVALID_ACTION'
    )
  );
};

const requireEntityType = (value: unknown, path: string): 'location' | 'route' => {
  const entityType = requireString(value, path, 'STAGED_FOLDER_ACTION_MANIFEST_INVALID_ACTION');
  if (entityType !== 'location' && entityType !== 'route') {
    fail('STAGED_FOLDER_ACTION_MANIFEST_INVALID_ACTION', path, 'expected location or route');
  }
  return entityType as 'location' | 'route';
};

const requireAction = (value: unknown, path: string): StagedFolderAction => {
  const action = requireRecord(value, path, 'STAGED_FOLDER_ACTION_MANIFEST_INVALID_ACTION');
  const type = requireString(
    action.type,
    `${path}.type`,
    'STAGED_FOLDER_ACTION_MANIFEST_INVALID_ACTION'
  );
  if (!actionTypes.has(type as StagedFolderActionType)) {
    fail(
      'STAGED_FOLDER_ACTION_MANIFEST_INVALID_ACTION',
      `${path}.type`,
      `unsupported action type ${type}`
    );
  }
  if (type === 'build') {
    const mode = requireString(
      action.mode,
      `${path}.mode`,
      'STAGED_FOLDER_ACTION_MANIFEST_INVALID_ACTION'
    );
    if (mode !== 'session-manager') {
      fail(
        'STAGED_FOLDER_ACTION_MANIFEST_INVALID_ACTION',
        `${path}.mode`,
        'expected session-manager'
      );
    }
    return { type: 'build', mode: 'session-manager' };
  }
  if (type === 'export-archive') {
    const source = requireRecord(
      action.source,
      `${path}.source`,
      'STAGED_FOLDER_ACTION_MANIFEST_INVALID_ACTION'
    );
    const output = requireRecord(
      action.output,
      `${path}.output`,
      'STAGED_FOLDER_ACTION_MANIFEST_INVALID_ACTION'
    );
    const format = requireString(
      action.format,
      `${path}.format`,
      'STAGED_FOLDER_ACTION_MANIFEST_INVALID_ACTION'
    );
    if (format !== 'canonical-yaml-zip') {
      fail(
        'STAGED_FOLDER_ACTION_MANIFEST_INVALID_ACTION',
        `${path}.format`,
        'expected canonical-yaml-zip'
      );
    }
    return {
      type: 'export-archive',
      format: 'canonical-yaml-zip',
      source: { path: requireSafePath(source.path, `${path}.source.path`, { allowDot: true }) },
      output: { path: requireSafePath(output.path, `${path}.output.path`) },
    };
  }
  if (type === 'import-mount') {
    const input = requireRecord(
      action.input,
      `${path}.input`,
      'STAGED_FOLDER_ACTION_MANIFEST_INVALID_ACTION'
    );
    const mount = requireRecord(
      action.mount,
      `${path}.mount`,
      'STAGED_FOLDER_ACTION_MANIFEST_INVALID_ACTION'
    );
    const format = requireString(
      action.format,
      `${path}.format`,
      'STAGED_FOLDER_ACTION_MANIFEST_INVALID_ACTION'
    );
    if (format !== 'canonical-yaml-zip') {
      fail(
        'STAGED_FOLDER_ACTION_MANIFEST_INVALID_ACTION',
        `${path}.format`,
        'expected canonical-yaml-zip'
      );
    }
    const lifetime = requireString(
      mount.lifetime,
      `${path}.mount.lifetime`,
      'STAGED_FOLDER_ACTION_MANIFEST_INVALID_ACTION'
    );
    if (lifetime !== 'run' && lifetime !== 'retain' && lifetime !== 'permanent') {
      fail(
        'STAGED_FOLDER_ACTION_MANIFEST_INVALID_ACTION',
        `${path}.mount.lifetime`,
        'expected run, retain, or permanent'
      );
    }
    return {
      type: 'import-mount',
      format: 'canonical-yaml-zip',
      input: { path: requireSafePath(input.path, `${path}.input.path`) },
      mount: {
        parentPath: requireSafePath(mount.parentPath, `${path}.mount.parentPath`, {
          allowDot: true,
        }),
        name: requireString(
          mount.name,
          `${path}.mount.name`,
          'STAGED_FOLDER_ACTION_MANIFEST_INVALID_ACTION'
        ),
        lifetime: lifetime as 'run' | 'retain' | 'permanent',
      },
    };
  }
  if (type === 'export-csv' || type === 'export-xlsx') {
    const source = requireRecord(
      action.source,
      `${path}.source`,
      'STAGED_FOLDER_ACTION_MANIFEST_INVALID_ACTION'
    );
    const output = requireRecord(
      action.output,
      `${path}.output`,
      'STAGED_FOLDER_ACTION_MANIFEST_INVALID_ACTION'
    );
    const common = {
      entityType: requireEntityType(action.entityType, `${path}.entityType`),
      source: { path: requireSafePath(source.path, `${path}.source.path`, { allowDot: true }) },
      columns: requireColumns(action.columns, `${path}.columns`),
      includeDependencyStatus:
        action.includeDependencyStatus === undefined
          ? undefined
          : requireBoolean(
              action.includeDependencyStatus,
              `${path}.includeDependencyStatus`,
              'STAGED_FOLDER_ACTION_MANIFEST_INVALID_ACTION'
            ),
    };
    if (type === 'export-csv') {
      return {
        type: 'export-csv',
        ...common,
        output: { path: requireSafePath(output.path, `${path}.output.path`) },
      };
    }
    return {
      type: 'export-xlsx',
      ...common,
      output: {
        path: requireSafePath(output.path, `${path}.output.path`),
        ...(output.sheetName === undefined
          ? {}
          : {
              sheetName: requireSheetName(output.sheetName, `${path}.output.sheetName`),
            }),
      },
    };
  }
  const output = requireRecord(
    action.output,
    `${path}.output`,
    'STAGED_FOLDER_ACTION_MANIFEST_INVALID_ACTION'
  );
  const viewport = requireRecord(
    action.viewport,
    `${path}.viewport`,
    'STAGED_FOLDER_ACTION_MANIFEST_INVALID_ACTION'
  );
  const mode = requireString(
    action.mode,
    `${path}.mode`,
    'STAGED_FOLDER_ACTION_MANIFEST_INVALID_ACTION'
  );
  if (mode !== 'map-ui') {
    fail('STAGED_FOLDER_ACTION_MANIFEST_INVALID_ACTION', `${path}.mode`, 'expected map-ui');
  }
  if (!Array.isArray(action.layers)) {
    fail('STAGED_FOLDER_ACTION_MANIFEST_INVALID_ACTION', `${path}.layers`, 'expected an array');
  }
  return {
    type: 'map-image-capture',
    mode: 'map-ui',
    output: {
      path: requireSafePath(output.path, `${path}.output.path`),
      width: requirePositiveInteger(
        output.width,
        `${path}.output.width`,
        'STAGED_FOLDER_ACTION_MANIFEST_INVALID_SIZE'
      ),
      height: requirePositiveInteger(
        output.height,
        `${path}.output.height`,
        'STAGED_FOLDER_ACTION_MANIFEST_INVALID_SIZE'
      ),
    },
    viewport: {
      bbox: requireBbox(viewport.bbox, `${path}.viewport.bbox`),
    },
    layers: (action.layers as readonly unknown[]).map((entry, index) => {
      const layerPath = `${path}.layers[${String(index)}]`;
      const layer = requireRecord(entry, layerPath, 'STAGED_FOLDER_ACTION_MANIFEST_INVALID_ACTION');
      return {
        path: requireSafePath(layer.path, `${layerPath}.path`, { allowDot: true }),
        visible: requireBoolean(
          layer.visible,
          `${layerPath}.visible`,
          'STAGED_FOLDER_ACTION_MANIFEST_INVALID_ACTION'
        ),
      };
    }),
  };
};

const requireSheetName = (value: unknown, path: string): string => {
  const sheetName = requireString(value, path, 'STAGED_FOLDER_ACTION_MANIFEST_INVALID_ACTION');
  if (sheetName.length > 31 || /[:\\/?*\[\]]/.test(sheetName)) {
    fail(
      'STAGED_FOLDER_ACTION_MANIFEST_INVALID_ACTION',
      path,
      'expected a valid Excel worksheet name'
    );
  }
  return sheetName;
};

const requireActions = (value: unknown, path: string): StagedFolderAction[] => {
  if (!Array.isArray(value)) {
    fail('STAGED_FOLDER_ACTION_MANIFEST_REQUIRED_FIELD_MISSING', path, 'expected an array');
  }
  const actions = (value as readonly unknown[]).map((entry, index) =>
    requireAction(entry, `${path}[${String(index)}]`)
  );
  const firstCaptureIndex = actions.findIndex((action) => action.type === 'map-image-capture');
  if (firstCaptureIndex !== -1) {
    const hasPriorBuild = actions
      .slice(0, firstCaptureIndex)
      .some((action) => action.type === 'build');
    if (!hasPriorBuild) {
      fail(
        'STAGED_FOLDER_ACTION_MANIFEST_INVALID_ACTION',
        `${path}[${String(firstCaptureIndex)}]`,
        'map-image-capture requires a preceding build action'
      );
    }
  }
  return actions;
};

export const parseStagedFolderActionManifest = (
  source: string,
  options: ParseStagedFolderActionManifestOptions
): StagedFolderActionConfig => {
  const root = requireRecord(parseDocument(source, options), '$');
  if (root.version !== 1) {
    fail('STAGED_FOLDER_ACTION_MANIFEST_UNSUPPORTED_VERSION', '$.version', 'expected version 1');
  }
  return {
    version: 1,
    staging: requireStaging(root.staging, '$.staging'),
    overlay: requireOverlay(root.overlay, '$.overlay'),
    actions: requireActions(root.actions, '$.actions'),
  };
};

export const validateStagedFolderActionCliOptions = ({
  config,
  sourceNodeId,
  outputParentNodeId,
}: ValidateStagedFolderActionCliOptionsInput): void => {
  requireString(
    sourceNodeId,
    '--source-node-id',
    'STAGED_FOLDER_ACTION_MANIFEST_INVALID_CLI_ARGUMENTS'
  );
  if (config.staging.mode === 'permanent-copy') {
    requireString(
      outputParentNodeId,
      '--output-parent-node-id',
      'STAGED_FOLDER_ACTION_MANIFEST_INVALID_CLI_ARGUMENTS'
    );
    return;
  }
  if (outputParentNodeId !== undefined) {
    fail(
      'STAGED_FOLDER_ACTION_MANIFEST_INVALID_CLI_ARGUMENTS',
      '--output-parent-node-id',
      `${config.staging.mode} does not accept output parent node id`
    );
  }
};
