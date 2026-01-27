import {
  Add,
  ArrowDropDown,
  Close,
  CloudDownload,
  InsertDriveFile,
} from '@mui/icons-material';
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
import { useMemo, useState } from 'react';
import { FileInputWithUrl } from '@hierarchidb/ui-file';

export type IdeGsmFileEntry = {
  fileName: string;
  sourceUrl: string;
  sizeBytes?: number;
  sourceType?: 'local' | 'remote';
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
  sourceUrl?: string;
  onChange: (payload: IdeGsmFileEntry) => void;
  onClear: () => void;
};

type IdeGsmImportMultiProps = {
  files: IdeGsmFileEntry[];
  onAddFile: (payload: IdeGsmFileEntry) => void;
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

const inferSourceType = (sourceUrl: string, fallback: 'local' | 'remote'): 'local' | 'remote' => {
  if (sourceUrl.startsWith('http://') || sourceUrl.startsWith('https://')) return 'remote';
  return fallback;
};

const IdeGsmFileCard: React.FC<{
  entry: IdeGsmFileEntry;
  sizeLabel: string;
  onRemove: (event: React.MouseEvent<HTMLButtonElement>) => void;
  removeLabel: string;
  disabled?: boolean;
}> = ({ entry, sizeLabel, onRemove, removeLabel, disabled }) => {
  const icon = entry.sourceType === 'remote' ? <CloudDownload fontSize="small" /> : <InsertDriveFile fontSize="small" />;
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
        onClick={onRemove}
        disabled={disabled}
      >
        <Close fontSize="small" />
      </IconButton>
    </Box>
  );
};

export const IdeGsmImportPanel: React.FC<IdeGsmImportPanelProps> = (props) => {
  const {
    disabled = false,
    labels,
    defaultDownloadUrl,
    accept = '.csv,.xlsx,.xls',
  } = props;
  const [localDialogOpen, setLocalDialogOpen] = useState(false);
  const [remoteDialogOpen, setRemoteDialogOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [lastAction, setLastAction] = useState<'local' | 'remote'>('local');
  const menuOpen = Boolean(menuAnchor);
  const isMulti = 'files' in props;
  const files = useMemo<IdeGsmFileEntry[]>(() => {
    if (isMulti) {
      return props.files;
    }
    if (props.fileName || props.sourceUrl) {
      const sourceUrl = props.sourceUrl ?? '';
      return [{
        fileName: props.fileName ?? labels.fileFallback,
        sourceUrl,
        sourceType: inferSourceType(sourceUrl, 'local'),
      }];
    }
    return [];
  }, [isMulti, labels.fileFallback, props]);

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });

  const closeDialogs = () => {
    setLocalDialogOpen(false);
    setRemoteDialogOpen(false);
  };

  const handleFileSelect = async (file: File, downloadUrl?: string) => {
    const sourceType = downloadUrl ? 'remote' : 'local';
    const nextUrl = downloadUrl ?? (await readFileAsDataUrl(file));
    const payload: IdeGsmFileEntry = {
      fileName: file.name,
      sourceUrl: nextUrl,
      sizeBytes: file.size,
      sourceType,
    };
    if (isMulti) {
      const hasDuplicate = props.files.some((entry) => {
        if (entry.sourceUrl === payload.sourceUrl) return true;
        return entry.fileName === payload.fileName && entry.sizeBytes === payload.sizeBytes;
      });
      if (!hasDuplicate) {
        props.onAddFile(payload);
      }
    } else {
      props.onChange(payload);
    }
    closeDialogs();
  };

  const handleRemove = (event: React.MouseEvent<HTMLButtonElement>, index: number) => {
    event.stopPropagation();
    if (isMulti) {
      props.onRemoveFile(index);
    } else {
      props.onClear();
    }
  };

  const mainButtonLabel = lastAction === 'remote' ? labels.importRemote : labels.importLocal;

  return (
    <>
      <Box
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
          {files.length > 0 ? (
            <Box display="flex" sx={{ flexFlow: 'row wrap', gap: 0.75 }}>
              {files.map((entry, index) => (
                <IdeGsmFileCard
                  key={`${entry.fileName}-${entry.sourceUrl}-${index}`}
                  entry={entry}
                  sizeLabel={formatBytes(entry.sizeBytes)}
                  onRemove={(event) => handleRemove(event, index)}
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
                onClick={(event) => {
                  event.stopPropagation();
                  if (lastAction === 'remote') {
                    setRemoteDialogOpen(true);
                  } else {
                    setLocalDialogOpen(true);
                  }
                }}
                disabled={disabled}
              >
                {mainButtonLabel}
              </Button>
              <Button
                onClick={(event) => {
                  event.stopPropagation();
                  setMenuAnchor(event.currentTarget);
                }}
                disabled={disabled}
              >
                <ArrowDropDown />
              </Button>
            </ButtonGroup>
            <Menu
              anchorEl={menuAnchor}
              open={menuOpen}
              onClose={() => setMenuAnchor(null)}
            >
              <MenuItem
                onClick={() => {
                  setMenuAnchor(null);
                  setLastAction('local');
                  setLocalDialogOpen(true);
                }}
              >
                <ListItemIcon>
                  <InsertDriveFile fontSize="small" />
                </ListItemIcon>
                {labels.importLocal}
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setMenuAnchor(null);
                  setLastAction('remote');
                  setRemoteDialogOpen(true);
                }}
              >
                <ListItemIcon>
                  <CloudDownload fontSize="small" />
                </ListItemIcon>
                {labels.importRemote}
              </MenuItem>
            </Menu>
          </Box>
        </Stack>
      </Box>
      <Dialog open={localDialogOpen} onClose={() => setLocalDialogOpen(false)} fullWidth maxWidth="sm">
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3, pt: 2 }}>
          <Typography variant="subtitle1">{labels.importLocal}</Typography>
          <IconButton aria-label="Close" onClick={() => setLocalDialogOpen(false)}>
            <Close />
          </IconButton>
        </Box>
        <DialogContent sx={{ pt: 1.5 }}>
          <FileInputWithUrl
            accept={accept}
            buttonLabel={labels.buttonLabel}
            instructions={labels.instructions}
            onFileSelect={handleFileSelect}
            disabled={disabled}
            mode="local"
          />
        </DialogContent>
      </Dialog>
      <Dialog open={remoteDialogOpen} onClose={() => setRemoteDialogOpen(false)} fullWidth maxWidth="sm">
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3, pt: 2 }}>
          <Typography variant="subtitle1">{labels.importRemote}</Typography>
          <IconButton aria-label="Close" onClick={() => setRemoteDialogOpen(false)}>
            <Close />
          </IconButton>
        </Box>
        <DialogContent sx={{ pt: 1.5 }}>
          <FileInputWithUrl
            accept={accept}
            buttonLabel={labels.buttonLabel}
            instructions={labels.instructions}
            defaultDownloadUrl={defaultDownloadUrl}
            onFileSelect={handleFileSelect}
            disabled={disabled}
            mode="url"
          />
        </DialogContent>
      </Dialog>
    </>
  );
};
