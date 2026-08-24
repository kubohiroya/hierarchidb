import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  runStagedFolderActionCli,
  type StagedFolderActionCliExecutionHost,
  type StagedFolderActionCliExecutionInput,
  StagedFolderActionCliHostError,
  type StagedFolderActionCliIo,
} from './runStagedFolderActionCli.js';

export { runStagedFolderActionBundledCli };

const HOST_MODULE_ENV = 'HDB_STAGED_FOLDER_ACTION_CLI_HOST_MODULE';

type StagedFolderActionCliHostModule = {
  default?:
    | StagedFolderActionCliExecutionHost
    | (() => StagedFolderActionCliExecutionHost | Promise<StagedFolderActionCliExecutionHost>);
  createStagedFolderActionCliExecutionHost?: () =>
    | StagedFolderActionCliExecutionHost
    | Promise<StagedFolderActionCliExecutionHost>;
};

async function runStagedFolderActionBundledCli(
  argv: readonly string[],
  io?: StagedFolderActionCliIo
): Promise<number> {
  const executionHost = resolveBundledExecutionHost();
  if (io === undefined) {
    return runStagedFolderActionCli(argv, undefined, { executionHost });
  }
  return runStagedFolderActionCli(argv, io, { executionHost });
}

function resolveBundledExecutionHost(): StagedFolderActionCliExecutionHost {
  const moduleSpecifier = process.env[HOST_MODULE_ENV];
  if (moduleSpecifier === undefined || moduleSpecifier.length === 0) {
    return missingHostModuleExecutionHost;
  }
  return {
    run: async (input) => {
      const loadedSpecifier = resolveHostModuleSpecifier(moduleSpecifier);
      try {
        const loaded = (await import(loadedSpecifier)) as StagedFolderActionCliHostModule;
        const executionHost = await createExecutionHostFromModule(loaded);
        if (executionHost === null) {
          throwInvalidHostModule(moduleSpecifier, input);
        }
        return executionHost.run(input);
      } catch (error) {
        if (error instanceof StagedFolderActionCliHostError) {
          throw error;
        }
        throwInvalidHostModule(moduleSpecifier, input, error);
      }
    },
  };
}

async function createExecutionHostFromModule(
  loaded: StagedFolderActionCliHostModule
): Promise<StagedFolderActionCliExecutionHost | null> {
  if (typeof loaded.createStagedFolderActionCliExecutionHost === 'function') {
    const created = await loaded.createStagedFolderActionCliExecutionHost();
    if (isExecutionHost(created)) {
      return created;
    }
    return null;
  }
  if (isExecutionHost(loaded.default)) {
    return loaded.default;
  }
  if (typeof loaded.default === 'function') {
    const created = await loaded.default();
    if (isExecutionHost(created)) {
      return created;
    }
  }
  return null;
}

function resolveHostModuleSpecifier(moduleSpecifier: string): string {
  if (
    moduleSpecifier.startsWith('./') ||
    moduleSpecifier.startsWith('../') ||
    path.isAbsolute(moduleSpecifier)
  ) {
    return pathToFileURL(path.resolve(process.cwd(), moduleSpecifier)).href;
  }
  return moduleSpecifier;
}

const missingHostModuleExecutionHost: StagedFolderActionCliExecutionHost = {
  run: async (input) => {
    throw new StagedFolderActionCliHostError({
      ok: false,
      version: 1,
      dryRun: false,
      sourceNodeId: input.sourceNodeId,
      error: {
        category: 'profile',
        code: 'STAGED_FOLDER_ACTION_CLI_EXECUTION_HOST_MODULE_REQUIRED',
        message: `${HOST_MODULE_ENV} must point to a CLI execution host module for non-dry-run execution`,
        sourceNodeId: input.sourceNodeId,
      },
    });
  },
};

function throwInvalidHostModule(
  moduleSpecifier: string,
  input: StagedFolderActionCliExecutionInput,
  cause?: unknown
): never {
  throw new StagedFolderActionCliHostError({
    ok: false,
    version: 1,
    dryRun: false,
    sourceNodeId: input.sourceNodeId,
    error: {
      category: 'profile',
      code: 'STAGED_FOLDER_ACTION_CLI_EXECUTION_HOST_MODULE_INVALID',
      message: `CLI execution host module ${moduleSpecifier} did not export a valid host factory`,
      sourceNodeId: input.sourceNodeId,
      ...(cause === undefined ? {} : { cause: formatCause(cause) }),
    },
  });
}

function isExecutionHost(value: unknown): value is StagedFolderActionCliExecutionHost {
  return (
    value !== null && typeof value === 'object' && 'run' in value && typeof value.run === 'function'
  );
}

function formatCause(cause: unknown): string {
  if (cause instanceof Error) {
    return cause.message;
  }
  return String(cause);
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {
  runStagedFolderActionBundledCli(process.argv.slice(2)).then((exitCode) => {
    process.exitCode = exitCode;
  });
}
