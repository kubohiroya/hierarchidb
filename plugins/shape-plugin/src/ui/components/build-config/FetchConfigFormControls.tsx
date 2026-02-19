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
  deleteFetchApiLabel: string;
  deleteFetchFilteredLabel: string;
  deleteTransformFilterLabel: string;
  deleteVTLabel: string;
  deleteMetadataLabel: string;
  countsLoading?: boolean;
  deleteFetchApiLoading?: boolean;
  deleteFetchFilteredLoading?: boolean;
  deleteTransformLoading?: boolean;
  deleteVTLoading?: boolean;
  deleteMetadataLoading?: boolean;
  canDeleteFetchApiCache: boolean;
  canDeleteFetchFilteredCache: boolean;
  canDeleteTransformCache: boolean;
  canDeleteVTCache: boolean;
  canDeleteMetadata: boolean;
  resetDisabled?: boolean;
  onDeleteFetchApiCache: () => void;
  onDeleteFetchFilteredCache: () => void;
  onDeleteTransformCache: () => void;
  onDeleteVTCache: () => void;
  onDeleteMetadata: () => void;
  onResetDefaults: () => void;
};

export const FetchConfigFormControls: React.FC<Props> = ({
  deleteFetchApiLabel,
  deleteFetchFilteredLabel,
  deleteTransformFilterLabel,
  deleteVTLabel,
  deleteMetadataLabel,
  countsLoading = false,
  deleteFetchApiLoading = false,
  deleteFetchFilteredLoading = false,
  deleteTransformLoading = false,
  deleteVTLoading = false,
  deleteMetadataLoading = false,
  canDeleteFetchApiCache,
  canDeleteFetchFilteredCache,
  canDeleteTransformCache,
  canDeleteVTCache,
  canDeleteMetadata,
  resetDisabled,
  onDeleteFetchApiCache,
  onDeleteFetchFilteredCache,
  onDeleteTransformCache,
  onDeleteVTCache,
  onDeleteMetadata,
  onResetDefaults,
}) => {
  const { t } = useTranslation();
  const apiDisabled = countsLoading || deleteFetchApiLoading || !canDeleteFetchApiCache;
  const filteredDisabled = countsLoading || deleteFetchFilteredLoading || !canDeleteFetchFilteredCache;
  const transformDisabled = deleteTransformLoading || !canDeleteTransformCache;
  const vtDisabled = deleteVTLoading || !canDeleteVTCache;
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
            loading={deleteFetchApiLoading}
            onClick={onDeleteFetchApiCache}
          >
            <Typography
              component="span"
              sx={{ display: 'inline-flex', alignItems: 'center', minHeight: '1.2em' }}
            >
              {deleteFetchApiLabel}
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
            loading={deleteFetchFilteredLoading}
            onClick={onDeleteFetchFilteredCache}
          >
            {deleteFetchFilteredLabel}
          </LoadingButton>
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <LoadingButton
            fullWidth
            variant="outlined"
            color="error"
            startIcon={<FilterAltIcon />}
            disabled={transformDisabled}
            loading={deleteTransformLoading}
            onClick={onDeleteTransformCache}
          >
            {deleteTransformFilterLabel}
          </LoadingButton>
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <LoadingButton
            fullWidth
            variant="outlined"
            color="error"
            startIcon={<LayersIcon />}
            disabled={vtDisabled}
            loading={deleteVTLoading}
            onClick={onDeleteVTCache}
          >
            {deleteVTLabel}
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
            'Filtered cache: fetch-stage filtered feature collections per zoom band.',
          )}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {t(
            'processing.download.deleteTransformHelp',
            'Simplified cache: simplified geometries by zoom band plus transform error records.',
          )}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {t(
            'processing.download.deleteVtHelp',
            'Tile data: generated vector tiles (tile index is also cleared).',
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
