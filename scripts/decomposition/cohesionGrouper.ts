// ============================================================
// CohesionGrouper -- groups symbols into cohesion groups using
// Tarjan's SCC algorithm and detects inter-group cycles.
//
// Provides:
//   groupByCohesion(graph)          – SCC-based cohesion grouping
//   detectInterGroupCycles(groups, graph) – inter-group cycle detection
// ============================================================

import type {
    CohesionGroup,
    CycleWarning,
    DependencyGraph,
    GroupRole,
    SymbolNode,
} from './types.js';

// ---------------------------------------------------------------------------
// Tarjan's SCC algorithm
// ---------------------------------------------------------------------------

interface TarjanState {
    index: number;
    readonly stack: string[];
    readonly onStack: Set<string>;
    readonly indices: Map<string, number>;
    readonly lowlinks: Map<string, number>;
    readonly result: string[][];
}

/**
 * Run Tarjan's SCC algorithm on the dependency graph.
 * Returns an array of strongly connected components, where each SCC
 * is an array of symbol names.
 */
function tarjanSCC(graph: DependencyGraph): string[][] {
    const state: TarjanState = {
        index: 0,
        stack: [],
        onStack: new Set(),
        indices: new Map(),
        lowlinks: new Map(),
        result: [],
    };

    for (const node of graph.nodes) {
        if (!state.indices.has(node.name)) {
            strongconnect(node.name, graph, state);
        }
    }

    return state.result;
}

function strongconnect(
    v: string,
    graph: DependencyGraph,
    state: TarjanState,
): void {
    state.indices.set(v, state.index);
    state.lowlinks.set(v, state.index);
    state.index++;
    state.stack.push(v);
    state.onStack.add(v);

    // Visit successors
    const successors = graph.edges.get(v) ?? [];
    for (const w of successors) {
        // Only consider edges to nodes that exist in the graph
        if (!graph.nodes.some((n) => n.name === w)) {
            continue;
        }

        if (!state.indices.has(w)) {
            // w has not been visited; recurse
            strongconnect(w, graph, state);
            const vLow = state.lowlinks.get(v) ?? 0;
            const wLow = state.lowlinks.get(w) ?? 0;
            state.lowlinks.set(v, Math.min(vLow, wLow));
        } else if (state.onStack.has(w)) {
            // w is on the stack → part of current SCC
            const vLow = state.lowlinks.get(v) ?? 0;
            const wIdx = state.indices.get(w) ?? 0;
            state.lowlinks.set(v, Math.min(vLow, wIdx));
        }
    }

    // If v is a root node, pop the SCC
    if (state.lowlinks.get(v) === state.indices.get(v)) {
        const scc: string[] = [];
        let w: string | undefined;
        do {
            w = state.stack.pop();
            if (w === undefined) break;
            state.onStack.delete(w);
            scc.push(w);
        } while (w !== v);
        state.result.push(scc);
    }
}

// ---------------------------------------------------------------------------
// Role inference
// ---------------------------------------------------------------------------

/** Regex for UPPER_SNAKE_CASE names (e.g. MAX_SIZE, DEFAULT_VALUE). */
const UPPER_SNAKE_RE = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/;

/** Regex for hook names: 'use' followed by an uppercase letter. */
const HOOK_NAME_RE = /^use[A-Z]/;

/** Regex for state hook names: 'use' + anything + 'State'. */
const STATE_HOOK_RE = /^use\w+State$/;

/** Regex for PascalCase names (likely React components). */
const PASCAL_CASE_RE = /^[A-Z][a-zA-Z0-9]*$/;

/**
 * Infer the GroupRole for a set of symbols based on naming conventions
 * and symbol kinds.
 */
