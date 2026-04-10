// ============================================================
// ExportAnalyzer -- uses ts-morph to extract export information
// from TypeScript / TSX source files.
//
// Provides:
//   analyzeFile(file, project)   – analyse a single file
//   createExportAnalyzer(tsConfigPath?) – factory with reusable Project
// ============================================================

import fs from 'node:fs';
import path from 'node:path';

import {
  type ExportAssignment,
  type ExportDeclaration,
  Project,
  type SourceFile,
  SyntaxKind,
} from 'ts-morph';

import type { ComponentMetrics, ExportInfo, FileAnalysis, FileEntry } from './types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Derive the "stem" of a file (name without extension). */
function fileStem(filePath: string): string {
  const base = path.basename(filePath);
  // Handle double extensions like .core.ts, .internal.ts
  const match = base.match(/^(.+?)\.(?:core|internal|impl)?\.[^.]+$/);
  if (match) return match[1];
  return path.parse(base).name;
}

/**
 * Check if a function name looks like a React hook call.
 * Hooks start with "use" followed by an uppercase letter.
 */
function isHookName(name: string): boolean {
  return (
    name.length > 3 &&
    name.startsWith('use') &&
    name[3] === name[3].toUpperCase() &&
    name[3] !== name[3].toLowerCase()
  );
}

// ---------------------------------------------------------------------------
// Export extraction
// ---------------------------------------------------------------------------

/**
 * Collect all exports from a source file.
 * Returns { exports, hasOwnDeclarations } where hasOwnDeclarations is false
 * when the file only contains re-exports.
 */
function collectExports(sourceFile: SourceFile): {
  exports: ExportInfo[];
  hasOwnDeclarations: boolean;
} {
  const exports: ExportInfo[] = [];
  let hasOwnDeclarations = false;

  // --- Named export declarations (export function X, export class X, etc.) ---
  for (const stmt of sourceFile.getStatements()) {
    const kind = stmt.getKind();

    // export function foo() {}
    if (kind === SyntaxKind.FunctionDeclaration) {
      const fn = stmt.asKindOrThrow(SyntaxKind.FunctionDeclaration);
      if (fn.isExported()) {
        hasOwnDeclarations = true;
        exports.push({
          name: fn.getName() ?? 'default',
          kind: 'function',
          isDefault: fn.isDefaultExport(),
        });
      }
      continue;
    }

    // export class Foo {}
    if (kind === SyntaxKind.ClassDeclaration) {
      const cls = stmt.asKindOrThrow(SyntaxKind.ClassDeclaration);
      if (cls.isExported()) {
        hasOwnDeclarations = true;
        exports.push({
          name: cls.getName() ?? 'default',
          kind: 'class',
          isDefault: cls.isDefaultExport(),
        });
      }
      continue;
    }

    // export interface Foo {}
    if (kind === SyntaxKind.InterfaceDeclaration) {
      const iface = stmt.asKindOrThrow(SyntaxKind.InterfaceDeclaration);
      if (iface.isExported()) {
        hasOwnDeclarations = true;
        exports.push({
          name: iface.getName(),
          kind: 'interface',
          isDefault: iface.isDefaultExport(),
        });
      }
      continue;
    }

    // export type Foo = ...
    if (kind === SyntaxKind.TypeAliasDeclaration) {
      const alias = stmt.asKindOrThrow(SyntaxKind.TypeAliasDeclaration);
      if (alias.isExported()) {
        hasOwnDeclarations = true;
        exports.push({
          name: alias.getName(),
          kind: 'type',
          isDefault: alias.isDefaultExport(),
        });
      }
      continue;
    }

    // export enum Foo {}
    if (kind === SyntaxKind.EnumDeclaration) {
      const en = stmt.asKindOrThrow(SyntaxKind.EnumDeclaration);
      if (en.isExported()) {
        hasOwnDeclarations = true;
        exports.push({
          name: en.getName(),
          kind: 'enum',
          isDefault: en.isDefaultExport(),
        });
      }
      continue;
    }

    // export const / export let / export var
    if (kind === SyntaxKind.VariableStatement) {
      const varStmt = stmt.asKindOrThrow(SyntaxKind.VariableStatement);
      if (varStmt.isExported()) {
        hasOwnDeclarations = true;
        for (const decl of varStmt.getDeclarations()) {
          const initializer = decl.getInitializer();
          const isFunction =
            initializer &&
            (initializer.getKind() === SyntaxKind.ArrowFunction ||
              initializer.getKind() === SyntaxKind.FunctionExpression);
          exports.push({
            name: decl.getName(),
            kind: isFunction ? 'function' : 'const',
            isDefault: varStmt.isDefaultExport(),
          });
        }
      }
      continue;
    }

    // export default expression (export default X)
    if (kind === SyntaxKind.ExportAssignment) {
      const assignment = stmt as ExportAssignment;
      if (!assignment.isExportEquals()) {
        hasOwnDeclarations = true;
        const expr = assignment.getExpression();
        const name = expr.getKind() === SyntaxKind.Identifier ? expr.getText() : 'default';
        exports.push({
          name,
          kind: 'const',
          isDefault: true,
        });
      }
      continue;
    }

    // export { X, Y } from '...' or export { X, Y }
    if (kind === SyntaxKind.ExportDeclaration) {
      const exportDecl = stmt as ExportDeclaration;
      const moduleSpecifier = exportDecl.getModuleSpecifierValue();

      if (moduleSpecifier) {
        // Re-export from another module
        const namedExports = exportDecl.getNamedExports();
        if (namedExports.length > 0) {
          for (const named of namedExports) {
            exports.push({
              name: named.getAliasNode()?.getText() ?? named.getName(),
              kind: 'reExport',
              isDefault: false,
            });
          }
        }
        // export * from '...' has no named exports but is still a re-export
        if (namedExports.length === 0) {
          exports.push({
            name: '*',
            kind: 'reExport',
            isDefault: false,
          });
        }
      } else {
        // export { X, Y } (local re-export, still counts as own declaration)
        hasOwnDeclarations = true;
        for (const named of exportDecl.getNamedExports()) {
          exports.push({
            name: named.getAliasNode()?.getText() ?? named.getName(),
            kind: 'const', // best guess for local re-exports
            isDefault: false,
          });
        }
      }
    }
  }

  return { exports, hasOwnDeclarations };
}

