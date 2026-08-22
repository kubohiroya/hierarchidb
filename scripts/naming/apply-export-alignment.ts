/**
 * @file scripts/naming/apply-export-alignment.ts
 * @description Applies curated file rename operations to align file names with their primary exports.
 * @why Provides a repeatable, scope-controlled workflow for enforcing the naming guideline via ts-morph.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import process from 'node:process';
import { globby } from 'globby';
import minimist from 'minimist';
import { Project, SourceFile } from 'ts-morph';

const DEFAULT_INCLUDE = [
  'app/**/*.{ts,tsx,mts}',
  'packages/**/*.{ts,tsx,mts}',
  'scripts/**/*.{ts,tsx,mts}',
];

const DEFAULT_IGNORE = [
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.turbo',
  '**/*.d.ts',
  '**/*.d.mts',
  '**/*.d.tsx',
  '**/*.test.*',
  '**/*.spec.*',
  '**/*.stories.*',
  '**/__tests__/**',
  '**/__mocks__/**',
  '**/__fixtures__/**',
  '**/*.generated.*',
  '**/*.gen.*',
];

type RenamePlanEntry = {
  readonly from: string;
  readonly to: string;
};

type RenamePlan = {
  readonly renames: RenamePlanEntry[];
};

type SpecifierUpdate = {
  readonly kind: 'import' | 'export';
  readonly sourceFile: string;
  readonly oldValue: string;
  readonly newValue: string;
};

type OperationResult = {
  readonly entry: RenamePlanEntry;
  readonly applied: boolean;
  readonly skipped: boolean;
  readonly reason?: string;
  readonly specifierUpdates: SpecifierUpdate[];
};

type CliOptions = {
  planPath: string;
  root: string;
  apply: boolean;
  filters: RegExp[];
  verbose: boolean;
};

function toPosixRelative(root: string, filePath: string): string {
  const rel = path.relative(root, filePath);
  return rel.split(path.sep).join('/');
}

function ensureRelativeSpecifier(specifier: string): string {
  if (specifier.startsWith('.') || specifier.startsWith('/')) {
    return specifier;
  }
  return specifier.startsWith('@') ? specifier : `./${specifier}`;
}

function stripTypeScriptExtension(specifier: string): string {
  return specifier.replace(/\.(ts|tsx|cts|mts)$/i, '');
}

