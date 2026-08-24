import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  parseStagedFolderActionManifest,
  validateStagedFolderActionCliOptions,
} from './parseStagedFolderActionManifest.js';
import { StagedFolderActionManifestError } from './StagedFolderActionManifestError.js';
import type {
  StagedFolderActionCliBrowserMode,
  StagedFolderActionConfig,
  StagedFolderActionManifestFormat,
} from './StagedFolderActionManifestTypes.js';

export { runStagedFolderActionCli };

export type StagedFolderActionCliErrorCategory = 'cli' | 'manifest' | 'profile' | 'internal';

export type StagedFolderActionCliResult =
  | {
      ok: true;
      version: 1;
      dryRun: true;
      sourceNodeId: string;
      outputParentNodeId?: string;
      browserMode?: StagedFolderActionCliBrowserMode;
      profileName: string;
      configPath: string;
      format: StagedFolderActionManifestFormat;
      stagingMode: StagedFolderActionConfig['staging']['mode'];
      cleanup: StagedFolderActionConfig['staging']['cleanup'];
      actions: StagedFolderActionConfig['actions'][number]['type'][];
      config: StagedFolderActionConfig;
    }
  | {
      ok: false;
      version: 1;
      error: {
        category: StagedFolderActionCliErrorCategory;
        code: string;
        message: string;
        path?: string;
        cause?: string;
      };
    };

export interface StagedFolderActionCliIo {
  readTextFile(path: string): Promise<string>;
  writeStdout(text: string): void;
  writeStderr(text: string): void;
}

type ParsedCliArgs = {
  configPath?: string;
  sourceNodeId?: string;
  outputParentNodeId?: string;
  browserMode?: StagedFolderActionCliBrowserMode;
  profileName: string;
  format?: StagedFolderActionManifestFormat;
  json: boolean;
  dryRun: boolean;
};

const DEFAULT_PROFILE_NAME = 'default';

async function runStagedFolderActionCli(
  argv: readonly string[],
  io: StagedFolderActionCliIo = nodeIo
): Promise<number> {
  const startedAt = Date.now();
  try {
    const args = parseCliArgs(argv);
    if (!args.configPath) {
      throw cliError('STAGED_FOLDER_ACTION_CLI_MISSING_ARGUMENT', '--config is required');
    }
    if (!args.sourceNodeId) {
      throw cliError('STAGED_FOLDER_ACTION_CLI_MISSING_ARGUMENT', '--source-node-id is required');
    }
    if (!args.dryRun) {
      throw cliError(
        'STAGED_FOLDER_ACTION_CLI_EXECUTION_HOST_NOT_CONFIGURED',
        'Phase 0 CLI supports --dry-run validation only; execution host integration is not configured yet'
      );
    }

    const format = args.format ?? inferManifestFormat(args.configPath);
    const source = await io.readTextFile(args.configPath);
    const config = parseStagedFolderActionManifest(source, { format });
    validateStagedFolderActionCliOptions({
      config,
      sourceNodeId: args.sourceNodeId,
      outputParentNodeId: args.outputParentNodeId,
      browserMode: args.browserMode,
    });

    const result: StagedFolderActionCliResult = {
      ok: true,
      version: 1,
      dryRun: true,
      sourceNodeId: args.sourceNodeId,
      ...(args.outputParentNodeId === undefined
        ? {}
        : { outputParentNodeId: args.outputParentNodeId }),
      ...(args.browserMode === undefined ? {} : { browserMode: args.browserMode }),
      profileName: args.profileName,
      configPath: args.configPath,
      format,
      stagingMode: config.staging.mode,
      cleanup: config.staging.cleanup,
      actions: config.actions.map((action) => action.type),
      config,
    };
    writeCliResult(io, result, args.json);
    if (!args.json) {
      io.writeStderr(`validated staged-folder-action manifest in ${Date.now() - startedAt}ms\n`);
    }
    return 0;
  } catch (error) {
    const result = toCliErrorResult(error);
    writeCliResult(io, result, true);
    return resolveExitCode(result.error.category);
  }
}

function parseCliArgs(argv: readonly string[]): ParsedCliArgs {
  const args: ParsedCliArgs = {
    profileName: DEFAULT_PROFILE_NAME,
    json: false,
    dryRun: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === undefined) {
      continue;
    }
    if (token === '--json') {
      args.json = true;
      continue;
    }
    if (token === '--dry-run') {
      args.dryRun = true;
      continue;
    }
    if (token === '--config') {
      args.configPath = readOptionValue(argv, index, token);
      index += 1;
      continue;
    }
    if (token === '--source-node-id') {
      args.sourceNodeId = readOptionValue(argv, index, token);
      index += 1;
      continue;
    }
    if (token === '--output-parent-node-id') {
      args.outputParentNodeId = readOptionValue(argv, index, token);
      index += 1;
      continue;
    }
    if (token === '--profile') {
      args.profileName = readOptionValue(argv, index, token);
      index += 1;
      continue;
    }
    if (token === '--browser') {
      args.browserMode = parseBrowserMode(readOptionValue(argv, index, token));
      index += 1;
      continue;
    }
    if (token === '--format') {
      args.format = parseManifestFormat(readOptionValue(argv, index, token));
      index += 1;
      continue;
    }
    throw cliError('STAGED_FOLDER_ACTION_CLI_UNKNOWN_ARGUMENT', `unknown argument ${token}`, token);
  }

  return args;
}

