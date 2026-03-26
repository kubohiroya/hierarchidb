import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { toNodeId } from '@hierarchidb/core-types';
import { createYamlNode, updateYamlNode, deleteYamlNode } from '../src/yamlNodeOperations.js';
import { getYamlDB } from '../src/YamlDB.js';

// Reset the singleton DB between tests to avoid cross-test contamination
beforeEach(async () => {
    const db = getYamlDB();
    await db.nodes.clear();
});

// Feature: yaml-file-node, Property 3: CRUD lifecycle consistency
describe('Property 3: CRUD lifecycle consistency', () => {
    it('create → verify → update → verify → delete → verify gone', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    name: fc.string({ minLength: 1 }),
                    schemaId: fc.string({ minLength: 1 }),
                    content: fc.string(),
                }),
                fc.string({ minLength: 1 }),
                async (data, rawId) => {
                    const nodeId = toNodeId(rawId);
                    const db = getYamlDB();

                    // Ensure clean state for this iteration
                    await db.nodes.delete(nodeId);

                    // 1. create succeeds
                    const createResult = await createYamlNode(nodeId, data);
                    expect(createResult.ok).toBe(true);

                    // 2. verify exists with original values
                    const afterCreate = await db.nodes.get(nodeId);
                    expect(afterCreate).toBeDefined();
                    expect(afterCreate?.name).toBe(data.name);
                    expect(afterCreate?.schemaId).toBe(data.schemaId);
                    expect(afterCreate?.content).toBe(data.content);

                    // 3. update succeeds
                    const updatedName = `${data.name}-updated`;
                    const updateResult = await updateYamlNode(nodeId, { name: updatedName });
                    expect(updateResult.ok).toBe(true);

                    // 4. verify updated values
                    const afterUpdate = await db.nodes.get(nodeId);
                    expect(afterUpdate?.name).toBe(updatedName);

                    // 5. delete succeeds
                    const deleteResult = await deleteYamlNode(nodeId);
                    expect(deleteResult.ok).toBe(true);

                    // 6. verify gone
                    const afterDelete = await db.nodes.get(nodeId);
                    expect(afterDelete).toBeUndefined();
                }
            ),
            { numRuns: 100 }
        );
    });
});

// Feature: yaml-file-node, Property 4: Duplicate nodeId rejects create
describe('Property 4: Duplicate nodeId rejects create', () => {
    it('creating with a duplicate nodeId returns an error result', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.string({ minLength: 1 }),
                fc.record({
                    name: fc.string({ minLength: 1 }),
                    schemaId: fc.string({ minLength: 1 }),
                    content: fc.string(),
                }),
                async (rawId, data) => {
                    const nodeId = toNodeId(rawId);
                    const db = getYamlDB();

                    // Ensure clean state for this iteration
                    await db.nodes.delete(nodeId);

                    // First create succeeds
                    const first = await createYamlNode(nodeId, data);
                    expect(first.ok).toBe(true);

                    // Second create with same nodeId returns error
                    const second = await createYamlNode(nodeId, data);
                    expect(second.ok).toBe(false);
                    if (!second.ok) {
                        expect(typeof second.error).toBe('string');
                    }

                    // Cleanup
                    await db.nodes.delete(nodeId);
                }
            ),
            { numRuns: 100 }
        );
    });
});

// Feature: yaml-file-node, Property 5: Non-existent node rejects update and delete
describe('Property 5: Non-existent node rejects update and delete', () => {
    it('update and delete on a never-created nodeId both return error', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.string({ minLength: 1 }),
                async (rawId) => {
                    const nodeId = toNodeId(rawId);
                    const db = getYamlDB();

                    // Ensure the node does not exist
                    await db.nodes.delete(nodeId);

                    const updateResult = await updateYamlNode(nodeId, { name: 'x' });
                    expect(updateResult.ok).toBe(false);

                    const deleteResult = await deleteYamlNode(nodeId);
                    expect(deleteResult.ok).toBe(false);
                }
            ),
            { numRuns: 100 }
        );
    });
});
