/**
 * @file scripts/naming/report-export-alignment.ts
 * @description Generates a report of files whose primary exports do not align with the file name.
 * @why Supports the naming guideline transition by identifying rename candidates before automation.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import process from 'node:process';
import { globby } from 'globby';
import minimist from 'minimist';
import { Node, Project, SourceFile, SyntaxKind, VariableDeclaration } from 'ts-morph';

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

type ExportKindCategory = 'value' | 'type';

type ExportDescriptor = {
  readonly exportName: string;
  readonly identifierName: string | null;
  readonly kind: string;
  readonly category: ExportKindCategory;
  readonly isDefault: boolean;
  readonly pos: { line: number; column: number };
};

type ReportItem = {
  readonly filePath: string;
  readonly baseName: string;
  readonly extension: string;
  readonly exports: ExportDescriptor[];
  readonly exactMatches: string[];
  readonly fuzzyMatches: string[];
  readonly recommendedBaseName: string | null;
  readonly recommendedFileName: string | null;
  readonly classification:
    | 'match'
    | 'case-mismatch'
    | 'no-matching-export'
    | 'type-only'
    | 'no-export';
};

type Report = {
  readonly generatedAt: string;
  readonly rootDir: string;
  readonly include: string[];
  readonly ignore: string[];
  readonly totals: {
    readonly filesAnalyzed: number;
    readonly matches: number;
    readonly caseMismatches: number;
    readonly noMatchingExport: number;
    readonly typeOnly: number;
    readonly noExport: number;
  };
  readonly items: ReportItem[];
};

type CliOptions = {
  include: string[];
  ignore: string[];
  out?: string;
  root: string;
  includeTests: boolean;
  verbose: boolean;
};

function toPosixRelative(root: string, filePath: string): string {
  const rel = path.relative(root, filePath);
  return rel.split(path.sep).join('/');
}

function normalizeName(name: string): string {
  return name.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
}

function unique<T>(values: Iterable<T>): T[] {
  return Array.from(new Set(values));
}

function isIndexLikeBase(baseName: string): boolean {
  return /^index(\.|$)/i.test(baseName);
}

function classifyDeclaration(node: Node): ExportKindCategory {
  if (
    Node.isTypeAliasDeclaration(node) ||
    Node.isInterfaceDeclaration(node) ||
    Node.isTypeParameterDeclaration(node)
  ) {
    return 'type';
  }
  if (Node.isVariableDeclaration(node)) {
    const declaration = node as VariableDeclaration;
    const typeNode = declaration.getTypeNode();
    if (typeNode && typeNode.getKind() === SyntaxKind.TypeLiteral) {
      return 'type';
    }
  }
  return 'value';
}

function getIdentifierName(node: Node, fallback: string): string | null {
  if (
    Node.isClassDeclaration(node) ||
    Node.isFunctionDeclaration(node) ||
    Node.isInterfaceDeclaration(node) ||
    Node.isTypeAliasDeclaration(node) ||
    Node.isEnumDeclaration(node)
  ) {
    return node.getName() ?? fallback;
  }
  if (Node.isVariableDeclaration(node)) {
    const nameNode = node.getNameNode();
    if (Node.isIdentifier(nameNode)) {
      return nameNode.getText();
    }
    return null;
  }
  if (Node.isPropertyDeclaration(node) || Node.isMethodDeclaration(node)) {
    return null;
  }
  if (Node.isExportSpecifier(node)) {
    const nameNode = node.getNameNode();
    if (Node.isIdentifier(nameNode)) {
      return nameNode.getText();
    }
  }
  if (Node.isExportAssignment(node)) {
    return fallback === 'default' ? node.getExpression().getText() : fallback;
  }
  return fallback !== 'default' ? fallback : null;
}

function collectExportDescriptors(sourceFile: SourceFile): ExportDescriptor[] {
  const exportedDeclarations = sourceFile.getExportedDeclarations();
  const descriptors: ExportDescriptor[] = [];

  exportedDeclarations.forEach((declarations, exportName) => {
    for (const declaration of declarations) {
      if (declaration.getSourceFile() !== sourceFile) {
        continue;
      }
      const identifierName = getIdentifierName(declaration, exportName);
      const position = sourceFile.getLineAndColumnAtPos(declaration.getStart());
      descriptors.push({
        exportName,
        identifierName,
        kind: declaration.getKindName(),
        category: classifyDeclaration(declaration),
        isDefault: exportName === 'default',
        pos: { line: position.line, column: position.column },
      });
    }
  });

  return descriptors;
}

function determineClassification(
  baseName: string,
  descriptors: ExportDescriptor[]
): ReportItem['classification'] {
  if (descriptors.length === 0) {
    return 'no-export';
  }
  const valueExports = descriptors.filter((descriptor) => descriptor.category === 'value');
  if (valueExports.length === 0) {
    return 'type-only';
  }

  const exactMatches = valueExports.filter((descriptor) => descriptor.identifierName === baseName);
  if (exactMatches.length > 0) {
    return 'match';
  }

  const normalizedBase = normalizeName(baseName);
  const hasFuzzyMatch = valueExports.some((descriptor) => {
    if (!descriptor.identifierName) return false;
    return normalizeName(descriptor.identifierName) === normalizedBase;
  });

  return hasFuzzyMatch ? 'case-mismatch' : 'no-matching-export';
}

function buildReportItem(root: string, sourceFile: SourceFile): ReportItem | null {
  const filePath = sourceFile.getFilePath();
  const extension = path.extname(filePath);
  const baseName = path.basename(filePath, extension);

  if (isIndexLikeBase(baseName)) {
    return null;
  }

  const descriptors = collectExportDescriptors(sourceFile);
  const classification = determineClassification(baseName, descriptors);

  const valueExports = descriptors.filter(
    (descriptor) => descriptor.category === 'value' && descriptor.identifierName
  );
  const exactMatches = valueExports
    .filter((descriptor) => descriptor.identifierName === baseName)
    .map((descriptor) => descriptor.identifierName!)
    .sort();

  const normalizedBase = normalizeName(baseName);
  const fuzzyMatches = valueExports
    .filter(
      (descriptor) =>
        descriptor.identifierName &&
        normalizeName(descriptor.identifierName) === normalizedBase &&
        descriptor.identifierName !== baseName
    )
    .map((descriptor) => descriptor.identifierName!)
    .sort();

  const recommended =
    valueExports.find((descriptor) => descriptor.identifierName && !descriptor.isDefault)
      ?.identifierName ??
    valueExports.find((descriptor) => descriptor.identifierName)?.identifierName ??
    null;

  const recommendedFileName = recommended ? `${recommended}${extension}` : null;

  return {
    filePath: toPosixRelative(root, filePath),
    baseName,
    extension,
    exports: descriptors,
    exactMatches: unique(exactMatches),
    fuzzyMatches: unique(fuzzyMatches),
    recommendedBaseName: recommended,
    recommendedFileName,
    classification,
  };
}

async function prepareSourceFiles(
  project: Project,
  include: string[],
  ignore: string[],
  root: string
): Promise<SourceFile[]> {
  const filePaths = await globby(include, {
    cwd: root,
    absolute: true,
    ignore,
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

function parseCliOptions(argv: string[], root: string): CliOptions {
  const args = minimist(argv, {
    boolean: ['include-tests', 'verbose'],
    string: ['out', 'root'],
    alias: {
      o: 'out',
      r: 'root',
      t: 'include-tests',
      v: 'verbose',
    },
    default: {
      root,
      verbose: false,
      'include-tests': false,
    },
  });

  const include = Array.isArray(args._) && args._.length > 0 ? args._.map(String) : DEFAULT_INCLUDE;
  const ignore = [...DEFAULT_IGNORE];
  if (args['include-tests']) {
    const testPatterns = ['**/*.test.*', '**/*.spec.*', '**/*.stories.*', '**/__tests__/**'];
    for (const pattern of testPatterns) {
      const index = ignore.indexOf(pattern);
      if (index >= 0) {
        ignore.splice(index, 1);
      }
    }
  }

  return {
    include,
    ignore,
    out: args.out ? String(args.out) : undefined,
    root: args.root ? path.resolve(String(args.root)) : root,
    includeTests: Boolean(args['include-tests']),
    verbose: Boolean(args.verbose),
  };
}

function summarize(items: ReportItem[]): Report['totals'] {
  let matches = 0;
  let caseMismatches = 0;
  let noMatchingExport = 0;
  let typeOnly = 0;
  let noExport = 0;

  for (const item of items) {
    switch (item.classification) {
      case 'match':
        matches += 1;
        break;
      case 'case-mismatch':
        caseMismatches += 1;
        break;
      case 'no-matching-export':
        noMatchingExport += 1;
        break;
      case 'type-only':
        typeOnly += 1;
        break;
      case 'no-export':
        noExport += 1;
        break;
    }
  }

  return {
    filesAnalyzed: items.length,
    matches,
    caseMismatches,
    noMatchingExport,
    typeOnly,
    noExport,
  };
}

function printSummary(report: Report, verbose: boolean): void {
  /* eslint-disable no-console */
  console.log(`\nExport/File alignment report`);
  console.log(`Generated at: ${report.generatedAt}`);
  console.log(`Files analyzed: ${report.totals.filesAnalyzed}`);
  console.log(`Matches: ${report.totals.matches}`);
  console.log(`Case mismatches: ${report.totals.caseMismatches}`);
  console.log(`No matching export: ${report.totals.noMatchingExport}`);
  console.log(`Type-only exports: ${report.totals.typeOnly}`);
  console.log(`No exports: ${report.totals.noExport}`);

  if (verbose) {
    console.log('\n--- Detailed mismatches ---');
    for (const item of report.items.filter((entry) => entry.classification !== 'match')) {
      console.log(`\n• ${item.filePath}`);
      console.log(`  baseName: ${item.baseName}`);
      console.log(`  classification: ${item.classification}`);
      if (item.exactMatches.length > 0) {
        console.log(`  exactMatches: ${item.exactMatches.join(', ')}`);
      }
      if (item.fuzzyMatches.length > 0) {
        console.log(`  fuzzyMatches: ${item.fuzzyMatches.join(', ')}`);
      }
      if (item.recommendedFileName) {
        console.log(`  suggested: ${item.recommendedFileName}`);
      }
      console.log(`  exports:`);
      for (const descriptor of item.exports) {
        console.log(
          `    - ${descriptor.identifierName ?? '<anonymous>'} (${descriptor.kind}, ${descriptor.category}${descriptor.isDefault ? ', default' : ''})`
        );
      }
    }
  }
  /* eslint-enable no-console */
}

