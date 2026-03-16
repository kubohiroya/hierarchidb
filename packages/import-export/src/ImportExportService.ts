import { zipSync, strToU8 } from 'fflate';
import type { NodeId, NodeType, PeerEntity } from '@hierarchidb/core-types';
import type { TreeNode, TreeNodeMetadata } from '@hierarchidb/tree-api';
import type {
  ExportNodesParams,
  ExportResult,
  ImportData,
  ImportExportAPI,
  ImportNodesParams,
  ImportResult,
  OperationStatus,
  ValidateImportParams,
  ImportValidationIssue,
  ImportValidationResult,
} from '@hierarchidb/import-export-api';
import { SingletonMixin, generateUUID } from '@hierarchidb/util';
import type { ImportExportDBPort, VectorTileRecord } from './ports.js';

type ImportNodeInput<T> = ImportData<T>['nodes'][number];
type ValidationIssue = ImportValidationIssue;
type ExportFormat = ExportNodesParams['format'];
type VectorTileZipMetadata = {
  exportDate: string;
  nodeCount: number;
  tileCount: number;
  format: ExportFormat;
  includeMetadata: boolean;
  totalBytes: number;
  nodeIds: NodeId[];
};

export class ImportExportService<T> implements ImportExportAPI<T> {
  private operations = new Map<string, OperationStatus>();
  private abortControllers = new Map<string, AbortController>();

  static async getSingleton<T>(db: ImportExportDBPort): Promise<ImportExportService<T>> {
    return SingletonMixin.getSingleton('ImportExportService', () => new ImportExportService(db));
  }

  constructor(private db: ImportExportDBPort) {
  }

