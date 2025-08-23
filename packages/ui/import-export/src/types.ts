import type { NodeId } from '@hierarchidb/00-core';

export interface ImportExportOptions {
  parentNodeId?: NodeId;
  selectedNodeIds?: NodeId[];
  onSuccess?: (message: string) => void;
  onError?: (error: string) => void;
}

export interface ImportExportService {
  importFromTemplate: (templateId: string, options: ImportExportOptions) => Promise<NodeId[] | null>;
  importFromFile: (file: File, options: ImportExportOptions) => Promise<NodeId[] | null>;
  exportToJson: (nodeIds: NodeId[], options?: ImportExportOptions) => Promise<boolean>;
  exportToZip: (nodeIds: NodeId[], options?: ImportExportOptions) => Promise<boolean>;
}

export interface ImportExportPluginConfig {
  enableTemplateImport?: boolean;
  enableFileImport?: boolean;
  enableJsonExport?: boolean;
  enableZipExport?: boolean;
  availableTemplates?: TemplateDefinition[];
  showInToolbar?: boolean;
  showInContextMenu?: boolean;
  requireSelection?: boolean;
  buttonPosition?: 'start' | 'end' | 'before-more' | 'after-more';
}

export interface TemplateDefinition {
  id: string;
  name: string;
  description?: string;
  icon?: React.ReactNode;
  category?: string;
  requiredPermissions?: string[];
}

export interface ImportExportContext {
  selectedNodeIds: Set<NodeId>;
  parentNodeId?: NodeId;
  canImport: boolean;
  canExport: boolean;
  importExportService?: ImportExportService;
}

export interface ImportResult {
  success: boolean;
  nodeIds?: NodeId[];
  error?: string;
  message?: string;
}

export interface ExportResult {
  success: boolean;
  filename?: string;
  blob?: Blob;
  error?: string;
  message?: string;
}