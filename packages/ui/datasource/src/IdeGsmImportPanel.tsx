import { Close, InsertDriveFile } from '@mui/icons-material';
import {
  Box,
  Button,
  Dialog,
  DialogContent,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import type React from 'react';
import { useState } from 'react';
import { FileInputWithUrl } from '@hierarchidb/ui-file';

export type IdeGsmImportLabels = {
  noFiles: string;
  importLocal: string;
  importRemote: string;
  fileFallback: string;
  removeFile: string;
  buttonLabel: string;
  instructions: string;
};

export interface IdeGsmImportPanelProps {
  fileName?: string;
  sourceUrl?: string;
  disabled?: boolean;
  labels: IdeGsmImportLabels;
  defaultDownloadUrl?: string;
  accept?: string;
  onChange: (payload: { fileName: string; sourceUrl: string }) => void;
  onClear: () => void;
}

export const IdeGsmImportPanel: React.FC<IdeGsmImportPanelProps> = ({
  fileName,
  sourceUrl,
  disabled = false,
  labels,
  defaultDownloadUrl,
  accept = '.csv,.xlsx,.xls',
  onChange,
  onClear,
}) => {
  const [localDialogOpen, setLocalDialogOpen] = useState(false);
  const [remoteDialogOpen, setRemoteDialogOpen] = useState(false);
  const hasFile = Boolean(fileName || sourceUrl);
  const displayLabel = fileName ?? sourceUrl ?? labels.fileFallback;

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
    const nextUrl = downloadUrl ?? (await readFileAsDataUrl(file));
    onChange({ fileName: file.name, sourceUrl: nextUrl });
    closeDialogs();
  };

  const handleClear = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onClear();
  };

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
        {hasFile ? (
          <Box display="flex" alignItems="center" justifyContent="space-between" gap={1}>
            <Box display="flex" alignItems="center" gap={1} sx={{ minWidth: 0 }}>
              <InsertDriveFile fontSize="small" color="action" />
              <Typography variant="body2" noWrap title={displayLabel}>
                {displayLabel}
              </Typography>
            </Box>
            <IconButton
              size="small"
              aria-label={labels.removeFile}
              onClick={handleClear}
              disabled={disabled}
            >
              <Close fontSize="small" />
            </IconButton>
          </Box>
        ) : (
          <Stack spacing={1}>
            <Typography variant="body2" color="text.secondary">
              {labels.noFiles}
            </Typography>
            <Stack
              direction="row"
              spacing={1}
              useFlexGap
              flexWrap="wrap"
              onClick={(event) => event.stopPropagation()}
            >
              <Button
                variant="outlined"
                color="secondary"
                size="small"
                disabled={disabled}
                onClick={(event) => {
                  event.stopPropagation();
                  setLocalDialogOpen(true);
                }}
              >
                {labels.importLocal}
              </Button>
              <Button
                variant="outlined"
                color="secondary"
                size="small"
                disabled={disabled}
                onClick={(event) => {
                  event.stopPropagation();
                  setRemoteDialogOpen(true);
                }}
              >
                {labels.importRemote}
              </Button>
            </Stack>
          </Stack>
        )}
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