  async importNodes(params: ImportNodesParams<T>): Promise<ImportResult> {
    const operationId = this.generateOperationId();
    const abortController = new AbortController();
    this.abortControllers.set(operationId, abortController);

    const operation: OperationStatus = {
      operationId,
      type: 'import',
      status: 'running',
      startedAt: Date.now(),
    };
    this.operations.set(operationId, operation);

    try {
      if (params.validateFirst) {
        const validation = await this.validateImportData({
          data: params.data,
          format: params.format,
          treeId: params.treeId,
          targetParentId: params.targetParentId,
        });
        if (!validation.valid) throw new Error('Validation failed');
      }

      const importedNodeIds: NodeId[] = [];
      const errors: string[] = [];
      let skippedCount = 0;

      const nodes = params.data.nodes ?? [];
      const total = nodes.length;
      const nameCache = new Map<NodeId | null, Set<string>>();

      const getNameCacheForParent = async (parentId: NodeId | null): Promise<Set<string>> => {
        if (nameCache.has(parentId)) {
          return nameCache.get(parentId)!;
        }
        if (!parentId) {
          const cache = new Set<string>();
          nameCache.set(parentId, cache);
          return cache;
        }
        const existingNames = await this.db.listChildren(parentId);
        const cache = new Set(
          existingNames
            .map((child) => child.metadata?.name ?? '')
            .filter((n): n is string => Boolean(n))
        );
        nameCache.set(parentId, cache);
        return cache;
      };

      const resolveConflictingName = async (parentId: NodeId, name: string): Promise<string> => {
        if (params.conflictResolution !== 'rename') {
          return name;
        }
        const cache = await getNameCacheForParent(parentId);
        const unique = createUniqueName(cache, name);
        cache.add(unique);
        return unique;
      };
      const depthCache = new Map<NodeId, number>();
      const resolveParentDepth = async (parentId: NodeId | null | undefined): Promise<number> => {
        if (!parentId) return -1;
        if (depthCache.has(parentId)) return depthCache.get(parentId)!;
        const parentNode = await this.db.getNode(parentId);
        const depth = parentNode?.depth ?? 0;
        depthCache.set(parentId, depth);
        return depth;
      };

      const toCreate: { node: TreeNode; children?: ImportNodeInput<T>[] }[] = [];
      for (let i = 0; i < nodes.length; i++) {
        if (abortController.signal.aborted) throw new Error('Import operation cancelled');
        const nodeData = nodes[i] as ImportNodeInput<T> | undefined;
        if (!nodeData) continue;
        try {
          if (params.conflictResolution === 'skip') {
            const existingNode = await this.findNodeByName(params.targetParentId, nodeData.name);
            if (existingNode) {
              skippedCount++;
              continue;
            }
          }
          const nodeId = generateUUID() as NodeId;
          const parentDepth = await resolveParentDepth(params.targetParentId);
          const parentId: NodeId = (params.targetParentId ?? (nodeData as { parentNodeId?: NodeId })?.parentNodeId ?? nodeId) as NodeId;
          const metaObj =
            (nodeData.metadata && typeof nodeData.metadata === 'object'
              ? (nodeData.metadata as Record<string, unknown>)
              : {}) as Record<string, unknown>;
          const sourceName =
            (typeof (nodeData as { name?: unknown }).name === 'string'
              ? (nodeData as { name?: string }).name
              : (metaObj as { name?: string }).name) ?? '';
          const sourceDescription =
            (typeof (nodeData as { description?: unknown }).description === 'string'
              ? (nodeData as { description?: string }).description
              : (metaObj as { description?: string }).description) ?? '';
          const sourceTags = Array.isArray((nodeData as { tags?: unknown }).tags)
            ? ((nodeData as { tags?: unknown[] }).tags || []).filter((t): t is string => typeof t === 'string')
            : Array.isArray((metaObj as { tags?: unknown }).tags)
              ? (((metaObj as { tags?: unknown[] }).tags || []).filter((t): t is string => typeof t === 'string'))
              : [];

          const uniqueName = await resolveConflictingName(parentId, sourceName);
          const metadata: TreeNodeMetadata = {
            name: uniqueName,
            description: sourceDescription,
            tags: sourceTags,
          };
          const draftDataFromTemplate =
            (nodeData as { draftData?: Partial<PeerEntity<T>> }).draftData;

          const node: TreeNode = {
            id: nodeId,
            parentId,
            nodeType: (nodeData.nodeType || 'folder') as NodeType,
            depth: Math.max(0, parentDepth + 1),
            createdAt: Date.now(),
            updatedAt: Date.now(),
            version: (nodeData as { version?: number }).version ?? 1,
            metadata,
            draftMetadata:
              ((nodeData as { draftMetadata?: TreeNodeMetadata | null }).draftMetadata as TreeNodeMetadata | null | undefined) ??
              null,
            data:
              ((nodeData as { data?: Record<string, unknown> | null }).data as Record<string, unknown> | null | undefined) ??
              null,
            draftData: draftDataFromTemplate,
            visible: true,
          };
          toCreate.push({ node, children: nodeData.children });
          if (!nameCache.has(node.id)) {
            nameCache.set(node.id, new Set());
          }
        } catch (error) {
          errors.push(`Failed to prepare node "${nodeData?.name}": ${error}`);
        }
      }

      const size = 100; // conservative build size; callers can chunk earlier if needed
      for (let i = 0; i < toCreate.length; i += size) {
        const batch = toCreate.slice(i, i + size);
        await this.db.bulkCreateNodes(batch.map((b) => b.node));
        importedNodeIds.push(...batch.map((b) => b.node.id));
        const processed = Math.min(i + size, total);
        params.onProgress?.({
          phase: 'importing',
          current: processed,
          total,
          percentage: (processed / total) * 100,
          message: `Imported ${processed} of ${total}`,
        });
      }

      for (const entry of toCreate) {
        if (entry.children && entry.children.length > 0) {
          const childResult = await this.importNodes({
            ...params,
            targetParentId: entry.node.id,
            data: { ...params.data, nodes: entry.children },
            validateFirst: false,
          });
          // Aggregate child results into the parent operation
          skippedCount += childResult.skippedCount;
          if (childResult.importedNodeIds?.length) {
            importedNodeIds.push(...childResult.importedNodeIds);
          }
        }
      }

      operation.status = 'completed';
      operation.completedAt = Date.now();
      operation.result = {
        success: importedNodeIds.length > 0,
        importedNodeIds,
        importedCount: importedNodeIds.length,
        skippedCount,
        errors: errors.length ? errors : undefined,
        operationId,
      };
      return operation.result as ImportResult;
    } catch (error) {
      operation.status = 'failed';
      operation.completedAt = Date.now();
      operation.error = String(error);
      throw error;
    } finally {
      this.abortControllers.delete(operationId);
    }
  }

