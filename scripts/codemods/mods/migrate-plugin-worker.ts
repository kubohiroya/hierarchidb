import path from 'node:path';
import { Project } from 'ts-morph';
import { pascalCase } from 'change-case';
import type { RunnerContext } from '../runner.js';

export function describe(): string {
  return 'Convert plugin worker re-exports into async factory loaders (prototype).';
}

function createLoaderName(moduleSpecifier: string): string {
  const basename = pascalCase(moduleSpecifier.replace(/\.(js|ts)x?$/, '').split('/').pop() ?? 'module');
  return `load${basename}Module`;
}

export async function runCodemod(context: RunnerContext): Promise<void> {
  const project = new Project({
    tsConfigFilePath: path.join(context.workspaceRoot, 'tsconfig.json'),
    skipAddingFilesFromTsConfig: true,
  });

  const changedFiles: string[] = [];

  for (const filePath of context.files) {
    const sourceFile = project.addSourceFileAtPathIfExists(filePath);
    if (!sourceFile) {
      continue;
    }

    const exportDecls = sourceFile.getExportDeclarations().filter((decl) => !!decl.getModuleSpecifierValue());
    if (exportDecls.length === 0) {
      continue;
    }

    let mutated = false;

    for (const decl of exportDecls) {
      const moduleSpecifier = decl.getModuleSpecifierValue();
      if (!moduleSpecifier) {
        continue;
      }

      const namedExports = decl.getNamedExports();
      const exportAll = decl.isNamespaceExport();
      const exportNames = namedExports.map((exp) => exp.getName());

      if (!exportAll && exportNames.length === 0) {
        continue;
      }

      mutated = true;
      decl.remove();

      if (!exportAll && exportNames.length > 0) {
        sourceFile.addExportDeclaration({
          moduleSpecifier,
          isTypeOnly: true,
          namedExports: exportNames,
        });
      }

      if (exportAll) {
        sourceFile.addExportDeclaration({ moduleSpecifier, isTypeOnly: true, namespaceExport: '*' });
      }

      const functionName = createLoaderName(moduleSpecifier);
      if (!sourceFile.getFunction(functionName)) {
        sourceFile.addFunction({
          name: functionName,
          isExported: true,
          isAsync: true,
          statements: `return import(/* @vite-ignore */ '${moduleSpecifier}');`,
        });
      }
    }

    if (mutated) {
      changedFiles.push(filePath);
      if (context.dryRun) {
        console.info(`[codemod:migrate-plugin-worker] would update ${filePath}`);
      }
    }
  }

  if (context.dryRun) {
    return;
  }

  if (changedFiles.length > 0) {
    await project.save();
    console.info(`[codemod:migrate-plugin-worker] Updated ${changedFiles.length} file(s).`);
  }
}
