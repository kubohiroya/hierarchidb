import {
  FileDownload as FileDownloadIcon,
  FileUpload as FileUploadIcon,
  KeyboardArrowDown as KeyboardArrowDownIcon,
  KeyboardArrowRight as KeyboardArrowRightIcon,
  Save as SaveIcon,
  SnippetFolder as SnippetFolderIcon,
} from '@mui/icons-material';
import { Box, Button, ButtonGroup, Divider, ListItemIcon, ListItemText, Menu, MenuItem } from '@mui/material';
import type { FocusEvent, MouseEvent } from 'react';
import { useEffect, useState } from 'react';

export interface ImportExportMenuProps {
  buttonLabel: string;
  allowImport: boolean;
  templates: Array<{ id: string; label?: string }>;
  importLabel: string;
  exportLabel: string;
  importTemplateLabel: string;
  importTemplateFallback: string;
  onImport: () => void;
  onExport: () => void;
  onImportTemplate: (templateId: string) => void;
  portalContainer?: HTMLElement;
}

export function ImportExportMenu({
  buttonLabel,
  allowImport,
  templates,
  importLabel,
  exportLabel,
  importTemplateLabel,
  importTemplateFallback,
  onImport,
  onExport,
  onImportTemplate,
  portalContainer,
}: ImportExportMenuProps) {
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [templateAnchor, setTemplateAnchor] = useState<HTMLElement | null>(null);

  const openMenu = (event: MouseEvent<HTMLElement>) => {
    setMenuAnchor(event.currentTarget);
  };

  const closeMenu = () => {
    setMenuAnchor(null);
    setTemplateAnchor(null);
  };

  const openTemplateMenuFromMouse = (event: MouseEvent<HTMLElement>) => {
    if (!allowImport) return;
    event.preventDefault();
    event.stopPropagation();
    setTemplateAnchor(event.currentTarget);
  };

  const openTemplateMenuFromFocus = (event: FocusEvent<HTMLElement>) => {
    if (!allowImport) return;
    event.preventDefault();
    event.stopPropagation();
    setTemplateAnchor(event.currentTarget as HTMLElement);
  };

  const closeTemplateMenu = () => setTemplateAnchor(null);

  const hasTemplates = allowImport && templates.length > 0;

  useEffect(() => {
    if (!allowImport) {
      setTemplateAnchor(null);
    }
  }, [allowImport]);

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <ButtonGroup size="small">
        <Button
          endIcon={<KeyboardArrowDownIcon />}
          onClick={openMenu}
          color="primary"
          aria-label={buttonLabel}
          title={buttonLabel}
        >
          <SaveIcon fontSize="small" />
        </Button>
      </ButtonGroup>
      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeMenu} container={portalContainer}>
        <MenuItem
          onClick={() => {
            onImport();
            closeMenu();
          }}
          aria-label={importLabel}
          disabled={!allowImport}
        >
          <ListItemIcon>
            <FileUploadIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary={importLabel} />
        </MenuItem>
        <MenuItem
          onClick={() => {
            onExport();
            closeMenu();
          }}
          aria-label={exportLabel}
        >
          <ListItemIcon>
            <FileDownloadIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary={exportLabel} />
        </MenuItem>
        {hasTemplates &&
          [
            <Divider key="template-divider" />,
            <MenuItem
              key="template-menu"
              aria-haspopup="menu"
              aria-label={importTemplateLabel}
              onMouseEnter={openTemplateMenuFromMouse}
              onFocus={openTemplateMenuFromFocus}
              onClick={openTemplateMenuFromMouse}
              disabled={!allowImport}
            >
              <ListItemIcon>
                <SnippetFolderIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary={importTemplateLabel} />
              <KeyboardArrowRightIcon fontSize="small" />
            </MenuItem>,
          ]}
      </Menu>
      {hasTemplates && (
        <Menu
          anchorEl={templateAnchor}
          open={Boolean(templateAnchor)}
          onClose={closeTemplateMenu}
          container={portalContainer}
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'left' }}
          MenuListProps={{ onMouseLeave: closeTemplateMenu }}
        >
          {templates.map((template) => (
            <MenuItem
              key={template.id}
              onClick={() => {
                onImportTemplate(template.id);
                closeTemplateMenu();
                closeMenu();
              }}
              aria-label={template.label ?? importTemplateFallback}
            >
              <ListItemText primary={template.label ?? importTemplateFallback} />
            </MenuItem>
          ))}
        </Menu>
      )}
    </Box>
  );
}
