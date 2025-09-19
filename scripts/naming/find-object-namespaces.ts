/**
 * @file scripts/naming/find-object-namespaces.ts
 * @description Detects exported const object literals that expose functions (method shorthand or arrow functions).
 * @why Supports the migration away from plain-object namespaces toward static class patterns.
 */

import path from 'node:path';
import process from 'node:process';
import { globby } from 'globby';
import { Project, SyntaxKind, VariableDeclarationKind } from 'ts-morph';
import type { ObjectLiteralElementLike } from 'ts-morph';

const INCLUDE = [
  'app/**/*.{ts,tsx}',
  'packages/**/*.{ts,tsx}',
  'tools/**/*.{ts,tsx}',
  'scripts/**/*.{ts,tsx}',
  'deprecated/**/*.{ts,tsx}',
];

const IGNORE = [
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.turbo',
  '**/*.d.ts',
  '**/*.d.tsx',
  '**/*.stories.*',
  '**/*.spec.*',
  '**/*.test.*',
];

function elementContainsFunction(element: ObjectLiteralElementLike): boolean {
  if (element.getKind() === SyntaxKind.MethodDeclaration) {
    return true;
  }
  if (element.getKind() === SyntaxKind.PropertyAssignment) {
    const assignment = element.asKindOrThrow(SyntaxKind.PropertyAssignment);
    const initializer = assignment.getInitializer();
    if (!initializer) return false;
    const kind = initializer.getKind();
    return kind === SyntaxKind.ArrowFunction || kind === SyntaxKind.FunctionExpression;
  }
  if (element.getKind() === SyntaxKind.GetAccessor || element.getKind() === SyntaxKind.SetAccessor) {
    return true;
  }
  return false;
}

async function main() {
  const root = process.cwd();
  const project = new Project({
    tsConfigFilePath: path.join(root, 'tsconfig.json'),
    skipAddingFilesFromTsConfig: true,
  });

  const filePaths = await globby(INCLUDE, {
    cwd: root,
    absolute: true,
    followSymbolicLinks: false,
    ignore: IGNORE,
  });

  for (const filePath of filePaths) {
    project.addSourceFileAtPathIfExists(filePath);
  }

  const results: Array<{
    filePath: string;
    name: string;
    line: number;
    kind: 'method' | 'arrow' | 'accessor';
  }> = [];

  for (const sourceFile of project.getSourceFiles()) {
    for (const statement of sourceFile.getVariableStatements()) {
      if (!statement.isExported()) continue;
      if (statement.getDeclarationKind() !== VariableDeclarationKind.Const) continue;

      for (const declaration of statement.getDeclarations()) {
        const rawInitializer = declaration.getInitializer();
        if (!rawInitializer) continue;

        const objectLiteral = rawInitializer.isKind(SyntaxKind.ObjectLiteralExpression)
          ? rawInitializer
          : rawInitializer.isKind(SyntaxKind.AsExpression) || rawInitializer.isKind(SyntaxKind.TypeAssertionExpression)
            ? rawInitializer.getExpressionIfKind(SyntaxKind.ObjectLiteralExpression)
            : undefined;
        if (!objectLiteral) continue;

        const props = objectLiteral.getProperties();
        const matches = props.filter((element) => elementContainsFunction(element));
        if (matches.length === 0) continue;

        const name = declaration.getName();
        const line = declaration.getNameNode().getStartLineNumber();

        for (const match of matches) {
          let kind: 'method' | 'arrow' | 'accessor';
          if (match.getKind() === SyntaxKind.MethodDeclaration) {
            kind = 'method';
          } else if (match.getKind() === SyntaxKind.PropertyAssignment) {
            kind = 'arrow';
          } else {
            kind = 'accessor';
          }
          results.push({
            filePath: path.relative(root, sourceFile.getFilePath()),
            name,
            line,
            kind,
          });
        }
      }
    }
  }

  if (results.length === 0) {
    console.log('No exported const object namespaces with functions were found.');
    return;
  }

  const grouped = new Map<string, { filePath: string; line: number; kinds: Set<string> }>();

  for (const result of results) {
    const key = `${result.filePath}::${result.name}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.kinds.add(result.kind);
    } else {
      grouped.set(key, { filePath: result.filePath, line: result.line, kinds: new Set([result.kind]) });
    }
  }

  const entries = Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  for (const [key, info] of entries) {
    const [, name] = key.split('::');
    const kinds = Array.from(info.kinds).sort().join(',');
    console.log(`${info.filePath}:${info.line} — ${name} (${kinds})`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
