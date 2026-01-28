import { Button, Grid, Stack, Typography } from '@mui/material';
import {
  CloudDownload as CloudDownloadIcon,
  Description as DescriptionIcon,
  FilterAlt as FilterAltIcon,
  Layers as LayersIcon,
} from '@mui/icons-material';
import { useTranslation } from '../../i18n.js';

type Props = {
  deleteFetchApiLabel: string;
  deleteFetchFilteredLabel: string;
  deleteTransformFilterLabel: string;
  deleteVTLabel: string;
  deleteMetadataLabel: string;
  countsLoading?: boolean;
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
  const apiDisabled = countsLoading || !canDeleteFetchApiCache;
  const filteredDisabled = countsLoading || !canDeleteFetchFilteredCache;

  return (
    <>
      <Grid container spacing={1} sx={{ width: '100%' }}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Button
            fullWidth
            variant="outlined"
            color="error"
            startIcon={<CloudDownloadIcon />}
            disabled={apiDisabled}
            onClick={onDeleteFetchApiCache}
          >
            <Typography
              component="span"
              sx={{ display: 'inline-flex', alignItems: 'center', minHeight: '1.2em' }}
            >
              {deleteFetchApiLabel}
            </Typography>
          </Button>
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Button
            fullWidth
            variant="outlined"
            color="error"
            startIcon={<FilterAltIcon />}
            disabled={filteredDisabled}
            onClick={onDeleteFetchFilteredCache}
          >
            {deleteFetchFilteredLabel}
          </Button>
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Button
            fullWidth
            variant="outlined"
            color="error"
            startIcon={<FilterAltIcon />}
            disabled={!canDeleteTransformCache}
            onClick={onDeleteTransformCache}
          >
            {deleteTransformFilterLabel}
          </Button>
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Button
            fullWidth
            variant="outlined"
            color="error"
            startIcon={<LayersIcon />}
            disabled={!canDeleteVTCache}
            onClick={onDeleteVTCache}
          >
            {deleteVTLabel}
          </Button>
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Button
            fullWidth
            variant="outlined"
            color="error"
            startIcon={<DescriptionIcon />}
            disabled={!canDeleteMetadata}
            onClick={onDeleteMetadata}
          >
            {deleteMetadataLabel}
          </Button>
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
            'Tile index + tile data cache: generated vector tiles and tile relations (also clears feature/source metadata). Transform cache is preserved.',
          )}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {t(
            'processing.download.deleteMetadataHelp',
            'Metadata: feature and source metadata for search/preview (does not remove tiles).',
          )}
        </Typography>

      </Stack>
    </>
  );
};
