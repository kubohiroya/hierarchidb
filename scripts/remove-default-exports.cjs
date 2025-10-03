#!/usr/bin/env node

const path = require('node:path');
const { Project, SyntaxKind, Node } = require('ts-morph');
const { globbySync } = require('globby');

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry');
const verbose = args.includes('--verbose') || args.includes('-v');

const workspaceRoot = process.cwd();

const project = new Project({
  tsConfigFilePath: path.join(workspaceRoot, 'tsconfig.json'),
  skipAddingFilesFromTsConfig: false,
});

const additionalFiles = globbySync(
  ['app/**/*.{ts,tsx}', 'packages/**/*.{ts,tsx}', 'scripts/**/*.{ts,tsx}'],
  {
    cwd: workspaceRoot,
    absolute: true,
    gitignore: true,
    ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/patches/**', '**/.turbo/**'],
  },
);

for (const filePath of additionalFiles) {
  if (!project.getSourceFile(filePath)) {
    project.addSourceFileAtPathIfExists(filePath);
  }
}

const conversions = new Map();
const filesToWrite = new Set();

const skipMatchers = [
  filePath => filePath.includes('/.git/') || filePath.includes('/node_modules/'),
  filePath => filePath.includes('/dist/') || filePath.includes('/build/'),
  filePath => filePath.includes('/__generated__/'),
  filePath => filePath.includes('/patches/'),
  filePath => filePath.includes('/docs/'),
  filePath => filePath.endsWith('.d.ts') || filePath.endsWith('.d.cts') || filePath.endsWith('.d.mts'),
  filePath => filePath.includes('/app/src/routes/'),
  filePath => filePath.includes('packages/ui/theme/src/theme/createTheme'),
  filePath => filePath.includes('packages/tools/vite-plugin-dev-health/src/index.ts'),
  filePath => filePath.includes('app/src/components/AppLogoIcon.tsx'),
  filePath => filePath.includes('app/src/components/dialogs/TrashDialog.tsx'),
  filePath => filePath.endsWith('app/src/routes.ts'),
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
  filePath => /\.stories\.[^.]+$/.test(filePath),
  filePath => /(vite(?:\.[^/]+)?|vitest|playwright|tsup|eslint)\.config\.[^.]+$/.test(filePath),
  filePath => filePath.endsWith('react-router.config.ts'),
  filePath => filePath.endsWith('/vite.config.ts') || filePath.endsWith('/vite.config.mts') || filePath.endsWith('/vitest.config.ts') || filePath.endsWith('/playwright.config.ts'),
];

function shouldSkip(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  return skipMatchers.some(fn => fn(normalized));
}

function fileNameToIdentifier(filePath) {
  const base = path.basename(filePath).replace(/\.[^.]+$/, '');
  const cleaned = base.replace(/[^a-zA-Z0-9]+/g, ' ');
  const parts = cleaned.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'DefaultExport';
  let identifier = parts.map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('');
  if (!/^[_$a-zA-Z]/.test(identifier)) identifier = `_${identifier}`;
  if (/^\d+$/.test(identifier)) identifier = `Value${identifier}`;
  return identifier || 'DefaultExport';
}

function ensureVariableExport(variable) {
  const statement = variable.getFirstAncestorByKind(SyntaxKind.VariableStatement);
  if (statement && !statement.isExported()) {
    statement.setIsExported(true);
  }
}

function markDeclarationExported(node) {
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

function processSourceFile(file) {
  const filePath = file.getFilePath();
  if (shouldSkip(filePath)) {
    if (verbose) console.info(`[remove-default-exports] skip ${filePath}`);
    return;
  }

  let exportName;
  let touched = false;

  const defaultFns = file.getFunctions().filter(fn => fn.isDefaultExport());
  defaultFns.forEach(fn => {
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

  file.getExportAssignments().filter(assign => !assign.isExportEquals()).forEach(assign => {
    const expr = assign.getExpression();
    if (!expr) return;

    if (expr.getKind() === SyntaxKind.Identifier) {
      const ident = expr.getText();
      exportName = exportName ?? ident;
      const symbol = expr.getSymbol();
      if (symbol) {
        symbol.getDeclarations().forEach(decl => {
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

  if (!touched) return;

  const finalName = exportName ?? fileNameToIdentifier(filePath);
  conversions.set(filePath, finalName);
  filesToWrite.add(filePath);
}

function updateImportsAndExports() {
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
      decl.removeDefaultImport();

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
      filesToWrite.add(filePath);
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
          filesToWrite.add(filePath);
        } else if (alias === 'default') {
          spec.setAlias(undefined);
          filesToWrite.add(filePath);
        }
      });
    });
  }
}

(function main() {
  const projectFiles = project.getSourceFiles();
  if (verbose) console.info(`[remove-default-exports] loaded ${projectFiles.length} file(s) from tsconfig.`);

  projectFiles.forEach(processSourceFile);

  updateImportsAndExports();

  if (isDryRun) {
    if (conversions.size === 0 && filesToWrite.size === 0) {
      console.info('[remove-default-exports] Dry run – no changes required.');
      return;
    }

    console.info(`[remove-default-exports] Dry run – would update ${filesToWrite.size} file(s).`);
    Array.from(conversions.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([filePath, name]) => {
        const rel = path.relative(workspaceRoot, filePath);
        console.info(` - convert ${rel} -> ${name}`);
      });
    const importOnly = Array.from(filesToWrite).filter(filePath => !conversions.has(filePath));
    if (importOnly.length > 0) {
      console.info(` - rewrite imports in ${importOnly.length} file(s)`);
      importOnly.sort().forEach(filePath => {
        const rel = path.relative(workspaceRoot, filePath);
        console.info(`   * ${rel}`);
      });
    }
    return;
  }

  for (const filePath of filesToWrite) {
    const sourceFile = project.getSourceFile(filePath);
    if (sourceFile) {
      sourceFile.saveSync();
    }
  }

  console.info(`[remove-default-exports] Converted default exports in ${conversions.size} file(s) and rewrote imports where required.`);
})();
