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
} from "@mui/material";
import { Delete as DeleteIcon, Info } from "@mui/icons-material";
import { useState } from "react";

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
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteResult, setDeleteResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const handleDeleteCache = async () => {
    setIsDeleting(true);
    setDeleteResult(null);

    try {
      const stats = await config.getStats(nodeId);
      await config.deleteCache(nodeId);

      const sizeInMB = (stats.totalSize / 1024 / 1024).toFixed(2);
      const message = stats.details
        ? `Successfully deleted ${stats.details} (${sizeInMB} MB)`
        : `Successfully deleted ${stats.itemCount} items (${sizeInMB} MB)`;

      setDeleteResult({
        success: true,
        message,
      });
    } catch (error) {
      console.error(`Failed to delete cache:`, error);
      setDeleteResult({
        success: false,
        message: "Failed to delete cache",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Box sx={sx}>
      <Alert severity={severity} sx={{ p: 2 }}>
        <Stack spacing={2}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
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
                onChange={(e) => onDeleteOnCompleteChange(e.target.checked)}
                size="small"
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
              startIcon={
                isDeleting ? <CircularProgress size={16} /> : <DeleteIcon />
              }
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
            <Alert
              severity={deleteResult.success ? "success" : "error"}
              sx={{ mt: 1 }}
            >
              {deleteResult.message}
            </Alert>
          )}
        </Stack>
      </Alert>
    </Box>
  );
}