function splitSpecifier(original: string): { bare: string; suffix: string } {
  const match = original.match(/^[^?#]+/);
  const bare = match ? match[0] : original;
  const suffix = original.slice(bare.length);
  return { bare, suffix };
}

function computeUpdatedSpecifier(
  sourceFilePath: string,
  targetFilePath: string,
  originalSpecifier: string
): string {
  const sourceDir = path.dirname(sourceFilePath);
  const relativePath = path.relative(sourceDir, targetFilePath);
  let normalized = relativePath.split(path.sep).join('/');
  if (!normalized.startsWith('.')) {
    normalized = `./${normalized}`;
  }

  const { bare, suffix } = splitSpecifier(originalSpecifier);
  const originalExt = path.extname(bare);

  let nextBare = normalized;
  if (originalExt) {
    nextBare = stripTypeScriptExtension(nextBare);
    nextBare = nextBare.replace(/\.(js|jsx|mjs|cjs)$/i, '');
    nextBare = `${nextBare}${originalExt}`;
  } else {
    nextBare = stripTypeScriptExtension(nextBare);
  }

  return ensureRelativeSpecifier(nextBare) + suffix;
}

async function prepareSourceFiles(
  project: Project,
  include: string[],
  ignore: string[],
  root: string
): Promise<SourceFile[]> {
  const filePaths = await globby(include, {
    cwd: root,
    ignore,
    absolute: true,
    followSymbolicLinks: false,
  });

  const sourceFiles: SourceFile[] = [];
  for (const filePath of filePaths) {
    const sourceFile = project.addSourceFileAtPathIfExists(filePath);
    if (sourceFile) {
      sourceFiles.push(sourceFile);
    }
  }
  return sourceFiles;
}

function collectSpecifierUpdates(
  project: Project,
  root: string,
  fromPath: string,
  toPath: string
): SpecifierUpdate[] {
  const updates: SpecifierUpdate[] = [];
  const targetFile = project.getSourceFile(fromPath);
  if (!targetFile) {
    return updates;
  }

  for (const sourceFile of project.getSourceFiles()) {
    for (const importDecl of sourceFile.getImportDeclarations()) {
      const referenced = importDecl.getModuleSpecifierSourceFile();
      if (referenced && referenced.getFilePath() === fromPath) {
        const oldValue = importDecl.getModuleSpecifier().getLiteralText();
        const newValue = computeUpdatedSpecifier(sourceFile.getFilePath(), toPath, oldValue);
        if (oldValue !== newValue) {
          updates.push({
            kind: 'import',
            sourceFile: toPosixRelative(root, sourceFile.getFilePath()),
            oldValue,
            newValue,
          });
        }
      }
    }
    for (const exportDecl of sourceFile.getExportDeclarations()) {
      const moduleSpecifierSource = exportDecl.getModuleSpecifierSourceFile();
      if (moduleSpecifierSource && moduleSpecifierSource.getFilePath() === fromPath) {
        const moduleSpecifier = exportDecl.getModuleSpecifier();
        if (!moduleSpecifier) continue;
        const oldValue = moduleSpecifier.getLiteralText();
        const newValue = computeUpdatedSpecifier(sourceFile.getFilePath(), toPath, oldValue);
        if (oldValue !== newValue) {
          updates.push({
            kind: 'export',
            sourceFile: toPosixRelative(root, sourceFile.getFilePath()),
            oldValue,
            newValue,
          });
        }
      }
    }
  }

  return updates;
}

function parsePlan(json: unknown, planPath: string): RenamePlan {
  if (!json || typeof json !== 'object') {
    throw new Error(`Invalid plan file at ${planPath}: expected an object.`);
  }
  const renames = (json as { renames?: unknown }).renames;
  if (!Array.isArray(renames)) {
    throw new Error(`Invalid plan file at ${planPath}: missing renames array.`);
  }
  const entries: RenamePlanEntry[] = renames.map((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      throw new Error(`Invalid rename entry at index ${index}: expected an object.`);
    }
    const from = (entry as { from?: unknown }).from;
    const to = (entry as { to?: unknown }).to;
    if (typeof from !== 'string' || typeof to !== 'string') {
      throw new Error(`Invalid rename entry at index ${index}: expected string from/to.`);
    }
    return { from, to };
  });
  return { renames: entries };
}

function parseCliOptions(argv: string[], root: string): CliOptions {
  const args = minimist(argv, {
    string: ['plan', 'filter', 'root'],
    boolean: ['apply', 'verbose'],
    alias: {
      p: 'plan',
      f: 'filter',
      a: 'apply',
      v: 'verbose',
    },
    default: {
      plan: path.join(root, 'reports', 'naming', 'export-alignment-plan.json'),
      apply: false,
      verbose: false,
    },
  });

  const planPath = path.resolve(root, String(args.plan));
  const filterValues = ([] as string[])
    .concat(args.filter ?? [])
    .map(String)
    .filter((value) => value.length > 0);
  const filters = filterValues.map((pattern) => new RegExp(pattern));

  return {
    planPath,
    root: args.root ? path.resolve(String(args.root)) : root,
    apply: Boolean(args.apply),
    filters,
    verbose: Boolean(args.verbose),
  };
}

function matchesFilters(entry: RenamePlanEntry, filters: RegExp[]): boolean {
  if (filters.length === 0) {
    return true;
  }
  return filters.some((regex) => regex.test(entry.from) || regex.test(entry.to));
}

function describeResult(result: OperationResult, root: string): void {
  const status = result.skipped ? 'skipped' : result.applied ? 'renamed' : 'dry-run';
  const relativeFrom = toPosixRelative(root, path.resolve(root, result.entry.from));
  const relativeTo = toPosixRelative(root, path.resolve(root, result.entry.to));
  /* eslint-disable no-console */
  console.log(`\n[${status}] ${relativeFrom} -> ${relativeTo}`);
  if (result.reason) {
    console.log(`  reason: ${result.reason}`);
  }
  if (result.specifierUpdates.length > 0) {
    console.log(`  specifier updates: ${result.specifierUpdates.length}`);
    for (const update of result.specifierUpdates) {
      console.log(
        `    - (${update.kind}) ${update.sourceFile}: '${update.oldValue}' -> '${update.newValue}'`
      );
    }
  } else {
    console.log('  specifier updates: 0');
  }
  /* eslint-enable no-console */
}

async function applyRenames(options: CliOptions): Promise<OperationResult[]> {
  const startedAt = performance.now();
  const planRaw = await fs.readFile(options.planPath, 'utf8');
  const plan = parsePlan(JSON.parse(planRaw), options.planPath);
  const entries = plan.renames.filter((entry) => matchesFilters(entry, options.filters));

  const project = new Project({
    tsConfigFilePath: path.join(options.root, 'tsconfig.json'),
    skipAddingFilesFromTsConfig: true,
    compilerOptions: {
      allowJs: false,
    },
  });
  await prepareSourceFiles(project, DEFAULT_INCLUDE, DEFAULT_IGNORE, options.root);

  const results: OperationResult[] = [];
  for (const entry of entries) {
    const fromPath = path.resolve(options.root, entry.from);
    const toPath = path.resolve(options.root, entry.to);
    const fromFile = project.getSourceFile(fromPath);
    if (!fromFile) {
      results.push({
        entry,
        applied: false,
        skipped: true,
        reason: 'source file not found in project',
        specifierUpdates: [],
      });
      continue;
    }

    const fromExists = project.getFileSystem().fileExistsSync(fromPath);
    if (!fromExists) {
      results.push({
        entry,
        applied: false,
        skipped: true,
        reason: 'source file missing on disk',
        specifierUpdates: [],
      });
      continue;
    }

    const toExists = project.getFileSystem().fileExistsSync(toPath);
    const caseInsensitiveMatch =
      fromPath.localeCompare(toPath, undefined, { sensitivity: 'accent' }) === 0;
    if (toExists && !caseInsensitiveMatch) {
      results.push({
        entry,
        applied: false,
        skipped: true,
        reason: 'target file already exists',
        specifierUpdates: [],
      });
      continue;
    }

    const specifierUpdates = collectSpecifierUpdates(project, options.root, fromPath, toPath);

    if (!options.apply) {
      results.push({ entry, applied: false, skipped: false, specifierUpdates });
      continue;
    }

    for (const update of specifierUpdates) {
      const sourceFile = project.getSourceFile(path.resolve(options.root, update.sourceFile));
      if (!sourceFile) continue;
      const importDecls = sourceFile
        .getImportDeclarations()
        .filter((decl) => decl.getModuleSpecifier().getLiteralText() === update.oldValue);
      const exportDecls = sourceFile.getExportDeclarations().filter((decl) => {
        const moduleSpecifier = decl.getModuleSpecifier();
        return moduleSpecifier ? moduleSpecifier.getLiteralText() === update.oldValue : false;
      });
      for (const decl of importDecls) {
        decl.setModuleSpecifier(update.newValue);
      }
      for (const decl of exportDecls) {
        const moduleSpecifier = decl.getModuleSpecifier();
        if (moduleSpecifier) {
          moduleSpecifier.setLiteralValue(update.newValue);
        }
      }
    }

    try {
      if (!caseInsensitiveMatch) {
        fromFile.move(toPath);
      } else {
        const tempPath = `${toPath}.rename-temp`;
        fromFile.move(tempPath);
        const tempFile = project.getSourceFileOrThrow(tempPath);
        tempFile.move(toPath);
      }
    } catch (error) {
      results.push({
        entry,
        applied: false,
        skipped: true,
        reason: error instanceof Error ? error.message : 'unknown error during move',
        specifierUpdates,
      });
      continue;
    }

    results.push({ entry, applied: true, skipped: false, specifierUpdates });
  }

  if (options.apply) {
    await project.save();
  }

  const elapsed = performance.now() - startedAt;
  /* eslint-disable no-console */
  console.log(`\nProcessed ${entries.length} rename(s) in ${(elapsed / 1000).toFixed(2)}s`);
  /* eslint-enable no-console */
  return results;
}

async function main(): Promise<void> {
  const cwd = process.cwd();
  const options = parseCliOptions(process.argv.slice(2), cwd);
  const results = await applyRenames(options);

  const applied = results.filter((result) => result.applied).length;
  const skipped = results.filter((result) => result.skipped).length;

  /* eslint-disable no-console */
  console.log(
    `\nSummary: applied=${applied}, skipped=${skipped}, dry=${results.length - applied - skipped}`
  );
  for (const result of results) {
    describeResult(result, options.root);
  }
  /* eslint-enable no-console */

  if (!options.apply) {
    console.log('\n(no changes written; run with --apply to execute)');
  }
}

main().catch((error: unknown) => {
  /* eslint-disable no-console */
  console.error(error);
  /* eslint-enable no-console */
  process.exitCode = 1;
});
