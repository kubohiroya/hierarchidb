import React from 'react';
import type { TreeNode } from '@hierarchidb/00-core';

// Define the plugin interface locally since ui-treeconsole-treetable has build issues
interface TreeTablePlugin {
  name: string;
  version: string;
  config?: any;
  hooks: Record<string, Function>;
  components?: Record<string, any>;
}
import { ImportExportButton } from '../components/ImportExportButton';
import { useImportExport } from '../hooks/useImportExport';
import type { 
  ImportExportPluginConfig,
  ImportExportService,
  ImportExportContext,
  TemplateDefinition 
} from '../types';
import type { NodeId } from '@hierarchidb/00-core';

const DEFAULT_TEMPLATES: TemplateDefinition[] = [
  {
    id: 'population-2023',
    name: 'Population 2023 Template',
    description: 'World population data for 2023',
    category: 'Demographics',
  },
  {
    id: 'business-structure',
    name: 'Business Structure Template',
    description: 'Standard business organizational structure',
    category: 'Organization',
  },
];

export function createImportExportPlugin(
  importExportService?: ImportExportService,
  config: Partial<ImportExportPluginConfig> = {}
): TreeTablePlugin {
  const pluginConfig: ImportExportPluginConfig = {
    enableTemplateImport: true,
    enableFileImport: true,
    enableJsonExport: true,
    enableZipExport: false,
    availableTemplates: DEFAULT_TEMPLATES,
    showInToolbar: true,
    showInContextMenu: true,
    requireSelection: false,
    buttonPosition: 'before-more',
    ...config,
  };

  return {
    name: 'import-export',
    version: '1.0.0',
    config: pluginConfig,
    
    hooks: {
      beforeTreeRender: async (nodes: TreeNode[], context: any) => {
        // Initialize import/export context
        context.importExport = {
          selectedNodeIds: context.selectedNodeIds || new Set(),
          parentNodeId: context.currentNodeId,
          canImport: context.permissions?.canCreate || true,
          canExport: context.selectedNodeIds?.size > 0 || !pluginConfig.requireSelection,
          importExportService,
        } as ImportExportContext;
        
        return { nodes, context };
      },

      afterNodeSelect: async (node: TreeNode, context: any) => {
        // Update import/export context when selection changes
        if (context.importExport) {
          context.importExport.selectedNodeIds = context.selectedNodeIds || new Set();
          context.importExport.canExport = context.selectedNodeIds?.size > 0 || !pluginConfig.requireSelection;
        }
        return { node, context };
      },

      onToolbarRender: async (toolbar: any, context: any) => {
        // Add import/export button to toolbar if enabled
        if (!pluginConfig.showInToolbar) return { toolbar, context };
        
        const importExportContext = context.importExport as ImportExportContext;
        if (!importExportContext) return { toolbar, context };

        const selectedNodeIds = Array.from(importExportContext.selectedNodeIds);
        
        const handleImportFile = async () => {
          // Will be handled by file input
          console.log('Import file triggered');
        };

        const handleImportTemplate = async (templateId: string) => {
          if (!importExportContext.parentNodeId) {
            context.showNotification?.('error', 'No parent node selected for import');
            return;
          }

          try {
            if (importExportService) {
              await importExportService.importFromTemplate(templateId, {
                parentNodeId: importExportContext.parentNodeId,
                selectedNodeIds: selectedNodeIds as NodeId[],
                onSuccess: (message) => context.showNotification?.('success', message),
                onError: (error) => context.showNotification?.('error', error),
              });
            } else {
              context.showNotification?.('error', 'Import service not available');
            }
          } catch (error) {
            console.error('Template import failed:', error);
            context.showNotification?.('error', 'Template import failed');
          }
        };

        const handleExportJson = async () => {
          if (selectedNodeIds.length === 0 && pluginConfig.requireSelection) {
            context.showNotification?.('error', 'No nodes selected for export');
            return;
          }

          try {
            if (importExportService) {
              await importExportService.exportToJson(selectedNodeIds as NodeId[], {
                parentNodeId: importExportContext.parentNodeId,
                selectedNodeIds: selectedNodeIds as NodeId[],
                onSuccess: (message) => context.showNotification?.('success', message),
                onError: (error) => context.showNotification?.('error', error),
              });
            } else {
              context.showNotification?.('error', 'Export service not available');
            }
          } catch (error) {
            console.error('JSON export failed:', error);
            context.showNotification?.('error', 'JSON export failed');
          }
        };

        const handleExportZip = async () => {
          if (selectedNodeIds.length === 0 && pluginConfig.requireSelection) {
            context.showNotification?.('error', 'No nodes selected for export');
            return;
          }

          try {
            if (importExportService) {
              await importExportService.exportToZip(selectedNodeIds as NodeId[], {
                parentNodeId: importExportContext.parentNodeId,
                selectedNodeIds: selectedNodeIds as NodeId[],
                onSuccess: (message) => context.showNotification?.('success', message),
                onError: (error) => context.showNotification?.('error', error),
              });
            } else {
              context.showNotification?.('error', 'Export service not available');
            }
          } catch (error) {
            console.error('ZIP export failed:', error);
            context.showNotification?.('error', 'ZIP export failed');
          }
        };

        // Add ImportExport button to toolbar actions
        const importExportButton = React.createElement(ImportExportButton, {
          key: 'import-export',
          disabled: !importExportContext.canImport && !importExportContext.canExport,
          onImportFile: handleImportFile,
          onImportTemplate: handleImportTemplate,
          onExportJson: handleExportJson,
          onExportZip: pluginConfig.enableZipExport ? handleExportZip : undefined,
          availableTemplates: pluginConfig.availableTemplates,
          enableFileImport: pluginConfig.enableFileImport,
          enableTemplateImport: pluginConfig.enableTemplateImport,
          enableJsonExport: pluginConfig.enableJsonExport,
          enableZipExport: pluginConfig.enableZipExport,
          size: 'small',
          tooltipTitle: 'Import and export options',
        });

        return { 
          toolbar: {
            ...toolbar,
            additionalActions: [
              ...(toolbar.additionalActions || []),
              {
                component: importExportButton,
                position: pluginConfig.buttonPosition,
                key: 'import-export',
              },
            ],
          },
          context 
        };
      },

      onContextMenu: async (_node: TreeNode, _event: any, context: any) => {
        // Add import/export options to context menu if enabled
        if (!pluginConfig.showInContextMenu) return;
        
        const importExportContext = context.importExport as ImportExportContext;
        if (!importExportContext) return;

        const selectedNodeIds = Array.from(importExportContext.selectedNodeIds);
        const canExport = selectedNodeIds.length > 0 || !pluginConfig.requireSelection;
        
        const contextMenuItems = [
          ...(context.contextMenuItems || []),
        ];

        if (importExportContext.canImport) {
          contextMenuItems.push({
            key: 'import-divider',
            type: 'divider',
          });
          
          if (pluginConfig.enableFileImport) {
            contextMenuItems.push({
              key: 'import-file',
              label: 'Import from File',
              icon: 'FileUpload',
              onClick: () => {
                // Trigger file import
                console.log('Import file from context menu');
              },
            });
          }

          if (pluginConfig.enableTemplateImport && (pluginConfig.availableTemplates?.length || 0) > 0) {
            contextMenuItems.push({
              key: 'import-template',
              label: 'Import from Template',
              icon: 'SnippetFolder',
              submenu: (pluginConfig.availableTemplates || []).map(template => ({
                key: `template-${template.id}`,
                label: template.name,
                onClick: () => {
                  // Handle template import
                  console.log('Import template:', template.id);
                },
              })),
            });
          }
        }

        if (canExport) {
          contextMenuItems.push({
            key: 'export-divider',
            type: 'divider',
          });
          
          if (pluginConfig.enableJsonExport) {
            contextMenuItems.push({
              key: 'export-json',
              label: 'Export as JSON',
              icon: 'FileDownload',
              onClick: () => {
                // Handle JSON export
                console.log('Export JSON from context menu');
              },
            });
          }

          if (pluginConfig.enableZipExport) {
            contextMenuItems.push({
              key: 'export-zip',
              label: 'Export as ZIP',
              icon: 'FileDownload',
              onClick: () => {
                // Handle ZIP export
                console.log('Export ZIP from context menu');
              },
            });
          }
        }

        context.contextMenuItems = contextMenuItems;
      },
    },

    components: {
      ToolbarActions: ({ context }: { context: any }) => {
        const importExportContext = context.importExport as ImportExportContext;
        if (!pluginConfig.showInToolbar || !importExportContext) {
          return null;
        }

        const {
          selectedNodeIds,
          parentNodeId,
          canImport,
          canExport,
        } = importExportContext;

        const { 
          loading,
          handleTemplateImport,
          handleFileImport,
          handleExport,
        } = useImportExport({
          parentNodeId,
          selectedNodeIds: Array.from(selectedNodeIds),
          importExportService,
          onSuccess: (message) => context.showNotification?.('success', message),
          onError: (error) => context.showNotification?.('error', error),
        });

        return React.createElement(ImportExportButton, {
          disabled: loading || (!canImport && !canExport),
          onImportFile: () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = (e) => {
              const file = (e.target as HTMLInputElement).files?.[0];
              if (file) {
                handleFileImport(file);
              }
            };
            input.click();
          },
          onImportTemplate: handleTemplateImport,
          onExportJson: () => handleExport('json'),
          onExportZip: pluginConfig.enableZipExport ? () => handleExport('zip') : undefined,
          availableTemplates: pluginConfig.availableTemplates,
          enableFileImport: pluginConfig.enableFileImport,
          enableTemplateImport: pluginConfig.enableTemplateImport,
          enableJsonExport: pluginConfig.enableJsonExport,
          enableZipExport: pluginConfig.enableZipExport,
          size: 'small',
          tooltipTitle: 'Import and export options',
        });
      },
    },
  };
}