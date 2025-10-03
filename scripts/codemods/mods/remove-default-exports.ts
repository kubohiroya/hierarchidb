import path from 'node:path';
import { Project, SyntaxKind, Node, type SourceFile, type VariableDeclaration } from 'ts-morph';
import type { RunnerContext } from '../runner.js';

export function describe(): string {
  return 'Convert default exports (except framework-mandated cases) into named exports and rewrite imports.';
}

type ConversionMap = Map<string, string>;

const skipMatchers: ((filePath: string) => boolean)[] = [
  filePath => filePath.includes('/.git/') || filePath.includes('/node_modules/'),
  filePath => filePath.includes('/dist/') || filePath.includes('/build/'),
  filePath => filePath.includes('/__generated__/'),
  filePath => filePath.includes('/patches/'),
  filePath => filePath.includes('/docs/'),
  filePath => filePath.endsWith('.d.ts') || filePath.endsWith('.d.cts') || filePath.endsWith('.d.mts'),
  // React Router route modules (default export required)
  filePath => filePath.includes('/app/src/routes/'),
  filePath => filePath.includes('packages/ui/theme/src/theme/createTheme'),
  filePath => filePath.includes('packages/tools/vite-plugin-dev-health/src/index.ts'),
  filePath => filePath.includes('app/src/components/AppLogoIcon.tsx'),
  filePath => filePath.includes('app/src/components/dialogs/TrashDialog.tsx'),
  filePath => filePath.includes('app/src/virtual/child-process-shim.ts'),
  filePath => filePath.includes('app/src/virtual/crypto-shim.ts'),
  filePath => filePath.includes('app/src/virtual/node-fetch.ts'),
  filePath => filePath.includes('app/src/virtual/plugin-definitions.ts'),
  filePath => filePath.includes('app/src/virtual/stubs/ui-core-components/CategorySelector.tsx'),
  filePath => filePath.includes('app/src/virtual/stubs/ui-core-components/TagInput.tsx'),
  filePath => filePath.includes('app/src/virtual/stubs/ui-core-TagInput.tsx'),
  filePath => filePath.includes('app/src/virtual/stubs/spreadsheet-plugin-stub.ts'),
  filePath => filePath.includes('app/src/virtual/stubs/folder-plugin-stub.ts'),
  filePath => filePath.includes('app/src/virtual/stubs/timeline-plugin-stub.ts'),
  filePath => filePath.includes('app/src/virtual/stubs/route-plugin-stub.ts'),
  filePath => filePath.includes('app/src/virtual/stubs/location-plugin-stub.ts'),
  filePath => filePath.includes('app/src/virtual/stubs/styler-plugin-stub.ts'),
  filePath => filePath.includes('app/src/virtual/stubs/shape-plugin-stub.ts'),
  filePath => filePath.includes('app/src/virtual/stubs/basemap-plugin-stub.ts'),
  // Storybook stories (default export required by story format)
  filePath => /\.stories\.[^.]+$/.test(filePath),
  // CLI / tool configs that rely on default exports
  filePath => /(vite|vitest|playwright|tsup|eslint)\.config\.[^.]+$/.test(filePath),
  filePath => filePath.endsWith('/vite.config.ts') || filePath.endsWith('/vite.config.mts') || filePath.endsWith('/vitest.config.ts') || filePath.endsWith('/playwright.config.ts'),
];

function shouldSkip(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  return skipMatchers.some(fn => fn(normalized));
}

function fileNameToIdentifier(filePath: string): string {
  const base = path.basename(filePath).replace(/\.[^.]+$/, '');
  const cleaned = base.replace(/[^a-zA-Z0-9]+/g, ' ');
  const parts = cleaned.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'DefaultExport';
  let identifier = parts.map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('');
  if (!/^[_$a-zA-Z]/.test(identifier)) identifier = `_${identifier}`;
  if (/^\d+$/.test(identifier)) identifier = `Value${identifier}`;
  return identifier || 'DefaultExport';
}

function ensureVariableExport(variable: VariableDeclaration): void {
  const statement = variable.getFirstAncestorByKind(SyntaxKind.VariableStatement);
  if (statement && !statement.isExported()) {
    statement.setIsExported(true);
  }
}

function markDeclarationExported(node: Node): void {
  if (Node.isFunctionDeclaration(node)) {
    node.setIsDefaultExport(false);
    node.setIsExported(true);
  } else if (Node.isClassDeclaration(node)) {
    node.setIsDefaultExport(false);
    node.setIsExported(true);
  } else if (Node.isEnumDeclaration(node)) {
    node.setIsDefaultExport(false);
    node.setIsExported(true);
  } else if (Node.isVariableDeclaration(node)) {
    ensureVariableExport(node);
  }
}