  async exportNodes(params: ExportNodesParams): Promise<ExportResult> {
    const operationId = this.generateOperationId();
    const abortController = new AbortController();
    this.abortControllers.set(operationId, abortController);

    const operation: OperationStatus = {
      operationId,
      type: 'export',
      status: 'running',
      startedAt: Date.now(),
    };
    this.operations.set(operationId, operation);

    try {
      const collectedNodes: TreeNode[] = [];
      const total = params.nodeIds.length;

      for (let i = 0; i < params.nodeIds.length; i++) {
        if (abortController.signal.aborted) throw new Error('Export operation cancelled');
        const nodeId = params.nodeIds[i];
        if (!nodeId) continue;
        const node = await this.db.getNode(nodeId);
        if (node) {
          collectedNodes.push(node);
          if (params.includeChildren) {
            const children = await this.collectChildNodes(nodeId);
            collectedNodes.push(...children);
          }
        }
        params.onProgress?.({
          phase: 'collecting',
          current: i + 1,
          total,
          percentage: ((i + 1) / total) * 100,
          message: `Collected node ${i + 1} of ${total}`,
        });
      }

      let exportedData: string | Blob;
      let mimeType: string;
      let exportedCount = 0;
      switch (params.format) {
        case 'json':
          exportedData = this.formatAsJSON(collectedNodes, params.includeMetadata);
          mimeType = 'application/json';
          exportedCount = collectedNodes.length;
          break;
        case 'csv':
          exportedData = this.formatAsCSV(collectedNodes, params.tabularColumns);
          mimeType = 'text/csv';
          exportedCount = collectedNodes.length;
          break;
        case 'pbf.zip':
        case 'mvf': {
          const shapeNodeIds = [
            ...new Set(
              collectedNodes
                .filter((node) => node.nodeType === 'shape')
                .map((node) => node.id),
            ),
          ];
          const tiles = await this.collectVectorTileRecords(shapeNodeIds);

          const summary = this.buildVectorTileSummary(shapeNodeIds, tiles, params.format, params.includeMetadata);
          exportedData = this.buildVectorTileZipExport(params.format, tiles, summary, params.includeMetadata);
          mimeType = params.format === 'mvf' ? 'application/octet-stream' : 'application/zip';
          exportedCount = tiles.length;
          break;
        }
        case 'xml':
          throw new Error(`Unsupported export format: ${params.format}`);
        default:
          throw new Error(`Unsupported export format: ${params.format}`);
      }

      const result: ExportResult = {
        success: true,
        data: exportedData,
        format: params.format,
        exportedCount,
        mimeType,
        filename: this.getExportFilename(params.format),
        operationId,
      };

      operation.status = 'completed';
      operation.completedAt = Date.now();
      operation.result = result;
      return result;

    } catch (error) {
      operation.status = 'failed';
      operation.completedAt = Date.now();
      operation.error = String(error);
      throw error;
    } finally {
      this.abortControllers.delete(operationId);
    }
  }

  async getSupportedImportFormats(): Promise<NodeType[]> {
    return ['json' as NodeType, 'csv' as NodeType];
  }

  async getSupportedExportFormats(): Promise<NodeType[]> {
    return ['json' as NodeType, 'csv' as NodeType, 'pbf.zip' as NodeType, 'mvf' as NodeType];
  }

  async validateImportData(params: ValidateImportParams<T>): Promise<ImportValidationResult> {
    const issues: ValidationIssue[] = [];
    const nodeTypes = new Map<string, number>();
    let maxDepth = 0;

    const validateNode = (node: ImportNodeInput<T>, path: string, depth: number) => {
      maxDepth = Math.max(maxDepth, depth);
      if (!node.name) issues.push({ code: 'MISSING_NAME', message: 'Node name is required', path });
      const nodeType = node.nodeType || 'folder';
      nodeTypes.set(nodeType, (nodeTypes.get(nodeType) || 0) + 1);
      if (node.children && Array.isArray(node.children)) {
        node.children.forEach((child: ImportNodeInput<T>, index: number) => {
          validateNode(child, `${path}.children[${index}]`, depth + 1);
        });
      }
    };

    if (!params.data?.nodes) {
      issues.push({ code: 'INVALID_STRUCTURE', message: 'Import data must contain a nodes array', path: 'nodes' });
    } else if (!Array.isArray(params.data.nodes)) {
      issues.push({ code: 'INVALID_NODES', message: 'Nodes must be an array', path: 'nodes' });
    } else {
      params.data.nodes.map((node: ImportNodeInput<T>, index: number) => validateNode(node, `nodes[${index}]`, 0));
    }

    if (issues.length === 0) {
      return { valid: true };
    }

    const summary = issues
      .map((issue) => `${issue.code}: ${issue.message}${issue.path ? ` @ ${issue.path}` : ''}`)
      .join('; ');

    return { valid: false, message: summary, issues };
  }

  async getOperationStatus(operationId: string): Promise<OperationStatus | null> {
    return this.operations.get(operationId) || null;
  }

  async cancelOperation(operationId: string): Promise<{ success: boolean; error?: string }> {
    const controller = this.abortControllers.get(operationId);
    if (!controller) return { success: false, error: 'Operation not found or already completed' };
    controller.abort();
    const operation = this.operations.get(operationId);
    if (operation && operation.status === 'running') {
      operation.status = 'cancelled';
      operation.completedAt = Date.now();
    }
    return { success: true };
  }

  private async findNodeByName(parentId: NodeId, name: string): Promise<TreeNode | null> {
    const children = await this.db.listChildren(parentId);
    return children.find((n) => (n.metadata?.name ?? '') === name) || null;
  }

