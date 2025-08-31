import type { NodeId, TreeNode } from '@hierarchidb/common-type';
import type {
  ImportExportAPI,
  ImportNodesParams,
  ImportResult,
  ExportNodesParams,
  ExportResult,
  ValidateImportParams,
  ValidationResult,
  ValidationError,
  OperationStatus,
} from '@hierarchidb/common-api';
import type { NodeType } from '@hierarchidb/common-type';
import { CoreDB } from '../db/CoreDB';
import { NodeLifecycleManager } from '../lifecycle/NodeLifecycleManager';
import crypto from 'crypto';

/**
 * Import/Export API implementation for Worker layer
 * Handles data import/export operations with progress tracking
 */
export class ImportExportAPIImpl implements ImportExportAPI {
  private static instance: ImportExportAPIImpl | null = null;
  private operations = new Map<string, OperationStatus>();
  private abortControllers = new Map<string, AbortController>();
  private db: CoreDB;
  private lifecycleManager: NodeLifecycleManager;

  private constructor() {
    // Note: db will be initialized asynchronously
  }

  private async initialize() {
    this.db = await CoreDB.getSingleton();
    // NodeLifecycleManager needs to be injected from outside
    // this.lifecycleManager = NodeLifecycleManager.getInstance();
  }

  static async getInstance(): Promise<ImportExportAPIImpl> {
    if (!ImportExportAPIImpl.instance) {
      ImportExportAPIImpl.instance = new ImportExportAPIImpl();
      await ImportExportAPIImpl.instance.initialize();
    }
    return ImportExportAPIImpl.instance;
  }

  /**
   * Import nodes from structured data
   */
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
      // Validate data if requested
      if (params.validateFirst) {
        const validation = await this.validateImportData({
          data: params.data,
          format: params.format,
          treeId: params.treeId,
          targetParentId: params.targetParentId,
        });

        if (!validation.valid) {
          throw new Error(
            `Validation failed: ${validation.errors.map((e) => e.message).join(', ')}`
          );
        }
      }

      const importedNodeIds: NodeId[] = [];
      const errors: string[] = [];
      let skippedCount = 0;

      const nodes = params.data.nodes || [];
      const total = nodes.length;

      // Process each node
      for (let i = 0; i < nodes.length; i++) {
        if (abortController.signal.aborted) {
          throw new Error('Import operation cancelled');
        }

        const nodeData = nodes[i];

        try {
          // Check for conflicts
          if (params.conflictResolution === 'skip') {
            const existingNode = await this.findNodeByName(params.targetParentId, nodeData.name);
            if (existingNode) {
              skippedCount++;
              continue;
            }
          }

          // Generate node ID
          const nodeId = crypto.randomUUID() as NodeId;

          // Create the node
          const node: TreeNode = {
            id: nodeId,
            parentId: params.targetParentId,
            nodeType: (nodeData.nodeType || 'folder') as NodeType,
            name: nodeData.name,
            description: nodeData.description,
            depth: 0, // Will be calculated by database operations
            // metadata: nodeData.metadata || {}, // TreeNode doesn't have metadata property
            createdAt: Date.now(),
            updatedAt: Date.now(),
            version: 1,
          };

          await this.db.createNode(node);
          importedNodeIds.push(nodeId);

          // Process children recursively if present
          if (nodeData.children && nodeData.children.length > 0) {
            const childResult = await this.importNodes({
              ...params,
              targetParentId: nodeId,
              data: { nodes: nodeData.children },
            });
            importedNodeIds.push(...childResult.importedNodeIds);
            skippedCount += childResult.skippedCount;
          }

          // Report progress
          params.onProgress?.({
            phase: 'importing',
            current: i + 1,
            total,
            percentage: ((i + 1) / total) * 100,
            message: `Imported ${nodeData.name}`,
          });
        } catch (error) {
          const errorMessage = `Failed to import node "${nodeData.name}": ${error}`;
          errors.push(errorMessage);
          console.error(errorMessage, error);
        }
      }

