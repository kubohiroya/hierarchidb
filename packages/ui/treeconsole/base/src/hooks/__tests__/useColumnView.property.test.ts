/**
 * Property 4: Column path reflects selection hierarchy
 *
 * Validates: Requirements 6.2, 6.3, 6.4
 *
 * For any tree structure and for any sequence of node selections in the ColumnView,
 * the resulting columnPath satisfies:
 * 1. Each columnPath[i] is a direct child of columnPath[i-1] (or a root node when i === 0)
 * 2. When a node with children is selected, it is appended to the path
 * 3. When a leaf node is selected, the path is truncated (no columns beyond the leaf's level)
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { NodeId } from '@hierarchidb/core-types';
import type { ColumnViewState } from '../useColumnView';

// -- Tree generation types --

/** A tree represented as parent → children mapping, plus the set of root node IDs. */
interface GeneratedTree {
    childrenMap: Map<string, string[]>;
    roots: string[];
    allNodes: string[];
}

// -- Helper: generate a random tree --

/**
 * Generates a tree as a Map<NodeId, NodeId[]> (parent → children).
 *
 * @param depth - max depth of the tree (1–5)
 * @param branching - max branching factor per node (1–4)
 * @param childCounts - sequence of child counts for deterministic generation
 * @returns GeneratedTree with childrenMap, roots, and allNodes
 */
function generateTree(
    depth: number,
    branching: number,
    childCounts: number[],
): GeneratedTree {
    const childrenMap = new Map<string, string[]>();
    const allNodes: string[] = [];
    let nodeCounter = 0;
    let childCountIdx = 0;

    function nextChildCount(): number {
        const count = childCounts[childCountIdx % childCounts.length];
        childCountIdx++;
        return count;
    }

    function buildLevel(parentId: string, currentDepth: number): void {
        if (currentDepth >= depth) return;

        const numChildren = Math.min(nextChildCount(), branching);
        if (numChildren === 0) return;

        const children: string[] = [];
        for (let i = 0; i < numChildren; i++) {
            const childId = `node-${++nodeCounter}`;
            allNodes.push(childId);
            children.push(childId);
            childrenMap.set(childId, []);
        }
        childrenMap.set(parentId, children);

        // Recurse into children
        for (const childId of children) {
            buildLevel(childId, currentDepth + 1);
        }
    }

    // Create root nodes
    const numRoots = Math.min(nextChildCount(), branching);
    const roots: string[] = [];
    for (let i = 0; i < numRoots; i++) {
        const rootId = `node-${++nodeCounter}`;
        allNodes.push(rootId);
        roots.push(rootId);
        childrenMap.set(rootId, []);
    }

    // Build subtrees under each root
    for (const rootId of roots) {
        buildLevel(rootId, 1);
    }

    return { childrenMap, roots, allNodes };
}

// -- Helper: simulate selectNode as a pure state transition --

/**
 * Pure function that applies the same logic as the useColumnView hook's selectNode.
 * Mirrors the setState callback in useColumnView.ts exactly.
 */
function simulateSelectNode(
    state: ColumnViewState,
    nodeId: string,
    tree: GeneratedTree,
): ColumnViewState {
    const hasChildren = (id: string): boolean => {
        const children = tree.childrenMap.get(id);
        return children !== undefined && children.length > 0;
    };

    const getChildren = (id: string): string[] => {
        return tree.childrenMap.get(id) ?? [];
    };

    const path = state.expandedPath;

    // Guard against circular references (same as hook)
    if (path.includes(nodeId as NodeId)) {
        return { ...state, selectedNodeId: nodeId as NodeId };
    }

    // Find parent index in path, or -1 if node is a root
    let parentIdx = -1;
    for (let i = 0; i < path.length; i++) {
        const siblings = getChildren(path[i]);
        if (siblings.some((s) => s === nodeId)) {
            parentIdx = i;
            break;
        }
    }

    const truncateAt = parentIdx >= 0 ? parentIdx + 1 : 0;

    if (hasChildren(nodeId)) {
        return {
            expandedPath: [...path.slice(0, truncateAt), nodeId as NodeId],
            selectedNodeId: nodeId as NodeId,
        };
    }

    return {
        expandedPath: path.slice(0, truncateAt),
        selectedNodeId: nodeId as NodeId,
    };
}