function processSourceFile(file: SourceFile, conversions: ConversionMap, modifiedFiles: Set<string>, verbose: boolean): void {
  const filePath = file.getFilePath();
  if (shouldSkip(filePath)) {
    if (verbose) console.info(`[codemod:remove-default-exports] skipped ${filePath}`);
    return;
  }

  let exportName: string | undefined;
  let touched = false;

  const defaultFunctions = file.getFunctions().filter(fn => fn.isDefaultExport());
  defaultFunctions.forEach(fn => {
    let name = fn.getName();
    if (!name) {
      name = fileNameToIdentifier(filePath);
      fn.rename(name);
    }
    fn.setIsDefaultExport(false);
    fn.setIsExported(true);
    exportName = name;
    touched = true;
  });

  const defaultClasses = file.getClasses().filter(cls => cls.isDefaultExport());
  defaultClasses.forEach(cls => {
    let name = cls.getName();
    if (!name) {
      name = fileNameToIdentifier(filePath);
      cls.rename(name);
    }
    cls.setIsDefaultExport(false);
    cls.setIsExported(true);
    exportName = name;
    touched = true;
  });

  const exportAssignments = file.getExportAssignments().filter(assign => !assign.isExportEquals());
  exportAssignments.forEach(assign => {
    const expr = assign.getExpression();
    if (!expr) return;

    if (expr.getKind() === SyntaxKind.Identifier) {
      const ident = expr.getText();
      exportName = exportName ?? ident;

      const symbol = expr.getSymbol();
      if (symbol) {
        const declarations = symbol.getDeclarations();
        declarations.forEach(decl => {
          if (decl.getSourceFile() !== file) return;
          markDeclarationExported(decl);
        });
      }

      assign.remove();
      touched = true;
    } else {
      const generatedName = exportName ?? fileNameToIdentifier(filePath);
      const expressionText = expr.getText();
      assign.replaceWithText(`const ${generatedName} = ${expressionText};\nexport { ${generatedName} };`);
      exportName = generatedName;
      touched = true;
    }
  });

  file.getExportDeclarations().forEach(decl => {
    decl.getNamedExports().forEach(spec => {
      const alias = spec.getAliasNode()?.getText();
      if (spec.getName() === 'default') {
        const name = alias && alias !== 'default' ? alias : fileNameToIdentifier(filePath);
        spec.setName(name);
        if (alias && alias !== 'default') {
          spec.setAlias(alias);
        } else {
          spec.setAlias(undefined);
        }
        exportName = name;
        touched = true;
      } else if (alias === 'default') {
        spec.setAlias(undefined);
        exportName = spec.getName();
        touched = true;
      }
    });
  });

  if (!touched) {
    return;
  }

  const finalName = exportName ?? fileNameToIdentifier(filePath);
  conversions.set(filePath, finalName);
  modifiedFiles.add(filePath);
}

function updateImportsAndExports(project: Project, conversions: ConversionMap, verbose: boolean): void {
  for (const file of project.getSourceFiles()) {
    const filePath = file.getFilePath();
    if (shouldSkip(filePath)) continue;

    file.getImportDeclarations().forEach(decl => {
      const moduleSource = decl.getModuleSpecifierSourceFile();
      if (!moduleSource) return;
      const newName = conversions.get(moduleSource.getFilePath());
      if (!newName) return;

      const defaultImport = decl.getDefaultImport();
      if (!defaultImport) return;

      const localName = defaultImport.getText();
      defaultImport.remove();

      const namedImports = decl.getNamedImports();
      const existing = namedImports.find(spec => spec.getName() === newName);
      if (existing) {
        if (localName !== newName) {
          existing.setAlias(localName);
        }
      } else {
        if (localName === newName) {
          decl.addNamedImport({ name: newName });
        } else {
          decl.addNamedImport({ name: newName, alias: localName });
        }
      }
      if (verbose) console.info(`[codemod:remove-default-exports] updated import in ${filePath}`);
    });

    file.getExportDeclarations().forEach(decl => {
      const moduleSource = decl.getModuleSpecifierSourceFile();
      if (!moduleSource) return;
      const newName = conversions.get(moduleSource.getFilePath());
      if (!newName) return;

      decl.getNamedExports().forEach(spec => {
        const alias = spec.getAliasNode()?.getText();
        if (spec.getName() === 'default') {
          if (alias && alias !== 'default') {
            spec.setName(newName);
            spec.setAlias(alias);
          } else {
            spec.setName(newName);
            spec.setAlias(undefined);
          }
        } else if (alias === 'default') {
          spec.setAlias(undefined);
        }
      });
    });
  }
}

export async function runCodemod(context: RunnerContext): Promise<void> {
  const project = new Project({
    tsConfigFilePath: path.join(context.workspaceRoot, 'tsconfig.json'),
    skipAddingFilesFromTsConfig: false,
  });

  const conversions: ConversionMap = new Map();
  const modifiedFiles = new Set<string>();

  for (const filePath of context.files) {
    const sourceFile = project.getSourceFile(filePath) ?? project.addSourceFileAtPathIfExists(filePath);
    if (!sourceFile) continue;
    processSourceFile(sourceFile, conversions, modifiedFiles, context.dryRun || verbose);
  }

  if (conversions.size === 0) {
    console.info('[codemod:remove-default-exports] No default exports converted.');
    return;
  }

  updateImportsAndExports(project, conversions, context.dryRun || verbose);

  if (context.dryRun) {
    console.info(`[codemod:remove-default-exports] dry run – would update ${modifiedFiles.size} file(s).`);
    Array.from(modifiedFiles)
      .sort()
      .forEach(file => {
        const rel = path.relative(context.workspaceRoot, file);
        const exported = conversions.get(file);
        console.info(` - ${rel} -> ${exported}`);
      });
    return;
  }

  await project.save();
  console.info(`[codemod:remove-default-exports] Updated ${modifiedFiles.size} file(s) and rewrote imports where necessary.`);
}