function inferGroupRole(symbols: readonly SymbolNode[]): GroupRole {
    if (symbols.length === 0) return 'other';

    // If ALL symbols are type or interface → 'types'
    if (symbols.every((s) => s.kind === 'type' || s.kind === 'interface')) {
        return 'types';
    }

    // If the group has a symbol named use*State → 'stateHook'
    if (symbols.some((s) => STATE_HOOK_RE.test(s.name))) {
        return 'stateHook';
    }

    // If ALL symbols have names starting with 'use' + uppercase → 'hook'
    if (symbols.every((s) => HOOK_NAME_RE.test(s.name))) {
        return 'hook';
    }

    // If ALL symbols are const with UPPER_SNAKE_CASE names → 'constants'
    if (
        symbols.every(
            (s) => s.kind === 'const' && UPPER_SNAKE_RE.test(s.name),
        )
    ) {
        return 'constants';
    }

    // If ALL symbols are non-exported pure functions → 'utils'
    if (
        symbols.every(
            (s) => !s.isExported && (s.kind === 'function' || s.kind === 'local'),
        )
    ) {
        return 'utils';
    }

    // If any symbol name ends with 'View' → 'view'
    if (symbols.some((s) => s.name.endsWith('View'))) {
        return 'view';
    }

    // If any symbol matches PascalCase and kind is 'function' → 'component'
    if (
        symbols.some(
            (s) => s.kind === 'function' && PASCAL_CASE_RE.test(s.name),
        )
    ) {
        return 'component';
    }

    return 'other';
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Group symbols into cohesion groups based on dependency strength.
 *
 * Uses Tarjan's SCC algorithm to find strongly connected components.
 * Each SCC becomes a CohesionGroup. Symbols not in any cycle form
 * singleton groups.
 */
export function groupByCohesion(graph: DependencyGraph): CohesionGroup[] {
    const sccs = tarjanSCC(graph);

    // Build a lookup from symbol name to SymbolNode
    const nodeMap = new Map<string, SymbolNode>();
    for (const node of graph.nodes) {
        nodeMap.set(node.name, node);
    }

    const groups: CohesionGroup[] = [];

    for (let i = 0; i < sccs.length; i++) {
        const scc = sccs[i];
        const symbols: SymbolNode[] = [];

        for (const name of scc) {
            const node = nodeMap.get(name);
            if (node) {
                symbols.push(node);
            }
        }

        if (symbols.length === 0) continue;

        const lineCount = symbols.reduce(
            (sum, s) => sum + (s.endLine - s.startLine + 1),
            0,
        );

        groups.push({
            id: `group-${i}`,
            symbols,
            lineCount,
            suggestedRole: inferGroupRole(symbols),
        });
    }

    return groups;
}

/**
 * Detect inter-group circular references.
 *
 * Builds a group-level directed graph from symbol references and
 * uses DFS to find cycles among groups.
 */
export function detectInterGroupCycles(
    groups: readonly CohesionGroup[],
    graph: DependencyGraph,
): CycleWarning[] {
    if (groups.length === 0) return [];

    // Build symbol → groupId lookup
    const symbolToGroup = new Map<string, string>();
    for (const group of groups) {
        for (const sym of group.symbols) {
            symbolToGroup.set(sym.name, group.id);
        }
    }

    // Build group-level adjacency list and track involved symbols
    const groupEdges = new Map<string, Set<string>>();
    const edgeSymbols = new Map<string, Set<string>>(); // "fromGroup->toGroup" → symbol names

    for (const group of groups) {
        groupEdges.set(group.id, new Set());
    }

    for (const node of graph.nodes) {
        const fromGroup = symbolToGroup.get(node.name);
        if (fromGroup === undefined) continue;

        const refs = graph.edges.get(node.name) ?? [];
        for (const ref of refs) {
            const toGroup = symbolToGroup.get(ref);
            if (toGroup === undefined || toGroup === fromGroup) continue;

            const fromEdges = groupEdges.get(fromGroup);
            if (fromEdges) {
                fromEdges.add(toGroup);
            }

            const edgeKey = `${fromGroup}->${toGroup}`;
            let syms = edgeSymbols.get(edgeKey);
            if (!syms) {
                syms = new Set();
                edgeSymbols.set(edgeKey, syms);
            }
            syms.add(node.name);
            syms.add(ref);
        }
    }

    // DFS-based cycle detection on the group graph
    const warnings: CycleWarning[] = [];
    const visited = new Set<string>();
    const inStack = new Set<string>();
    const path: string[] = [];

    function dfs(groupId: string): void {
        visited.add(groupId);
        inStack.add(groupId);
        path.push(groupId);

        const neighbors = groupEdges.get(groupId) ?? new Set<string>();
        for (const neighbor of neighbors) {
            if (inStack.has(neighbor)) {
                // Found a cycle: extract the cycle from path
                const cycleStart = path.indexOf(neighbor);
                const cycleIds = path.slice(cycleStart);

                // Collect involved symbols for this cycle
                const involved = new Set<string>();
                for (let i = 0; i < cycleIds.length; i++) {
                    const from = cycleIds[i];
                    const to = cycleIds[(i + 1) % cycleIds.length];
                    const key = `${from}->${to}`;
                    const syms = edgeSymbols.get(key);
                    if (syms) {
                        for (const s of syms) {
                            involved.add(s);
                        }
                    }
                }

                warnings.push({
                    groupIds: cycleIds,
                    involvedSymbols: [...involved],
                    message: `Circular dependency detected among groups: ${cycleIds.join(' → ')} → ${neighbor}`,
                });
            } else if (!visited.has(neighbor)) {
                dfs(neighbor);
            }
        }

        path.pop();
        inStack.delete(groupId);
    }

    for (const group of groups) {
        if (!visited.has(group.id)) {
            dfs(group.id);
        }
    }

    return warnings;
}
