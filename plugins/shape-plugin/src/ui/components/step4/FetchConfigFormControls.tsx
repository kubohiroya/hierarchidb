import { Button, Grid, Stack, Typography } from '@mui/material';
import {
  CloudDownload as CloudDownloadIcon,
  Description as DescriptionIcon,
  Filter as FilterIcon,
  FilterAlt as FilterAltIcon,
  Layers as LayersIcon,
} from '@mui/icons-material';
import { useTranslation } from '../../i18n.js';

type Props = {
  deleteFetchLabel: string;
  deleteTransformFilterLabel: string;
  deleteTransformPreprocessLabel: string;
  deleteVTLabel: string;
  deleteMetadataLabel: string;
  countsLoading?: boolean;
  canDeleteFetchCache: boolean;
  canDeleteTransformCache: boolean;
  canDeleteTransformByZoomCache: boolean;
  canDeleteVTCache: boolean;
  canDeleteMetadata: boolean;
  resetDisabled?: boolean;
  onDeleteFetchCache: () => void;
  onDeleteTransformCache: () => void;
  onDeleteTransformByZoomCache: () => void;
  onDeleteVTCache: () => void;
  onDeleteMetadata: () => void;
  onResetDefaults: () => void;
};

export const FetchConfigFormControls: React.FC<Props> = ({
  deleteFetchLabel,
  deleteTransformFilterLabel,
  deleteTransformPreprocessLabel,
  deleteVTLabel,
  deleteMetadataLabel,
  countsLoading = false,
  canDeleteFetchCache,
  canDeleteTransformCache,
  canDeleteTransformByZoomCache,
  canDeleteVTCache,
  canDeleteMetadata,
  resetDisabled,
  onDeleteFetchCache,
  onDeleteTransformCache,
  onDeleteTransformByZoomCache,
  onDeleteVTCache,
  onDeleteMetadata,
  onResetDefaults,
}) => {
  const { t } = useTranslation();
  const rawDisabled = countsLoading || !canDeleteFetchCache;

  return (
    <>
      <Grid container spacing={1} sx={{ width: '100%' }}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Button
            fullWidth
            variant="outlined"
            color="error"
            startIcon={<CloudDownloadIcon />}
            disabled={rawDisabled}
            onClick={onDeleteFetchCache}
          >
            <Typography
              component="span"
              sx={{ display: 'inline-flex', alignItems: 'center', minHeight: '1.2em' }}
            >
              {deleteFetchLabel}
            </Typography>
          </Button>
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Button
            fullWidth
            variant="outlined"
            color="error"
            startIcon={<FilterAltIcon />}
            disabled={!canDeleteTransformCache}
            onClick={() => onDeleteTransformCache()}
          >
            {deleteTransformFilterLabel}
          </Button>
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Button
            fullWidth
            variant="outlined"
            color="error"
            startIcon={<FilterIcon />}
            disabled={!canDeleteTransformByZoomCache}
            onClick={() => onDeleteTransformByZoomCache()}
          >
            {deleteTransformPreprocessLabel}
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

      </Stack>
    </>
  );
};