      // Finalize operation
      operation.status = 'completed';
      operation.completedAt = Date.now();
      operation.result = {
        success: importedNodeIds.length > 0,
        importedNodeIds,
        importedCount: importedNodeIds.length,
        skippedCount,
        errors: errors.length > 0 ? errors : undefined,
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

  /**
   * Export nodes to structured data
   */
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
      // Collect nodes
      const collectedNodes: TreeNode[] = [];
      const total = params.nodeIds.length;

      for (let i = 0; i < params.nodeIds.length; i++) {
        if (abortController.signal.aborted) {
          throw new Error('Export operation cancelled');
        }

        const nodeId = params.nodeIds[i];
        const node = await this.db.getNode(nodeId);

        if (node) {
          collectedNodes.push(node);

          // Include children if requested
          if (params.includeChildren) {
            const children = await this.collectChildNodes(nodeId);
            collectedNodes.push(...children);
          }
        }

        // Report progress
        params.onProgress?.({
          phase: 'collecting',
          current: i + 1,
          total,
          percentage: ((i + 1) / total) * 100,
          message: `Collected node ${i + 1} of ${total}`,
        });
      }

      // Format data based on export format
      let exportedData: string;
      let mimeType: string;

      params.onProgress?.({
        phase: 'formatting',
        current: 1,
        total: 1,
        percentage: 100,
        message: 'Formatting data...',
      });

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

      // Create result
      const result: ExportResult = {
        success: true,
        data: exportedData,
        format: params.format,
        exportedCount: collectedNodes.length,
        mimeType,
        filename: `export-${Date.now()}.${params.format}`,
        operationId,
      };

      // Finalize operation
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

  /**
   * Get supported import formats
   */
  async getSupportedImportFormats(): Promise<string[]> {
    return ['json', 'csv', 'xml'];
  }

  /**
   * Get supported export formats
   */
  async getSupportedExportFormats(): Promise<string[]> {
    return ['json', 'csv', 'xml'];
  }

  /**
   * Validate import data without performing actual import
   */
  async validateImportData(params: ValidateImportParams): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings = [];
    const nodeTypes = new Map<string, number>();
    let nodeCount = 0;
    let maxDepth = 0;

    const validateNode = (node: any, path: string, depth: number) => {
      nodeCount++;
      maxDepth = Math.max(maxDepth, depth);

      // Validate required fields
      if (!node.name) {
        errors.push({
          code: 'MISSING_NAME',
          message: 'Node name is required',
          path,
        });
      }

      // Track node types
      const nodeType = node.nodeType || 'folder';
      nodeTypes.set(nodeType, (nodeTypes.get(nodeType) || 0) + 1);

      // Validate children recursively
      if (node.children && Array.isArray(node.children)) {
        node.children.forEach((child: any, index: number) => {
          validateNode(child, `${path}.children[${index}]`, depth + 1);
        });
      }
    };

    // Validate structure
    if (!params.data || !params.data.nodes) {
      errors.push({
        code: 'INVALID_STRUCTURE',
        message: 'Import data must contain a nodes array',
      });
    } else if (!Array.isArray(params.data.nodes)) {
      errors.push({
        code: 'INVALID_NODES',
        message: 'Nodes must be an array',
      });
    } else {
      // Validate each node
      params.data.nodes.forEach((node, index) => {
        validateNode(node, `nodes[${index}]`, 0);
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined,
      statistics: {
        nodeCount,
        maxDepth,
        nodeTypes: Object.fromEntries(nodeTypes),
      },
    };
  }

  /**
   * Get import/export operation status
   */
  async getOperationStatus(operationId: string): Promise<OperationStatus | null> {
    return this.operations.get(operationId) || null;
  }

  /**
   * Cancel an ongoing import/export operation
   */
  async cancelOperation(operationId: string): Promise<{ success: boolean; error?: string }> {
    const controller = this.abortControllers.get(operationId);
    if (!controller) {
      return {
        success: false,
        error: 'Operation not found or already completed',
      };
    }

    controller.abort();

    const operation = this.operations.get(operationId);
    if (operation && operation.status === 'running') {
      operation.status = 'cancelled';
      operation.completedAt = Date.now();
    }

    return { success: true };
  }

  // Helper methods

  private generateOperationId(): string {
    return `op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private async findNodeByName(parentId: NodeId, name: string): Promise<TreeNode | null> {
    const children = await this.db.listChildren(parentId);
    return children.find((node) => node.name === name) || null;
  }

  private async collectChildNodes(parentId: NodeId): Promise<TreeNode[]> {
    const children = await this.db.listChildren(parentId);
    const allNodes: TreeNode[] = [...children];

    for (const child of children) {
      const grandchildren = await this.collectChildNodes(child.id);
      allNodes.push(...grandchildren);
    }

    return allNodes;
  }

  private formatAsJSON(nodes: TreeNode[], includeMetadata?: boolean): string {
    const exportData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      nodeCount: nodes.length,
      nodes: nodes.map((node) => {
        const exported: any = {
          name: node.name,
          nodeType: node.nodeType,
          description: node.description,
        };

        // if (includeMetadata && node.metadata) {
        //   exported.metadata = node.metadata;
        // } // TreeNode doesn't have metadata property

        return exported;
      }),
    };

    return JSON.stringify(exportData, null, 2);
  }

  private formatAsCSV(nodes: TreeNode[], columns?: string[]): string {
    const cols = columns || ['name', 'nodeType', 'description'];
    const headers = cols.join(',');

    const rows = nodes.map((node) => {
      return cols
        .map((col) => {
          const value = (node as any)[col] || '';
          // Escape CSV values
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return String(value);
        })
        .join(',');
    });

    return [headers, ...rows].join('\n');
  }

  private formatAsXML(nodes: TreeNode[], includeMetadata?: boolean): string {
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
      // if (includeMetadata && node.metadata) {
      //   xml.push('      <metadata>');
      //   for (const [key, value] of Object.entries(node.metadata)) {
      //     xml.push(`        <${key}>${this.escapeXML(String(value))}</${key}>`);
      //   }
      //   xml.push('      </metadata>');
      // } // TreeNode doesn't have metadata property
      xml.push('    </node>');
    }

    xml.push('  </nodes>');
    xml.push('</export>');

    return xml.join('\n');
  }

  private escapeXML(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
