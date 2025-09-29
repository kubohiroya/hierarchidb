import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url));

interface RunnerOptionsBase {
  codemod: string;
  plugin?: string;
  target?: string;
  dryRun: boolean;
  extraArgs: string[];
}

export interface RunnerContext extends RunnerOptionsBase {
  files: string[];
  workspaceRoot: string;
}

interface CodemodModule {
  runCodemod(options: RunnerContext): Promise<void>;
  describe?(): string;
}

function parseArgs(argv: string[]): RunnerOptionsBase {
  const args = [...argv];
  const opts: RunnerOptionsBase = {
    codemod: '',
    dryRun: false,
    extraArgs: [],
  };

  while (args.length > 0) {
    const token = args.shift();
    if (!token) {
      break;
    }
    if (!token.startsWith('--')) {
      opts.extraArgs.push(token);
      continue;
    }

    const key = token.slice(2);
    switch (key) {
      case 'codemod':
        opts.codemod = args.shift() ?? '';
        break;
      case 'plugin':
        opts.plugin = args.shift() ?? undefined;
        break;
      case 'target':
        opts.target = args.shift() ?? undefined;
        break;
      case 'dry-run':
        opts.dryRun = true;
        break;
      default:
        opts.extraArgs.push(token);
        break;
    }
  }

  if (!opts.codemod) {
    throw new Error('Missing required option: --codemod <name>');
  }

  return opts;
}

function resolveWorkspaceRoot(): string {
  return path.resolve(CURRENT_DIR, '..', '..');
}

async function resolveTargetFiles(options: RunnerOptionsBase): Promise<{ files: string[]; workspaceRoot: string }> {
  const workspaceRoot = resolveWorkspaceRoot();
  const { globby } = await import('globby');
  const patterns: string[] = [];

  if (options.target) {
    patterns.push(options.target);
  }

  if (options.plugin) {
    const pluginSlug = options.plugin.endsWith('-plugin') ? options.plugin : `${options.plugin}-plugin`;
    patterns.push(`packages/plugins/${pluginSlug}/**/*.{ts,tsx}`);
  }

  if (patterns.length === 0) {
    patterns.push('app/src/**/*.{ts,tsx}', 'packages/**/*.{ts,tsx}', 'scripts/**/*.ts');
  }

  const files = await globby(patterns, {
    cwd: workspaceRoot,
    absolute: true,
    gitignore: true,
  });

  return { files, workspaceRoot };
}

async function loadCodemod(codemodName: string): Promise<CodemodModule> {
  const modulePath = path.join(CURRENT_DIR, 'mods', `${codemodName}.ts`);
  try {
    const moduleUrl = pathToFileURL(modulePath).href;
    const mod = (await import(moduleUrl)) as Partial<CodemodModule>;
    if (typeof mod.runCodemod !== 'function') {
      throw new Error('Module does not export runCodemod(options: RunnerOptions)');
    }
    return mod as CodemodModule;
  } catch (error) {
    throw new Error(`Failed to load codemod "${codemodName}": ${(error as Error).message}`);
  }
}

async function main() {
  const baseOptions = parseArgs(process.argv.slice(2));
  const module = await loadCodemod(baseOptions.codemod);
  const { files, workspaceRoot } = await resolveTargetFiles(baseOptions);

  if (files.length === 0) {
    console.warn('[codemod runner] No files matched the provided criteria.');
    return;
  }

  const context: RunnerContext = {
    ...baseOptions,
    files,
    workspaceRoot,
  };

  if (module.describe) {
    console.info(module.describe());
  }

  console.info(`[codemod runner] Executing "${context.codemod}" on ${files.length} file(s). Dry-run: ${context.dryRun}`);

  await module.runCodemod(context);
}

main().catch(error => {
  console.error('[codemod runner] Execution failed:', error);
  process.exitCode = 1;
});
