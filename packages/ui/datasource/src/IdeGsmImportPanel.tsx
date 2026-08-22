import { FileInputWithUrl } from '@hierarchidb/ui-file';
import { Add, ArrowDropDown, Close, CloudDownload, InsertDriveFile } from '@mui/icons-material';
import {
  Box,
  Button,
  ButtonGroup,
  Dialog,
  DialogContent,
  IconButton,
  ListItemIcon,
  Menu,
  MenuItem,
  Stack,
  Typography,
} from '@mui/material';
import type React from 'react';
import { useIdeGsmImportPanel } from './useIdeGsmImportPanel.js';

export type IdeGsmFileEntry = {
  fileName: string;
  sourceId: string;
  sizeBytes?: number;
  sourceType?: 'local' | 'remote';
};

export type IdeGsmImportPayload = {
  file: File;
  downloadUrl?: string;
  sourceType: 'local' | 'remote';
};

export type IdeGsmImportLabels = {
  importButton: string;
  noFiles: string;
  importLocal: string;
  importRemote: string;
  fileFallback: string;
  removeFile: string;
  buttonLabel: string;
  instructions: string;
};

type IdeGsmImportSingleProps = {
  fileName?: string;
  sourceId?: string;
  sizeBytes?: number;
  onChange: (payload: IdeGsmImportPayload) => void;
  onClear: () => void;
};

type IdeGsmImportMultiProps = {
  files: IdeGsmFileEntry[];
  onAddFile: (payload: IdeGsmImportPayload) => void;
  onRemoveFile: (index: number) => void;
};

export type IdeGsmImportPanelProps = {
  disabled?: boolean;
  labels: IdeGsmImportLabels;
  defaultDownloadUrl?: string;
  accept?: string;
} & (IdeGsmImportSingleProps | IdeGsmImportMultiProps);

const formatBytes = (bytes?: number): string => {
  if (bytes == null || Number.isNaN(bytes)) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
};

const IdeGsmFileCard: React.FC<{
  entry: IdeGsmFileEntry;
  sizeLabel: string;
  onRemove: (event: React.MouseEvent<HTMLButtonElement>) => void;
  removeLabel: string;
  disabled?: boolean;
}> = ({ entry, sizeLabel, onRemove, removeLabel, disabled }) => {
  const icon =
    entry.sourceType === 'remote' ? (
      <CloudDownload fontSize="small" />
    ) : (
      <InsertDriveFile fontSize="small" />
    );
  return (
    <Box
      display="inline-flex"
      alignItems="center"
      gap={1.5}
      sx={{
        maxWidth: '100%',
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        px: 1,
        py: 0.5,
        bgcolor: 'background.paper',
      }}
    >
      <Box display="flex" alignItems="center" gap={1} sx={{ minWidth: 0 }}>
        {icon}
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" noWrap title={entry.fileName}>
            {entry.fileName}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {sizeLabel}
          </Typography>
        </Box>
      </Box>
      <IconButton
        size="small"
        aria-label={removeLabel}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onRemove(event);
        }}
        disabled={disabled}
      >
        <Close fontSize="small" />
      </IconButton>
    </Box>
  );
};

export const IdeGsmImportPanel: React.FC<IdeGsmImportPanelProps> = (props) => {
  const { disabled = false, labels, defaultDownloadUrl, accept = '.csv,.xlsx,.xls' } = props;
  const view = useIdeGsmImportPanel({ props, labels });

  return (
    <>
      <Box
        data-ignore-select="true"
        sx={{
          mt: 1.5,
          p: 1.5,
          borderRadius: 1,
          border: 1,
          borderColor: 'divider',
          bgcolor: 'background.default',
        }}
      >
        <Stack spacing={1}>
          {view.files.length > 0 ? (
            <Box display="flex" sx={{ flexFlow: 'row wrap', gap: 0.75 }}>
              {view.files.map((entry, index) => (
                <IdeGsmFileCard
                  key={`${entry.fileName}-${entry.sourceId}-${index}`}
                  entry={entry}
                  sizeLabel={formatBytes(entry.sizeBytes)}
                  onRemove={(event) => view.handleRemove(event, index)}
                  removeLabel={labels.removeFile}
                  disabled={disabled}
                />
              ))}
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">
              {labels.noFiles}
            </Typography>
          )}
          <Box>
            <ButtonGroup
              variant="outlined"
              color="secondary"
              disabled={disabled}
              sx={{
                '& .MuiButtonGroup-grouped:not(:last-of-type)': {
                  borderRight: '1px solid',
                  borderRightColor: 'divider',
                },
              }}
            >
              <Button
                startIcon={<Add />}
                onClick={view.handlePrimaryButtonClick}
                disabled={disabled}
              >
                {view.mainButtonLabel}
              </Button>
              <Button onClick={view.handleMenuButtonClick} disabled={disabled}>
                <ArrowDropDown />
              </Button>
            </ButtonGroup>
            <Menu
              anchorEl={view.menuAnchor}
              open={view.menuOpen}
              onClose={() => view.setMenuAnchor(null)}
            >
              <MenuItem onClick={view.handleSelectLocal}>
                <ListItemIcon>
                  <InsertDriveFile fontSize="small" />
                </ListItemIcon>
                {labels.importLocal}
              </MenuItem>
              <MenuItem onClick={view.handleSelectRemote}>
                <ListItemIcon>
                  <CloudDownload fontSize="small" />
                </ListItemIcon>
                {labels.importRemote}
              </MenuItem>
            </Menu>
          </Box>
        </Stack>
      </Box>
      <Dialog
        open={view.localDialogOpen}
        onClose={() => view.setLocalDialogOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 3,
            pt: 2,
          }}
        >
          <Typography variant="subtitle1">{labels.importLocal}</Typography>
          <IconButton aria-label="Close" onClick={() => view.setLocalDialogOpen(false)} autoFocus>
            <Close />
          </IconButton>
        </Box>
        <DialogContent sx={{ pt: 1.5 }}>
          <FileInputWithUrl
            accept={accept}
            buttonLabel={labels.buttonLabel}
            instructions={labels.instructions}
            onFileSelect={view.handleFileSelect}
            disabled={disabled}
            mode="local"
          />
        </DialogContent>
      </Dialog>
      <Dialog
        open={view.remoteDialogOpen}
        onClose={() => view.setRemoteDialogOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 3,
            pt: 2,
          }}
        >
          <Typography variant="subtitle1">{labels.importRemote}</Typography>
          <IconButton aria-label="Close" onClick={() => view.setRemoteDialogOpen(false)} autoFocus>
            <Close />
          </IconButton>
        </Box>
        <DialogContent sx={{ pt: 1.5 }}>
          <FileInputWithUrl
            accept={accept}
            buttonLabel={labels.buttonLabel}
            instructions={labels.instructions}
            defaultDownloadUrl={defaultDownloadUrl}
            onFileSelect={view.handleFileSelect}
            disabled={disabled}
            mode="url"
          />
        </DialogContent>
      </Dialog>
    </>
  );
};