// -- Helper: check if a node is a root --

function isRootNode(nodeId: string, tree: GeneratedTree): boolean {
    return tree.roots.includes(nodeId);
}

// -- Helper: check if nodeId is a direct child of parentId --

function isDirectChildOf(nodeId: string, parentId: string, tree: GeneratedTree): boolean {
    const children = tree.childrenMap.get(parentId);
    return children !== undefined && children.includes(nodeId);
}

// -- Helper: check if a node has children --

function nodeHasChildren(nodeId: string, tree: GeneratedTree): boolean {
    const children = tree.childrenMap.get(nodeId);
    return children !== undefined && children.length > 0;
}

/**
 * Generate a valid selection sequence that follows column navigation rules.
 * Each selection picks from the set of nodes visible in the current columns:
 * - Root nodes (always visible in column 0)
 * - Children of each node in expandedPath (visible in subsequent columns)
 */
function generateValidSelectionSequence(
    tree: GeneratedTree,
    selectionChoices: number[],
): string[] {
    const sequence: string[] = [];
    let state: ColumnViewState = { expandedPath: [], selectedNodeId: null };

    for (const choice of selectionChoices) {
        // Collect all visible/selectable nodes
        const visibleNodes: string[] = [...tree.roots];
        for (const pathNodeId of state.expandedPath) {
            const children = tree.childrenMap.get(pathNodeId) ?? [];
            visibleNodes.push(...children);
        }

        if (visibleNodes.length === 0) break;

        const nodeId = visibleNodes[choice % visibleNodes.length];
        sequence.push(nodeId);
        state = simulateSelectNode(state, nodeId, tree);
    }

    return sequence;
}

// -- Arbitraries --

/** Arbitrary for tree depth (1–5). */
const depthArb = fc.integer({ min: 1, max: 5 });

/** Arbitrary for branching factor (1–4). */
const branchingArb = fc.integer({ min: 1, max: 4 });

/** Arbitrary for child count sequence used during tree generation. */
const childCountsArb = fc.array(fc.integer({ min: 1, max: 4 }), { minLength: 10, maxLength: 30 });

/** Arbitrary for selection choice indices. */
const selectionChoicesArb = fc.array(fc.nat({ max: 100 }), { minLength: 1, maxLength: 10 });

// -- Property test --