// ---------------------------------------------------------------------------
// Primary export heuristic
// ---------------------------------------------------------------------------

/**
 * Determine the primary export of a file.
 *
 * Heuristic (in priority order):
 *   1. If there's a default export, that's the primary.
 *   2. Otherwise, the named export whose name matches the file stem.
 *   3. Otherwise, the first named export.
 */
function determinePrimaryExport(exports: readonly ExportInfo[], stem: string): ExportInfo | null {
  if (exports.length === 0) return null;

  // 1. Default export
  const defaultExport = exports.find((e) => e.isDefault);
  if (defaultExport) return defaultExport;

  // 2. Named export matching file stem (case-insensitive comparison)
  const stemLower = stem.toLowerCase();
  const matchingStem = exports.find((e) => e.name.toLowerCase() === stemLower);
  if (matchingStem) return matchingStem;

  // 3. First named export (skip wildcard re-exports)
  const firstNamed = exports.find((e) => e.name !== '*');
  return firstNamed ?? null;
}

// ---------------------------------------------------------------------------
// Component metrics (for .tsx files)
// ---------------------------------------------------------------------------

/**
 * Count lines that contain JSX elements.
 * Simple heuristic: lines containing `<` followed by an uppercase letter
 * or `</` or `/>` are considered JSX lines.
 */
function countJsxLines(sourceFile: SourceFile): number {
  const text = sourceFile.getFullText();
  const lines = text.split('\n');
  let count = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip empty lines, comments, and import statements
    if (
      !trimmed ||
      trimmed.startsWith('//') ||
      trimmed.startsWith('*') ||
      trimmed.startsWith('import ')
    ) {
      continue;
    }
    // Check for JSX patterns
    if (
      // Opening tag (Component or html element)
      /<[A-Za-z0-9]/.test(trimmed) ||
      // React fragment opening: <>
      /<>/.test(trimmed) ||
      // Closing tag: </Component> or </>
      /<\//.test(trimmed) ||
      // Self-closing: />
      /\/>/.test(trimmed)
    ) {
      count++;
    }
  }

  return count;
}

/**
 * Collect hook call information from a source file.
 * Hooks are call expressions where the function name starts with "use"
 * and the next character is uppercase.
 */
