import { Button, Grid, Stack, Typography } from '@mui/material';
import {
  CloudDownload as CloudDownloadIcon,
  Description as DescriptionIcon,
  FilterAlt as FilterAltIcon,
  Layers as LayersIcon,
} from '@mui/icons-material';
import { useTranslation } from '~/ui/i18n';
import { LoadingButton } from '@hierarchidb/components';

type Props = {
  deleteSourceApiLabel: string;
  deleteSourceFilteredLabel: string;
  deleteGeometryCacheLabel: string;
  deleteTileEmitLabel: string;
  deleteMetadataLabel: string;
  countsLoading?: boolean;
  deleteSourceApiLoading?: boolean;
  deleteSourceFilteredLoading?: boolean;
  deleteGeometryLoading?: boolean;
  deleteTileEmitLoading?: boolean;
  deleteMetadataLoading?: boolean;
  canDeleteSourceApiCache: boolean;
  canDeleteSourceFilteredCache: boolean;
  canDeleteGeometryCache: boolean;
  canDeleteTileEmitCache: boolean;
  canDeleteMetadata: boolean;
  resetDisabled?: boolean;
  onDeleteSourceApiCache: () => void;
  onDeleteSourceFilteredCache: () => void;
  onDeleteGeometryCache: () => void;
  onDeleteTileEmitCache: () => void;
  onDeleteMetadata: () => void;
  onResetDefaults: () => void;
};

export const SourceConfigFormControls: React.FC<Props> = ({
  deleteSourceApiLabel,
  deleteSourceFilteredLabel,
  deleteGeometryCacheLabel,
  deleteTileEmitLabel,
  deleteMetadataLabel,
  countsLoading = false,
  deleteSourceApiLoading = false,
  deleteSourceFilteredLoading = false,
  deleteGeometryLoading = false,
  deleteTileEmitLoading = false,
  deleteMetadataLoading = false,
  canDeleteSourceApiCache,
  canDeleteSourceFilteredCache,
  canDeleteGeometryCache,
  canDeleteTileEmitCache,
  canDeleteMetadata,
  resetDisabled,
  onDeleteSourceApiCache,
  onDeleteSourceFilteredCache,
  onDeleteGeometryCache,
  onDeleteTileEmitCache,
  onDeleteMetadata,
  onResetDefaults,
}) => {
  const { t } = useTranslation();
  const apiDisabled = countsLoading || deleteSourceApiLoading || !canDeleteSourceApiCache;
  const filteredDisabled = countsLoading || deleteSourceFilteredLoading || !canDeleteSourceFilteredCache;
  const geometryDisabled = deleteGeometryLoading || !canDeleteGeometryCache;
  const tileEmitDisabled = deleteTileEmitLoading || !canDeleteTileEmitCache;
  const metadataDisabled = deleteMetadataLoading || !canDeleteMetadata;

  return (
    <>
      <Grid container spacing={1} sx={{ width: '100%' }}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <LoadingButton
            fullWidth
            variant="outlined"
            color="error"
            startIcon={<CloudDownloadIcon />}
            disabled={apiDisabled}
            loading={deleteSourceApiLoading}
            onClick={onDeleteSourceApiCache}
          >
            <Typography
              component="span"
              sx={{ display: 'inline-flex', alignItems: 'center', minHeight: '1.2em' }}
            >
              {deleteSourceApiLabel}
            </Typography>
          </LoadingButton>
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <LoadingButton
            fullWidth
            variant="outlined"
            color="error"
            startIcon={<FilterAltIcon />}
            disabled={filteredDisabled}
            loading={deleteSourceFilteredLoading}
            onClick={onDeleteSourceFilteredCache}
          >
            {deleteSourceFilteredLabel}
          </LoadingButton>
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <LoadingButton
            fullWidth
            variant="outlined"
            color="error"
            startIcon={<FilterAltIcon />}
            disabled={geometryDisabled}
            loading={deleteGeometryLoading}
            onClick={onDeleteGeometryCache}
          >
            {deleteGeometryCacheLabel}
          </LoadingButton>
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <LoadingButton
            fullWidth
            variant="outlined"
            color="error"
            startIcon={<LayersIcon />}
            disabled={tileEmitDisabled}
            loading={deleteTileEmitLoading}
            onClick={onDeleteTileEmitCache}
          >
            {deleteTileEmitLabel}
          </LoadingButton>
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <LoadingButton
            fullWidth
            variant="outlined"
            color="error"
            startIcon={<DescriptionIcon />}
            disabled={metadataDisabled}
            loading={deleteMetadataLoading}
            onClick={onDeleteMetadata}
          >
            {deleteMetadataLabel}
          </LoadingButton>
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Button
            fullWidth
            variant="outlined"
            color="warning"
            disabled={resetDisabled}
            onClick={onResetDefaults}
          >
            {t('processing.download.resetDefaultsAction', 'Reset to defaults')}
          </Button>
        </Grid>
      </Grid>
      <Stack spacing={0.5}>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ visibility: countsLoading ? 'visible' : 'hidden' }}
        >
          {t('processing.download.deleteLoadingHint', 'Loading delete counts...')}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {t(
            'processing.download.deleteApiCacheHelp',
            'API cache: downloaded raw data for this node (before filtering).',
          )}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {t(
            'processing.download.deleteFilteredCacheHelp',
            'Filtered cache: source-stage filtered feature collections per zoom band.',
          )}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {t(
            'processing.download.deleteGeometryHelp',
            'Simplified cache: simplified geometries by zoom band plus geometry error records.',
          )}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {t(
            'processing.download.deleteTileEmitHelp',
            'TileEmit data: generated vector tiles (tile index is also cleared).',
          )}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {t(
            'processing.download.deleteMetadataHelp',
            'Feature metadata for search/preview (does not remove tiles).',
          )}
        </Typography>

      </Stack>
    </>
  );
};