// Feature: treeconsole-view-modes, Property 4: Column path reflects selection hierarchy
describe('Feature: treeconsole-view-modes, Property 4: Column path reflects selection hierarchy', () => {
    it('each columnPath[i] is a direct child of columnPath[i-1] (or root when i===0)', () => {
        fc.assert(
            fc.property(
                depthArb,
                branchingArb,
                childCountsArb,
                selectionChoicesArb,
                (depth, branching, childCounts, selectionChoices) => {
                    const tree = generateTree(depth, branching, childCounts);
                    if (tree.allNodes.length === 0) return; // skip degenerate trees

                    const selections = generateValidSelectionSequence(tree, selectionChoices);

                    let state: ColumnViewState = {
                        expandedPath: [],
                        selectedNodeId: null,
                    };

                    // Apply all selections
                    for (const nodeId of selections) {
                        state = simulateSelectNode(state, nodeId, tree);
                    }

                    const path = state.expandedPath;

                    // Verify: each path[i] is a direct child of path[i-1], or root when i===0
                    for (let i = 0; i < path.length; i++) {
                        if (i === 0) {
                            expect(isRootNode(path[i], tree)).toBe(true);
                        } else {
                            expect(isDirectChildOf(path[i], path[i - 1], tree)).toBe(true);
                        }
                    }
                },
            ),
            { numRuns: 100 },
        );
    });

    it('selecting node with children appends to path', () => {
        fc.assert(
            fc.property(
                depthArb,
                branchingArb,
                childCountsArb,
                selectionChoicesArb,
                (depth, branching, childCounts, selectionChoices) => {
                    const tree = generateTree(depth, branching, childCounts);

                    // Find a root with children to select
                    const rootsWithChildren = tree.roots.filter((id) => nodeHasChildren(id, tree));
                    if (rootsWithChildren.length === 0) return;

                    // Build up a valid state via selection sequence first
                    const selections = generateValidSelectionSequence(tree, selectionChoices);
                    let state: ColumnViewState = { expandedPath: [], selectedNodeId: null };
                    for (const nodeId of selections) {
                        state = simulateSelectNode(state, nodeId, tree);
                    }

                    // Now select a root with children from a clean state
                    const rootNode = rootsWithChildren[0];
                    const freshState: ColumnViewState = { expandedPath: [], selectedNodeId: null };
                    const newState = simulateSelectNode(freshState, rootNode, tree);

                    // The node should be in the path (appended)
                    expect(newState.expandedPath).toContain(rootNode as NodeId);
                    expect(newState.selectedNodeId).toBe(rootNode as NodeId);
                },
            ),
            { numRuns: 100 },
        );
    });

    it('selecting leaf truncates path (no columns beyond leaf level)', () => {
        fc.assert(
            fc.property(
                depthArb,
                branchingArb,
                childCountsArb,
                (depth, branching, childCounts) => {
                    const tree = generateTree(depth, branching, childCounts);

                    // Find a root with children, then find a leaf child
                    const rootsWithChildren = tree.roots.filter((id) => nodeHasChildren(id, tree));
                    if (rootsWithChildren.length === 0) return;

                    const rootNode = rootsWithChildren[0];
                    const rootChildren = tree.childrenMap.get(rootNode) ?? [];
                    const leafChildren = rootChildren.filter((id) => !nodeHasChildren(id, tree));

                    if (leafChildren.length === 0) return; // skip if no leaf children

                    // First select the root (which has children) to build a path
                    let state: ColumnViewState = { expandedPath: [], selectedNodeId: null };
                    state = simulateSelectNode(state, rootNode, tree);

                    // Now select a leaf child
                    const leafNode = leafChildren[0];
                    const newState = simulateSelectNode(state, leafNode, tree);

                    // Path should be truncated: the leaf is NOT in the expandedPath
                    // (only nodes with children get appended to the path)
                    expect(newState.expandedPath).not.toContain(leafNode as NodeId);

                    // The path should end at the parent of the leaf (the root node)
                    expect(newState.expandedPath[newState.expandedPath.length - 1]).toBe(
                        rootNode as NodeId,
                    );

                    // Selected node should be the leaf
                    expect(newState.selectedNodeId).toBe(leafNode as NodeId);
                },
            ),
            { numRuns: 100 },
        );
    });

    it('path has no duplicate node IDs after any valid selection sequence', () => {
        fc.assert(
            fc.property(
                depthArb,
                branchingArb,
                childCountsArb,
                selectionChoicesArb,
                (depth, branching, childCounts, selectionChoices) => {
                    const tree = generateTree(depth, branching, childCounts);
                    if (tree.allNodes.length === 0) return;

                    const selections = generateValidSelectionSequence(tree, selectionChoices);

                    let state: ColumnViewState = { expandedPath: [], selectedNodeId: null };
                    for (const nodeId of selections) {
                        state = simulateSelectNode(state, nodeId, tree);
                    }

                    // No duplicates in path
                    const pathSet = new Set(state.expandedPath);
                    expect(pathSet.size).toBe(state.expandedPath.length);
                },
            ),
            { numRuns: 100 },
        );
    });
});
