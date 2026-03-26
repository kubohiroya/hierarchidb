import type { NodeId } from '@hierarchidb/core-types';
import type { YamlFileNodeData } from '@hierarchidb/yaml-api';
import { getYamlDB } from './YamlDB.js';

export type YamlNodeResult<T> =
    | { ok: true; value: T }
    | { ok: false; error: string };

export async function createYamlNode(
    nodeId: NodeId,
    data: YamlFileNodeData
): Promise<YamlNodeResult<NodeId>> {
    const db = getYamlDB();
    const existing = await db.nodes.get(nodeId);
    if (existing !== undefined) {
        return { ok: false, error: `Node already exists: ${nodeId}` };
    }
    await db.nodes.add({ ...data, nodeId });
    return { ok: true, value: nodeId };
}

export async function updateYamlNode(
    nodeId: NodeId,
    patch: Partial<YamlFileNodeData>
): Promise<YamlNodeResult<void>> {
    const db = getYamlDB();
    const existing = await db.nodes.get(nodeId);
    if (existing === undefined) {
        return { ok: false, error: `Node not found: ${nodeId}` };
    }
    await db.nodes.update(nodeId, patch);
    return { ok: true, value: undefined };
}

export async function deleteYamlNode(
    nodeId: NodeId
): Promise<YamlNodeResult<void>> {
    const db = getYamlDB();
    const existing = await db.nodes.get(nodeId);
    if (existing === undefined) {
        return { ok: false, error: `Node not found: ${nodeId}` };
    }
    await db.nodes.delete(nodeId);
    return { ok: true, value: undefined };
}
