/**
 * Import/Export機能の型定義
 * @module core/types/import-export
 */

import { NodeId } from './id-types';
import { TreeNode } from './tree-node-types';

/**
 * インポートマニフェスト
 * ZIPアーカイブまたはテンプレートのメタデータ
 */
/**
 * @deprecated Unused across the repository; scheduled for removal.
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
    stylers?: number;
    tables?: number;
    basemaps?: number;
  };
  rootNodes?: NodeId[];
}

/**
 * エクスポートマニフェスト
 */
/**
 * @deprecated Unused across the repository; scheduled for removal.
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
  phase: 'reading' | 'validating' | 'importing-nodes' | 'importing-resources' | 'finalizing';
  current: number;
  total: number;
  message: string;
}

/**
 * エクスポート進捗情報
 */
export interface ExportProgress {
  phase: 'collecting-nodes' | 'collecting-resources' | 'creating-archive' | 'finalizing';
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
/**
 * @deprecated Unused across the repository; scheduled for removal.
 */
export interface ImportOptions {
  targetParentId: NodeId;
  mergeStrategy?: 'skip' | 'replace' | 'rename';
  progressCallback?: (progress: ImportProgress) => void;
}

/**
 * ファイルインポートオプション
 */
/**
 * @deprecated Unused across the repository; scheduled for removal.
 */
export interface FileImportOptions extends ImportOptions {
  file: File;
}

/**
 * テンプレートインポートオプション
 */
/**
 * @deprecated Unused across the repository; scheduled for removal.
 */
export interface TemplateImportOptions extends ImportOptions {
  templateId: string;
}

/**
 * エクスポートオプション
 */
/**
 * @deprecated Unused across the repository; scheduled for removal.
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
/**
 * @deprecated Unused across the repository; scheduled for removal.
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
/**
 * @deprecated Unused across the repository; scheduled for removal.
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

// OnNameConflict is already exported from command-types, no need to re-export

/**
 * IDマッピング（インポート時の旧ID→新IDマッピング）
 */
/**
 * @deprecated Unused across the repository; scheduled for removal.
 */
export type IdMapping = Map<NodeId, NodeId>;