function readOptionValue(argv: readonly string[], index: number, optionName: string): string {
  const value = argv[index + 1];
  if (
    value === undefined ||
    value.startsWith('--') ||
    value.length === 0 ||
    value !== value.trim()
  ) {
    throw cliError(
      'STAGED_FOLDER_ACTION_CLI_INVALID_ARGUMENT',
      `${optionName} requires a non-empty trimmed value`,
      optionName
    );
  }
  return value;
}

function parseBrowserMode(value: string): StagedFolderActionCliBrowserMode {
  if (value === 'headless' || value === 'headed') {
    return value;
  }
  throw cliError(
    'STAGED_FOLDER_ACTION_CLI_INVALID_ARGUMENT',
    '--browser must be headless or headed',
    '--browser'
  );
}

function parseManifestFormat(value: string): StagedFolderActionManifestFormat {
  if (value === 'json' || value === 'yaml') {
    return value;
  }
  throw cliError(
    'STAGED_FOLDER_ACTION_CLI_INVALID_ARGUMENT',
    '--format must be json or yaml',
    '--format'
  );
}

function inferManifestFormat(configPath: string): StagedFolderActionManifestFormat {
  const extension = path.extname(configPath).toLowerCase();
  if (extension === '.json') {
    return 'json';
  }
  if (extension === '.yaml' || extension === '.yml') {
    return 'yaml';
  }
  throw cliError(
    'STAGED_FOLDER_ACTION_CLI_INVALID_ARGUMENT',
    'cannot infer config format; pass --format json or --format yaml',
    '--format'
  );
}

function writeCliResult(
  io: StagedFolderActionCliIo,
  result: StagedFolderActionCliResult,
  json: boolean
): void {
  const serialized = `${JSON.stringify(result, null, 2)}\n`;
  if (json || !result.ok) {
    io.writeStdout(serialized);
    return;
  }
  io.writeStderr(`staged-folder-action dry-run ok: ${result.actions.join(', ') || 'no actions'}\n`);
}

function toCliErrorResult(error: unknown): Extract<StagedFolderActionCliResult, { ok: false }> {
  if (error instanceof StagedFolderActionManifestError) {
    return {
      ok: false,
      version: 1,
      error: {
        category: 'manifest',
        code: error.code,
        message: error.message,
        path: error.details.path,
      },
    };
  }
  if (error instanceof StagedFolderActionCliError) {
    return {
      ok: false,
      version: 1,
      error: {
        category: error.category,
        code: error.code,
        message: error.message,
        ...(error.path === undefined ? {} : { path: error.path }),
      },
    };
  }
  return {
    ok: false,
    version: 1,
    error: {
      category: 'internal',
      code: 'STAGED_FOLDER_ACTION_CLI_INTERNAL_ERROR',
      message: error instanceof Error ? error.message : String(error),
    },
  };
}

function resolveExitCode(category: StagedFolderActionCliErrorCategory): number {
  if (category === 'cli' || category === 'manifest') {
    return 1;
  }
  if (category === 'profile') {
    return 2;
  }
  return 70;
}

class StagedFolderActionCliError extends Error {
  readonly category: StagedFolderActionCliErrorCategory;
  readonly code: string;
  readonly path?: string;

  constructor(input: {
    category: StagedFolderActionCliErrorCategory;
    code: string;
    message: string;
    path?: string;
  }) {
    super(input.message);
    this.name = 'StagedFolderActionCliError';
    this.category = input.category;
    this.code = input.code;
    this.path = input.path;
  }
}

function cliError(code: string, message: string, path?: string): StagedFolderActionCliError {
  return new StagedFolderActionCliError({
    category: 'cli',
    code,
    message,
    ...(path === undefined ? {} : { path }),
  });
}

const nodeIo: StagedFolderActionCliIo = {
  readTextFile: (filePath) => readFile(filePath, 'utf8'),
  writeStdout: (text) => {
    process.stdout.write(text);
  },
  writeStderr: (text) => {
    process.stderr.write(text);
  },
};

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {
  runStagedFolderActionCli(process.argv.slice(2)).then((exitCode) => {
    process.exitCode = exitCode;
  });
}
