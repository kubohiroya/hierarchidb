import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { toNodeId } from '@hierarchidb/core-types';
import { getYamlDB } from '@hierarchidb/yaml-store';
import { exportYamlNodesToSnapshot } from '../src/common/shared/yamlFolderExport.js';
import { importYamlNodesFromSnapshot } from '../src/common/shared/yamlFolderImport.js';
import type { ExportableNode } from '../src/common/shared/yamlFolderExport.js';

// Reset DB between tests
beforeEach(async () => {
    const db = getYamlDB();
    await db.nodes.clear();
});

// Helper: build ExportableNode array with distinct names
const makeNodes = (items: Array<{ name: string; content: string }>): ExportableNode[] =>
    items.map((item, i) => ({
        nodeId: toNodeId(`node-${i}`),
        nodeType: 'yaml-file',
        data: { name: item.name, schemaId: 'ide-gsm/scenario', content: item.content },
    }));

// Feature: yaml-file-node, Property 9: Export-import round-trip preserves name and content
describe('Property 9: Export-import round-trip preserves name and content', () => {
    it('name and content are identical after export→import', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc
                    .array(
                        fc.record({
                            name: fc.string({ minLength: 1 }).map((s) => `${s}.yml`),
                            content: fc.string(),
                        }),
                        { minLength: 1 }
                    )
                    .filter((items) => new Set(items.map((i) => i.name)).size === items.length),
                async (items) => {
                    const db = getYamlDB();
                    await db.nodes.clear();

                    const nodes = makeNodes(items);
                    const exportResult = await exportYamlNodesToSnapshot(nodes);
                    expect(exportResult.ok).toBe(true);
                    if (!exportResult.ok) return;

                    const parentId = toNodeId('parent');
                    const importResult = await importYamlNodesFromSnapshot(exportResult.snapshot, parentId);
                    expect(importResult.ok).toBe(true);
                    if (!importResult.ok) return;

                    // Verify each imported node has matching name and content.
                    // YamlDB only indexes nodeId, so fetch all imported records by their nodeIds.
                    const importedRecords = await db.nodes.bulkGet(importResult.nodeIds);
                    for (const original of items) {
                        const record = importedRecords.find((r) => r !== undefined && r.name === original.name);
                        expect(record).toBeDefined();
                        expect(record?.content).toBe(original.content);
                    }
                }
            ),
            { numRuns: 50 }
        );
    });
});

// Feature: yaml-file-node, Property 10: Round-trip assigns new NodeIds
describe('Property 10: Round-trip assigns new NodeIds', () => {
    it('imported NodeIds differ from original NodeIds', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc
                    .array(
                        fc.record({
                            name: fc.string({ minLength: 1 }).map((s) => `${s}.yml`),
                            content: fc.string(),
                        }),
                        { minLength: 1 }
                    )
                    .filter((items) => new Set(items.map((i) => i.name)).size === items.length),
                async (items) => {
                    const db = getYamlDB();
                    await db.nodes.clear();

                    const nodes = makeNodes(items);
                    const originalIds = new Set(nodes.map((n) => n.nodeId));

                    const exportResult = await exportYamlNodesToSnapshot(nodes);
                    expect(exportResult.ok).toBe(true);
                    if (!exportResult.ok) return;

                    const parentId = toNodeId('parent');
                    const importResult = await importYamlNodesFromSnapshot(exportResult.snapshot, parentId);
                    expect(importResult.ok).toBe(true);
                    if (!importResult.ok) return;

                    // All imported nodeIds must be new
                    for (const importedId of importResult.nodeIds) {
                        expect(originalIds.has(importedId)).toBe(false);
                    }
                }
            ),
            { numRuns: 50 }
        );
    });
});

// Feature: yaml-file-node, Property 11: Duplicate name on export returns error
describe('Property 11: Duplicate name on export returns error', () => {
    it('export with duplicate names returns error and produces no ZIP', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.string({ minLength: 1 }).map((s) => `${s}.yml`),
                fc.string(),
                async (name, content) => {
                    // Force two nodes with the same name
                    const nodes: ExportableNode[] = [
                        {
                            nodeId: toNodeId('n1'),
                            nodeType: 'yaml-file',
                            data: { name, schemaId: 'ide-gsm/scenario', content },
                        },
                        {
                            nodeId: toNodeId('n2'),
                            nodeType: 'yaml-file',
                            data: { name, schemaId: 'ide-gsm/scenario', content },
                        },
                    ];
                    const result = await exportYamlNodesToSnapshot(nodes);
                    expect(result.ok).toBe(false);
                }
            ),
            { numRuns: 100 }
        );
    });
});

// Feature: yaml-file-node, Property 12: Invalid Base64 import returns error
describe('Property 12: Invalid Base64 import returns error', () => {
    it('import with invalid Base64 returns error and creates no nodes', async () => {
        // Use strings that are definitely not valid Base64 ZIP data
        const invalidSnapshots = ['not-base64!!!', '####', 'hello world', ''];

        for (const snapshot of invalidSnapshots) {
            const db = getYamlDB();
            await db.nodes.clear();

            const result = await importYamlNodesFromSnapshot(snapshot, toNodeId('parent'));
            expect(result.ok).toBe(false);

            const count = await db.nodes.count();
            expect(count).toBe(0);
        }
    });
});
