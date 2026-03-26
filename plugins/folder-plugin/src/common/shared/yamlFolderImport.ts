/**
 * yamlFolderImport - restores YamlFileNode entries from a Base64-encoded
 * ProjectSnapshot ZIP into a target folder.
 */
import JSZip from 'jszip';
import type { NodeId } from '@hierarchidb/core-types';
import { toNodeId } from '@hierarchidb/core-types';
import { createYamlNode } from '@hierarchidb/yaml-store';
import { generateId } from '@hierarchidb/util';

export type YamlImportResult =
    | { ok: true; nodeIds: NodeId[] }
    | { ok: false; error: string };

/**
 * Decode a Base64 ProjectSnapshot, extract .yml/.yaml entries,
 * and create YamlFileNode records under the given parentId.
 *
 * Rules:
 * - Invalid Base64 → error, no nodes created
 * - Malformed ZIP → error, no nodes created
 * - Non-UTF-8 entry content → error, entire import aborted (no partial writes)
 * - Only entries ending in .yml or .yaml are processed
 */
export async function importYamlNodesFromSnapshot(
    snapshot: string,
    parentId: NodeId
    // Validate Base64 — atob throws on invalid input
    let zipData: string;
    try {
        zipData = atob(snapshot);
    } catch {
        return { ok: false, error: 'Invalid Base64: cannot decode ProjectSnapshot' };
    }

    // Load ZIP
    let zip: JSZip;
    try {
        zip = await JSZip.loadAsync(zipData, { base64: false });
    } catch {
        return { ok: false, error: 'Malformed ZIP: cannot parse ProjectSnapshot' };
    }

    // Collect .yml / .yaml entries
    const entries: Array<{ name: string; file: JSZip.JSZipObject }> = [];
    zip.forEach((relativePath, file) => {
        if (!file.dir && (relativePath.endsWith('.yml') || relativePath.endsWith('.yaml'))) {
            entries.push({ name: relativePath, file });
        }
    });

    // Decode all entries first (abort on non-UTF-8 before any writes)
    const decoded: Array<{ name: string; content: string }> = [];
    for (const entry of entries) {
        let content: string;
        try {
            content = await entry.file.async('string');
        } catch {
            return {
                ok: false,
                error: `Non-UTF-8 content in ZIP entry "${entry.name}": import aborted`,
            };
        }
        decoded.push({ name: entry.name, content });
    }

    // Write all nodes
    const nodeIds: NodeId[] = [];
    for (const { name, content } of decoded) {
        const nodeId = toNodeId(generateId());
        const result = await createYamlNode(nodeId, {
            name,
            schemaId: '',
            content,
        });
        if (!result.ok) {
            return { ok: false, error: `Failed to create node for "${name}": ${result.error}` };
        }
        nodeIds.push(nodeId);
    }

    return { ok: true, nodeIds };
}
