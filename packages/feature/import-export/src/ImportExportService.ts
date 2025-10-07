import type { NodeId, NodeType, TreeNode, ValidationResult } from '@hierarchidb/common-types';
import type {
  ExportNodesParams,
  ExportResult,
  ImportData,
  ImportExportAPI,
  ImportNodesParams,
  ImportResult,
  OperationStatus,
  ValidateImportParams,
} from '@hierarchidb/common-api';
import { SingletonMixin } from '@hierarchidb/util';
import crypto from 'crypto';
import type { ImportExportDBPort } from './ports.js';

type ImportNodeInput = ImportData['nodes'][number];
type ValidationIssue = { code: string; message: string; path?: string };

export class ImportExportService implements ImportExportAPI {
  private operations = new Map<string, OperationStatus>();
  private abortControllers = new Map<string, AbortController>();

  static async getSingleton(db: ImportExportDBPort): Promise<ImportExportService> {
    return SingletonMixin.getSingleton(ImportExportService.name, () => new ImportExportService(db));
  }

  constructor(private db: ImportExportDBPort) {
  }

  async importNodes(params: ImportNodesParams): Promise<ImportResult> {
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
      const depthCache = new Map<NodeId, number>();
      const resolveParentDepth = async (parentId: NodeId | null | undefined): Promise<number> => {
        if (!parentId) return -1;
        if (depthCache.has(parentId)) return depthCache.get(parentId)!;
        const parentNode = await this.db.getNode(parentId);
        const depth = parentNode?.depth ?? 0;
        depthCache.set(parentId, depth);
        return depth;
      };

      const toCreate: { node: TreeNode; children?: ImportNodeInput[] }[] = [];
      for (let i = 0; i < nodes.length; i++) {
        if (abortController.signal.aborted) throw new Error('Import operation cancelled');
        const nodeData = nodes[i] as ImportNodeInput | undefined;
        if (!nodeData) continue;
        try {
          if (params.conflictResolution === 'skip') {
            const existingNode = await this.findNodeByName(params.targetParentId, nodeData.name);
            if (existingNode) {
              skippedCount++;
              continue;
            }
          }
          const nodeId = crypto.randomUUID() as NodeId;
          const parentDepth = await resolveParentDepth(params.targetParentId);
          const parentId: NodeId = (params.targetParentId ?? (nodeData as { parentNodeId?: NodeId })?.parentNodeId ?? nodeId) as NodeId;
          const node: TreeNode = {
            id: nodeId,
            parentId,
            nodeType: (nodeData.nodeType || 'folder') as NodeType,
            name: nodeData.name,
            description: nodeData.description,
            depth: Math.max(0, parentDepth + 1),
            createdAt: Date.now(),
            updatedAt: Date.now(),
            version: 1,
          };
          toCreate.push({ node, children: nodeData.children });
        } catch (error) {
          errors.push(`Failed to prepare node "${nodeData?.name}": ${error}`);
        }
      }

      const size = 100; // conservative batch size; callers can chunk earlier if needed
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

      let exportedData: string;
      let mimeType: string;
      switch (params.format) {
        case 'json':
          exportedData = this.formatAsJSON(collectedNodes, params.includeMetadata);
          mimeType = 'application/json';
          break;
        case 'csv':
          exportedData = this.formatAsCSV(collectedNodes, params.csvColumns);
          mimeType = 'text/csv';
          break;
        case 'xml':
          exportedData = this.formatAsXML(collectedNodes, params.includeMetadata);
          mimeType = 'application/xml';
          break;
        default:
          throw new Error(`Unsupported export format: ${params.format}`);
      }

      const result: ExportResult = {
        success: true,
        data: exportedData,
        format: params.format,
        exportedCount: collectedNodes.length,
        mimeType,
        filename: `export-${Date.now()}.${params.format}`,
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
    return ['json' as NodeType, 'csv' as NodeType, 'xml' as NodeType];
  }

  async getSupportedExportFormats(): Promise<NodeType[]> {
    return ['json' as NodeType, 'csv' as NodeType, 'xml' as NodeType];
  }

  async validateImportData(params: ValidateImportParams): Promise<ValidationResult> {
    const issues: ValidationIssue[] = [];
    const nodeTypes = new Map<string, number>();
    let maxDepth = 0;

    const validateNode = (node: ImportNodeInput, path: string, depth: number) => {
      maxDepth = Math.max(maxDepth, depth);
      if (!node.name) issues.push({ code: 'MISSING_NAME', message: 'Node name is required', path });
      const nodeType = node.nodeType || 'folder';
      nodeTypes.set(nodeType, (nodeTypes.get(nodeType) || 0) + 1);
      if (node.children && Array.isArray(node.children)) {
        node.children.forEach((child: ImportNodeInput, index: number) => {
          validateNode(child, `${path}.children[${index}]`, depth + 1);
        });
      }
    };

    if (!params.data?.nodes) {
      issues.push({ code: 'INVALID_STRUCTURE', message: 'Import data must contain a nodes array', path: 'nodes' });
    } else if (!Array.isArray(params.data.nodes)) {
      issues.push({ code: 'INVALID_NODES', message: 'Nodes must be an array', path: 'nodes' });
    } else {
      params.data.nodes.forEach((node: ImportNodeInput, index: number) => validateNode(node, `nodes[${index}]`, 0));
    }

    if (issues.length === 0) {
      return { valid: true };
    }

    const summary = issues
      .map((issue) => `${issue.code}: ${issue.message}${issue.path ? ` @ ${issue.path}` : ''}`)
      .join('; ');

    return { valid: false, message: summary };
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
    return children.find((n) => n.name === name) || null;
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
        name: node.name,
        nodeType: node.nodeType,
        description: node.description ?? '',
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
          const record: Record<string, unknown> = node as unknown as Record<string, unknown>;
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

  private formatAsXML(nodes: TreeNode[], _includeMetadata?: boolean): string {
    const xml = ['<?xml version="1.0" encoding="UTF-8"?>'];
    xml.push('<export>');
    xml.push('  <metadata>');
    xml.push(`    <version>1.0</version>`);
    xml.push(`    <exportDate>${new Date().toISOString()}</exportDate>`);
    xml.push(`    <nodeCount>${nodes.length}</nodeCount>`);
    xml.push('  </metadata>');
    xml.push('  <nodes>');
    for (const node of nodes) {
      xml.push('    <node>');
      xml.push(`      <name>${this.escapeXML(node.name)}</name>`);
      xml.push(`      <nodeType>${node.nodeType}</nodeType>`);
      if (node.description) {
        xml.push(`      <description>${this.escapeXML(node.description)}</description>`);
      }
      xml.push('    </node>');
    }
    xml.push('  </nodes>');
    xml.push('</export>');
    return xml.join('\n');
  }

  private escapeXML(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }

  private generateOperationId(): string {
    return `op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