function collectHookCalls(sourceFile: SourceFile): {
  hookCallCount: number;
  hookNames: string[];
} {
  const hookNames = new Set<string>();
  let hookCallCount = 0;

  const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);

  for (const call of callExpressions) {
    const expr = call.getExpression();
    let name: string | undefined;

    // Direct call: useState(...)
    if (expr.getKind() === SyntaxKind.Identifier) {
      name = expr.getText();
    }
    // Property access: React.useState(...)
    else if (expr.getKind() === SyntaxKind.PropertyAccessExpression) {
      const propAccess = expr.asKindOrThrow(SyntaxKind.PropertyAccessExpression);
      name = propAccess.getName();
    }

    if (name && isHookName(name)) {
      hookNames.add(name);
      hookCallCount++;
    }
  }

  const names = [...hookNames].sort();
  return {
    hookCallCount,
    hookNames: names,
  };
}

/**
 * Check whether the file uses React.memo.
 */
function detectReactMemo(sourceFile: SourceFile): boolean {
  const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);

  for (const call of callExpressions) {
    const expr = call.getExpression();

    // React.memo(...)
    if (expr.getKind() === SyntaxKind.PropertyAccessExpression) {
      const propAccess = expr.asKindOrThrow(SyntaxKind.PropertyAccessExpression);
      if (propAccess.getName() === 'memo' && propAccess.getExpression().getText() === 'React') {
        return true;
      }
    }

    // memo(...) — imported directly
    if (expr.getKind() === SyntaxKind.Identifier && expr.getText() === 'memo') {
      return true;
    }
  }

  return false;
}

/**
 * Compute component metrics for a .tsx file.
 */
function computeComponentMetrics(sourceFile: SourceFile): ComponentMetrics {
  const jsxLineCount = countJsxLines(sourceFile);
  const { hookCallCount, hookNames } = collectHookCalls(sourceFile);
  const usesReactMemo = detectReactMemo(sourceFile);

  return {
    jsxLineCount,
    hookCallCount,
    usesReactMemo,
    hookNames,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Analyse a single file's export information using a ts-morph Project.
 *
 * @param file    - The FileEntry to analyse
 * @param project - A ts-morph Project instance (reuse for performance)
 * @returns FileAnalysis with primary export, all exports, re-export status, and component metrics
 */
export function analyzeFile(file: FileEntry, project: Project): FileAnalysis {
  let sourceFile: SourceFile | undefined = project.getSourceFile(file.absolutePath);

  if (!sourceFile) {
    sourceFile = project.addSourceFileAtPath(file.absolutePath);
  }

  const { exports, hasOwnDeclarations } = collectExports(sourceFile);

  // A file is re-export-only if it has exports but no own declarations
  const isReExportOnly = exports.length > 0 && !hasOwnDeclarations;

  const stem = fileStem(file.absolutePath);
  const primaryExport = determinePrimaryExport(exports, stem);

  // Component metrics only for .tsx files
  const componentMetrics = file.extension === '.tsx' ? computeComponentMetrics(sourceFile) : null;

  return {
    file,
    primaryExport,
    exports,
    isReExportOnly,
    componentMetrics,
  };
}

/**
 * Find the nearest tsconfig.json by walking up from the current directory.
 */
function findNearestTsConfig(): string | undefined {
  let dir = process.cwd();
  const root = path.parse(dir).root;

  while (dir !== root) {
    const candidate = path.join(dir, 'tsconfig.json');
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    dir = path.dirname(dir);
  }

  return undefined;
}

/**
 * Factory that creates an ExportAnalyzer with a reusable ts-morph Project.
 *
 * @param tsConfigPath - Optional path to tsconfig.json. If omitted, searches
 *                       for the nearest tsconfig.json or uses a minimal config.
 * @returns An object with an `analyze` method that accepts a FileEntry.
 */
export function createExportAnalyzer(tsConfigPath?: string): {
  analyze: (file: FileEntry) => FileAnalysis;
} {
  const resolvedTsConfig = tsConfigPath ?? findNearestTsConfig();

  const project = resolvedTsConfig
    ? new Project({ tsConfigFilePath: resolvedTsConfig, skipAddingFilesFromTsConfig: true })
    : new Project({
        compilerOptions: {
          target: 99, // ESNext
          module: 99, // ESNext
          jsx: 4, // react-jsx
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
        },
      });

  return {
    analyze: (file: FileEntry): FileAnalysis => analyzeFile(file, project),
  };
}