  private async collectChildNodes(parentId: NodeId): Promise<TreeNode[]> {
    const children = await this.db.listChildren(parentId);
    const all: TreeNode[] = [...children];
    for (const child of children) {
      const sub = await this.collectChildNodes(child.id);
      all.push(...sub);
    }
    return all;
  }

  private formatAsJSON(nodes: TreeNode[], _includeMetadata?: boolean): string {
    const exportData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      nodeCount: nodes.length,
      nodes: nodes.map((node) => ({
        name: node.metadata?.name ?? '',
        nodeType: node.nodeType,
        description: node.metadata?.description ?? '',
      })),
    };
    return JSON.stringify(exportData, null, 2);
  }

  private formatAsCSV(nodes: TreeNode[], columns?: string[]): string {
    const cols = columns ?? ['name', 'nodeType', 'description'];
    const headers = cols.join(',');
    const rows = nodes.map((node) =>
      cols
        .map((col) => {
          const record: Record<string, unknown> = {
            name: node.metadata?.name ?? '',
            description: node.metadata?.description ?? '',
            nodeType: node.nodeType,
          } as Record<string, unknown>;
          const value = record[col];
          if (value === null || value === undefined) return '';
          if (
            typeof value === 'string' &&
            (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r'))
          ) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return String(value);
        })
        .join(','),
    );
    return [headers, ...rows].join('\n');
  }

  private generateOperationId(): string {
    return `op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private async collectVectorTileRecords(shapeNodeIds: NodeId[]): Promise<VectorTileRecord[]> {
    if (shapeNodeIds.length === 0) {
      return [];
    }
    return this.db.listVectorTileRecords(shapeNodeIds);
  }

  private buildVectorTileSummary(
    shapeNodeIds: NodeId[],
    tiles: VectorTileRecord[],
    format: ExportFormat,
    includeMetadata?: boolean
  ): {
    exportDate: string;
    nodeCount: number;
    tileCount: number;
    format: ExportFormat;
    includeMetadata: boolean;
    totalBytes: number;
    nodeIds: NodeId[];
  } {
    const totalBytes = tiles.reduce(
      (acc, tile) => acc + (tile.size || tile.data_Uint8Array.byteLength),
      0,
    );
    return {
      exportDate: new Date().toISOString(),
      nodeCount: shapeNodeIds.length,
      tileCount: tiles.length,
      format,
      includeMetadata: Boolean(includeMetadata),
      totalBytes,
      nodeIds: [...shapeNodeIds],
    };
  }

  private buildVectorTileZipExport(
    format: ExportFormat,
    tiles: VectorTileRecord[],
    summary: VectorTileZipMetadata,
    includeMetadata?: boolean
  ): Blob {
    const files: Record<string, Uint8Array> = {};
    const sortedTiles = [...tiles].sort(
      (a, b) =>
        a.nodeId.localeCompare(b.nodeId) || a.z - b.z || a.x - b.x || a.y - b.y,
    );
    for (const tile of sortedTiles) {
      const bytes =
        tile.data_Uint8Array instanceof Uint8Array
          ? tile.data_Uint8Array
          : new Uint8Array(tile.data_Uint8Array);
      files[`${tile.nodeId}/${tile.z}/${tile.x}/${tile.y}.pbf`] = bytes;
    }

    if (includeMetadata) {
      files['metadata.json'] = strToU8(
        JSON.stringify({ format: 'vector-tile-export', summary }, null, 2),
      );
    }
    files['summary.json'] = strToU8(JSON.stringify(summary, null, 2));

    // zipSync with DEFLATE compression (level 6)
    const zipped = zipSync(files, { level: 6 });
    const blobType =
      format === 'mvf' ? 'application/octet-stream' : 'application/zip';
    return new Blob([zipped], { type: blobType });
  }

  private getExportFilename(format: ExportFormat): string {
    if (format === 'pbf.zip') return `export-${Date.now()}.pbf.zip`;
    if (format === 'mvf') return `export-${Date.now()}.mvf`;
    return `export-${Date.now()}.${format}`;
  }

}

function createUniqueName(existingNames: Set<string>, baseName: string): string {
  if (!existingNames.has(baseName)) {
    return baseName;
  }

  const escapedBase = baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^${escapedBase}\\s*\\((\\d+)\\)$`);

  let maxSuffix = 1;
  for (const name of existingNames) {
    const match = pattern.exec(name);
    if (match && match[1]) {
      const parsed = Number.parseInt(match[1], 10);
      if (!Number.isNaN(parsed) && parsed > maxSuffix) {
        maxSuffix = parsed;
      }
    }
  }

  return `${baseName} (${maxSuffix + 1})`;
}
