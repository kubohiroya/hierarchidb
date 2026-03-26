/**
 * yamlFolderExport - collects YamlFileNode entries from a folder tree and
 * assembles them into a Base64-encoded ZIP (ProjectSnapshot).
 */
import JSZip from 'jszip';
import type { NodeId } from '@hierarchidb/core-types';
import { YAML_NODE_TYPE } from '@hierarchidb/yaml-api';
import type { YamlFileNodeData } from '@hierarchidb/yaml-api';

/** A minimal tree node shape sufficient for export traversal. */
export interface ExportableNode {
    nodeId: NodeId;
    nodeType: string;
    data: YamlFileNodeData;
}

export type YamlExportResult =
    | { ok: true; snapshot: string }
    | { ok: false; error: string };

/**
 * Collect all YamlFileNode entries from the provided node list,
 * assemble a ZIP, and return a Base64-encoded ProjectSnapshot.
 *
 * Rules:
 * - Duplicate `name` values → error before any ZIP assembly
 * - Empty node list → valid empty ZIP
 */
export async function exportYamlNodesToSnapshot(
    nodes: readonly ExportableNode[]
): Promise<YamlExportResult> {
    const yamlNodes = nodes.filter((n) => n.nodeType === YAML_NODE_TYPE);

    // Check for duplicate names before assembling ZIP
    const names = yamlNodes.map((n) => n.data.name);
    const nameSet = new Set<string>();
    for (const name of names) {
        if (nameSet.has(name)) {
            return { ok: false, error: `Duplicate YamlFileNode name: "${name}"` };
        }
        nameSet.add(name);
    }

    const zip = new JSZip();
    for (const node of yamlNodes) {
        zip.file(node.data.name, node.data.content, { binary: false });
    }

    const zipBuffer = await zip.generateAsync({ type: 'base64' });
    return { ok: true, snapshot: zipBuffer };
}
