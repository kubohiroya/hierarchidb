import { Delete as DeleteIcon, Info } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControlLabel,
  IconButton,
  Stack,
  Switch,
  Tooltip,
  Typography,
} from '@mui/material';
import { useCacheSection } from './useCacheSection.js';
import { useCacheSectionView } from './useCacheSectionView.js';

export interface CacheStats {
  itemCount: number;
  totalSize: number;
  details?: string;
}

export interface CacheConfig {
  title: string;
  tooltipText: string;
  deleteButtonText: string;
  dataTypeLabel: string;
  getStats: (nodeId: string) => Promise<CacheStats>;
  deleteCache: (nodeId: string) => Promise<void>;
}

interface CacheSectionProps {
  nodeId: string;
  deleteOnComplete: boolean;
  onDeleteOnCompleteChange: (checked: boolean) => void;
  config: CacheConfig;
  /** Custom styling */
  sx?: object;
  /** Alert severity level */
  severity?: 'warning' | 'info' | 'error' | 'success';
}

export function CacheSection({
  nodeId,
  deleteOnComplete,
  onDeleteOnCompleteChange,
  config,
  sx = {},
  severity = 'warning',
}: CacheSectionProps) {
  const { isDeleting, deleteResult, handleDeleteCache, handleDeleteOnCompleteChange } =
    useCacheSectionView({
      nodeId,
      config,
      onDeleteOnCompleteChange,
    });
  const { switchInputProps, onDeleteOnCompleteSwitchChange } = useCacheSection({
    onDeleteOnCompleteChange: handleDeleteOnCompleteChange,
  });

  return (
    <Box sx={sx}>
      <Alert severity={severity} sx={{ p: 2 }}>
        <Stack spacing={2}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6" fontWeight="bold">
              {config.title}
            </Typography>
            <Tooltip title={config.tooltipText} placement="top">
              <IconButton size="small">
                <Info fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>

          <FormControlLabel
            control={
              <Switch
                checked={deleteOnComplete}
                onChange={(event) => onDeleteOnCompleteSwitchChange(event.target.checked)}
                size="small"
                inputProps={switchInputProps}
              />
            }
            label="Delete cache automatically when this session completes"
            sx={{ ml: 0 }}
          />

          <Stack direction="row" spacing={2} alignItems="center">
            <Button
              variant="outlined"
              color="error"
              size="small"
              startIcon={isDeleting ? <CircularProgress size={16} /> : <DeleteIcon />}
              onClick={handleDeleteCache}
              disabled={isDeleting}
            >
              {config.deleteButtonText}
            </Button>
            <Typography variant="caption" color="text.secondary">
              {config.dataTypeLabel}
            </Typography>
          </Stack>

          {deleteResult && (
            <Alert severity={deleteResult.success ? 'success' : 'error'} sx={{ mt: 1 }}>
              {deleteResult.message}
            </Alert>
          )}
        </Stack>
      </Alert>
    </Box>
  );
}