function writeReportFile(outPath: string, report: Report): void {
  const dir = path.dirname(outPath);
  mkdirSync(dir, { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

async function generateReport(options: CliOptions): Promise<Report> {
  const startedAt = performance.now();
  const project = new Project({
    tsConfigFilePath: path.join(options.root, 'tsconfig.json'),
    skipAddingFilesFromTsConfig: true,
    compilerOptions: {
      allowJs: false,
    },
  });

  const sourceFiles = await prepareSourceFiles(
    project,
    options.include,
    options.ignore,
    options.root
  );
  const items: ReportItem[] = [];

  for (const sourceFile of sourceFiles) {
    const item = buildReportItem(options.root, sourceFile);
    if (item) {
      items.push(item);
    }
  }

  const totals = summarize(items);
  const report: Report = {
    generatedAt: new Date().toISOString(),
    rootDir: options.root,
    include: options.include,
    ignore: options.ignore,
    totals,
    items: items.sort((a, b) => a.filePath.localeCompare(b.filePath)),
  };

  const elapsed = performance.now() - startedAt;
  if (options.verbose) {
    /* eslint-disable no-console */
    console.log(`Analyzed ${sourceFiles.length} files in ${(elapsed / 1000).toFixed(2)}s`);
    /* eslint-enable no-console */
  }

  if (options.out) {
    writeReportFile(options.out, report);
  }

  printSummary(report, options.verbose);

  return report;
}

async function main(): Promise<void> {
  const cwd = process.cwd();
  const options = parseCliOptions(process.argv.slice(2), cwd);
  const outPath =
    options.out ?? path.join(options.root, 'reports', 'naming', 'export-alignment-phase1.json');
  const config: CliOptions = { ...options, out: outPath };

  await generateReport(config);
}

main().catch((error: unknown) => {
  /* eslint-disable no-console */
  console.error(error);
  /* eslint-enable no-console */
  process.exitCode = 1;
});
