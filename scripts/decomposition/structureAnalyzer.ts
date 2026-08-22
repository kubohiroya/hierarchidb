// ============================================================
// StructureAnalyzer -- extracts intra-file symbol dependencies
// using ts-morph AST analysis and builds a dependency graph.
//
// Provides:
//   analyzeStructure(file, project) – full structural analysis
//   buildDependencyGraph(sourceFile) – symbol dependency graph
// ============================================================

import { Project, type SourceFile, SyntaxKind } from 'ts-morph';

import { analyzeFile } from '../naming-audit/exportAnalyzer.js';
import type { DependencyGraph, ExportKind, FileEntry, FileStructure, SymbolNode } from './types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Map a ts-morph SyntaxKind to our ExportKind union.
 * Returns 'local' for non-exported or unrecognised kinds.
 */
function syntaxKindToExportKind(kind: SyntaxKind, isArrowOrFnExpr: boolean): ExportKind | 'local' {
  switch (kind) {
    case SyntaxKind.FunctionDeclaration:
      return 'function';
    case SyntaxKind.ClassDeclaration:
      return 'class';
    case SyntaxKind.TypeAliasDeclaration:
      return 'type';
    case SyntaxKind.InterfaceDeclaration:
      return 'interface';
    case SyntaxKind.EnumDeclaration:
      return 'enum';
    case SyntaxKind.VariableStatement:
      return isArrowOrFnExpr ? 'function' : 'const';
    default:
      return 'local';
  }
}

/**
 * Check whether a variable declaration initializer is a function
 * (arrow function or function expression).
 */
function isVariableFunctionLike(decl: import('ts-morph').VariableDeclaration): boolean {
  const init = decl.getInitializer();
  if (!init) return false;
  const k = init.getKind();
  return k === SyntaxKind.ArrowFunction || k === SyntaxKind.FunctionExpression;
}

// ---------------------------------------------------------------------------
// Symbol extraction
// ---------------------------------------------------------------------------

interface RawSymbol {
  readonly name: string;
  readonly kind: ExportKind | 'local';
  readonly isExported: boolean;
  readonly startLine: number;
  readonly endLine: number;
  readonly node: import('ts-morph').Node;
}

/**
 * Extract all top-level symbols from a source file.
 *
 * Handles:
 *   - FunctionDeclaration
 *   - ClassDeclaration
 *   - TypeAliasDeclaration
 *   - InterfaceDeclaration
 *   - EnumDeclaration
 *   - VariableStatement (const/let/var, including arrow functions)
 */
function extractTopLevelSymbols(sourceFile: SourceFile): RawSymbol[] {
  const symbols: RawSymbol[] = [];

  for (const stmt of sourceFile.getStatements()) {
    const kind = stmt.getKind();

    if (kind === SyntaxKind.FunctionDeclaration) {
      const fn = stmt.asKindOrThrow(SyntaxKind.FunctionDeclaration);
      const name = fn.getName();
      if (!name) continue; // skip anonymous function declarations
      symbols.push({
        name,
        kind: 'function',
        isExported: fn.isExported(),
        startLine: fn.getStartLineNumber(),
        endLine: fn.getEndLineNumber(),
        node: fn,
      });
      continue;
    }

    if (kind === SyntaxKind.ClassDeclaration) {
      const cls = stmt.asKindOrThrow(SyntaxKind.ClassDeclaration);
      const name = cls.getName();
      if (!name) continue;
      symbols.push({
        name,
        kind: 'class',
        isExported: cls.isExported(),
        startLine: cls.getStartLineNumber(),
        endLine: cls.getEndLineNumber(),
        node: cls,
      });
      continue;
    }

    if (kind === SyntaxKind.TypeAliasDeclaration) {
      const alias = stmt.asKindOrThrow(SyntaxKind.TypeAliasDeclaration);
      symbols.push({
        name: alias.getName(),
        kind: 'type',
        isExported: alias.isExported(),
        startLine: alias.getStartLineNumber(),
        endLine: alias.getEndLineNumber(),
        node: alias,
      });
      continue;
    }

    if (kind === SyntaxKind.InterfaceDeclaration) {
      const iface = stmt.asKindOrThrow(SyntaxKind.InterfaceDeclaration);
      symbols.push({
        name: iface.getName(),
        kind: 'interface',
        isExported: iface.isExported(),
        startLine: iface.getStartLineNumber(),
        endLine: iface.getEndLineNumber(),
        node: iface,
      });
      continue;
    }

    if (kind === SyntaxKind.EnumDeclaration) {
      const en = stmt.asKindOrThrow(SyntaxKind.EnumDeclaration);
      symbols.push({
        name: en.getName(),
        kind: 'enum',
        isExported: en.isExported(),
        startLine: en.getStartLineNumber(),
        endLine: en.getEndLineNumber(),
        node: en,
      });
      continue;
    }

    if (kind === SyntaxKind.VariableStatement) {
      const varStmt = stmt.asKindOrThrow(SyntaxKind.VariableStatement);
      const isExported = varStmt.isExported();

      for (const decl of varStmt.getDeclarations()) {
        const isFnLike = isVariableFunctionLike(decl);
        symbols.push({
          name: decl.getName(),
          kind: syntaxKindToExportKind(SyntaxKind.VariableStatement, isFnLike),
          isExported,
          startLine: varStmt.getStartLineNumber(),
          endLine: varStmt.getEndLineNumber(),
          node: varStmt,
        });
      }
    }
  }

  return symbols;
}

