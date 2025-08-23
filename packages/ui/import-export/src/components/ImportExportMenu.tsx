import React, { useRef } from 'react';
import {
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
} from '@mui/material';
import {
  FileDownload as ExportIcon,
  FileUpload as ImportIcon,
  SnippetFolder as TemplateIcon,
} from '@mui/icons-material';
import type { TemplateDefinition } from '../types';

export interface ImportExportMenuProps {
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  onImportFile: () => void;
  onImportTemplate: (templateId: string) => void;
  onExportJson: () => void;
  onExportZip?: () => void;
  availableTemplates?: TemplateDefinition[];
  enableFileImport?: boolean;
  enableTemplateImport?: boolean;
  enableJsonExport?: boolean;
  enableZipExport?: boolean;
}

export function ImportExportMenu({
  anchorEl,
  open,
  onClose,
  onImportFile,
  onImportTemplate,
  onExportJson,
  onExportZip,
  availableTemplates = [
    { id: 'population-2023', name: 'Population 2023 Template' },
  ],
  enableFileImport = true,
  enableTemplateImport = true,
  enableJsonExport = true,
  enableZipExport = false,
}: ImportExportMenuProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportFileClick = () => {
    fileInputRef.current?.click();
    onClose();
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onImportFile();
    }
  };

  return (
    <>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={onClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
      >
        {enableFileImport && (
          <MenuItem onClick={handleImportFileClick}>
            <ListItemIcon>
              <ImportIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Import from JSON File</ListItemText>
          </MenuItem>
        )}
        
        {enableTemplateImport && availableTemplates.length > 0 && (
          <>
            {enableFileImport && <Divider />}
            {availableTemplates.map((template) => (
              <MenuItem
                key={template.id}
                onClick={() => {
                  onImportTemplate(template.id);
                  onClose();
                }}
              >
                <ListItemIcon>
                  {template.icon || <TemplateIcon fontSize="small" />}
                </ListItemIcon>
                <ListItemText>{template.name}</ListItemText>
              </MenuItem>
            ))}
          </>
        )}
        
        {(enableJsonExport || enableZipExport) && (enableFileImport || enableTemplateImport) && (
          <Divider />
        )}
        
        {enableJsonExport && (
          <MenuItem onClick={() => { onExportJson(); onClose(); }}>
            <ListItemIcon>
              <ExportIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Export as JSON</ListItemText>
          </MenuItem>
        )}
        
        {enableZipExport && onExportZip && (
          <MenuItem onClick={() => { onExportZip(); onClose(); }}>
            <ListItemIcon>
              <ExportIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Export as ZIP</ListItemText>
          </MenuItem>
        )}
      </Menu>
      
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />
    </>
  );
}