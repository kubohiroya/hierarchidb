/**
 * Import/Export機能の型定義
 * @module core/types/import-export
 */

import type { NodeId } from './ids';
import type { TreeNode } from './tree';

/**
 * インポートマニフェスト
 * ZIPアーカイブまたはテンプレートのメタデータ
 */
export interface ImportManifest {
  version: string;
  name: string;
  description: string;
  icon?: string;
  exportDate?: string;
  exportedBy?: string;
  appVersion?: string;
  nodeCount: number;
  resourceTypes: {
    shapes?: number;
    stylemaps?: number;
    tables?: number;
    basemaps?: number;
  };
  rootNodes?: NodeId[];
}

/**
 * エクスポートマニフェスト
 */
export interface ExportManifest extends ImportManifest {
  exportDate: string;
  exportedBy: string;
  appVersion: string;
}

/**
 * インポート進捗情報
 */
export interface ImportProgress {
  phase: 
    | 'reading'
    | 'validating'
    | 'importing-nodes'
    | 'importing-resources'
    | 'finalizing';
  current: number;
  total: number;
  message: string;
}

/**
 * エクスポート進捗情報
 */
export interface ExportProgress {
  phase:
    | 'collecting-nodes'
    | 'collecting-resources'
    | 'creating-archive'
    | 'finalizing';
  current: number;
  total: number;
  message: string;
}

/**
 * インポート結果
 */
export interface ImportResult {
  success: boolean;
  importedNodeIds: NodeId[];
  skippedNodes: number;
  errors: string[];
  warnings?: string[];
}

/**
 * エクスポート結果
 */
export interface ExportResult {
  success: boolean;
  blob?: Blob;
  exportedNodeCount: number;
  errors: string[];
}

/**
 * インポートオプション
 */
export interface ImportOptions {
  targetParentId: NodeId;
  mergeStrategy?: 'skip' | 'replace' | 'rename';
  progressCallback?: (progress: ImportProgress) => void;
}

/**
 * ファイルインポートオプション
 */
export interface FileImportOptions extends ImportOptions {
  file: File;
}

/**
 * テンプレートインポートオプション
 */
export interface TemplateImportOptions extends ImportOptions {
  templateId: string;
}

/**
 * エクスポートオプション
 */
export interface ExportOptions {
  nodeIds: NodeId[];
  includeResources?: boolean;
  includeVectorTiles?: boolean;
  includeUIStates?: boolean;
  progressCallback?: (progress: ExportProgress) => void;
}

/**
 * テンプレート定義
 */
export interface TemplateDefinition {
  id: string;
  name: string;
  description: string;
  icon?: string;
  category?: 'geographic' | 'economic' | 'demographic' | 'environmental' | 'custom';
  tags?: string[];
  previewImage?: string;
  dataSource?: string;
  lastUpdated?: string;
}

/**
 * ツリーノードエクスポートデータ
 */
export interface TreeNodeExportData {
  nodes: Record<NodeId, TreeNode>;
  nodeIds: NodeId[];
  rootIds: NodeId[];
  metadata?: {
    totalCount: number;
    treeDepth: number;
  };
}

/**
 * クリップボードデータ
 * ノードのコピー・ペースト用のデータ構造
 */
export interface ClipboardData {
  type: 'nodes-copy';
  timestamp: number;
  nodes: Record<string, TreeNode>;
  rootIds: NodeId[];
  nodeCount?: number;
}

// OnNameConflict is already exported from command.ts, no need to re-export

/**
 * IDマッピング（インポート時の旧ID→新IDマッピング）
 */
export type IdMapping = Map<NodeId, NodeId>;