// ---------------------------------------------------------------------------
// Reference analysis
// ---------------------------------------------------------------------------

/**
 * Find which other top-level symbols a given symbol references
 * by scanning all Identifier nodes within its body.
 */
function findIntraFileReferences(raw: RawSymbol, allNames: ReadonlySet<string>): string[] {
  const refs = new Set<string>();

  const identifiers = raw.node.getDescendantsOfKind(SyntaxKind.Identifier);
  for (const id of identifiers) {
    const text = id.getText();
    // Only include references to other top-level symbols (not self)
    if (text !== raw.name && allNames.has(text)) {
      refs.add(text);
    }
  }

  return [...refs];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build a dependency graph of symbols within a single file.
 *
 * Extracts all top-level symbols (functions, classes, types, interfaces,
 * enums, constants) and determines intra-file references between them.
 */
export function buildDependencyGraph(sourceFile: SourceFile): DependencyGraph {
  const rawSymbols = extractTopLevelSymbols(sourceFile);
  const allNames = new Set(rawSymbols.map((s) => s.name));

  const nodes: SymbolNode[] = [];
  const edges = new Map<string, readonly string[]>();

  for (const raw of rawSymbols) {
    const references = findIntraFileReferences(raw, allNames);

    nodes.push({
      name: raw.name,
      kind: raw.kind,
      isExported: raw.isExported,
      startLine: raw.startLine,
      endLine: raw.endLine,
      references,
    });

    edges.set(raw.name, references);
  }

  return { nodes, edges };
}

/**
 * Analyze intra-file symbol dependencies using ts-morph AST.
 *
 * Combines the dependency graph with the existing export analysis
 * from the naming-audit module.
 */
export function analyzeStructure(file: FileEntry, project: Project): FileStructure {
  // Get or add the source file to the project
  let sourceFile: SourceFile | undefined = project.getSourceFile(file.absolutePath);
  if (!sourceFile) {
    try {
      sourceFile = project.addSourceFileAtPath(file.absolutePath);
    } catch {
      // Return a minimal structure for files that cannot be parsed
      return {
        file,
        lineCount: 0,
        analysis: {
          file,
          primaryExport: null,
          exports: [],
          isReExportOnly: false,
          componentMetrics: null,
        },
        graph: { nodes: [], edges: new Map() },
        cohesionGroups: [],
      };
    }
  }

  // Build the dependency graph
  const graph = buildDependencyGraph(sourceFile);

  // Reuse existing export analysis from naming-audit
  const analysis = analyzeFile(file, project);

  // Count lines efficiently using ts-morph's built-in line tracking
  const lineCount = sourceFile.getEndLineNumber();

  return {
    file,
    lineCount,
    analysis,
    graph,
    cohesionGroups: [], // Filled by CohesionGrouper later
  };
}
