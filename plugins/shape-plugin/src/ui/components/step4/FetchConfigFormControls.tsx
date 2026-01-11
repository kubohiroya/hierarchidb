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
  deleteLabel: string;
  countsLoading?: boolean;
  canDeleteFetch: boolean;
  canDeleteFetchCache: boolean;
  canDeleteTransformCache: boolean;
  canDeleteVTCache: boolean;
  canDeleteMetadata: boolean;
  resetDisabled?: boolean;
  onDeleteFetchCache: () => void;
  onDeleteTransformCache: () => void;
  onDeleteVTCache: () => void;
  onDeleteMetadata: () => void;
  onResetDefaults: () => void;
};

export const FetchConfigFormControls: React.FC<Props> = ({
                                                        deleteLabel,
                                                        countsLoading = false,
                                                        canDeleteFetch,
                                                        canDeleteFetchCache,
                                                        canDeleteTransformCache,
                                                        canDeleteVTCache,
                                                        canDeleteMetadata,
                                                        resetDisabled,
                                                        onDeleteFetchCache,
                                                        onDeleteTransformCache,
                                                        onDeleteVTCache,
                                                        onDeleteMetadata,
                                                        onResetDefaults,
                                                      }) => {
  const { t } = useTranslation();
  const rawDisabled = countsLoading || !canDeleteFetch;

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
              {deleteLabel}
            </Typography>
          </Button>
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Button
            fullWidth
            variant="outlined"
            color="error"
            startIcon={<FilterAltIcon />}
            disabled={!canDeleteFetchCache}
            onClick={() => onDeleteTransformCache()}
          >
            {t('processing.download.deleteStage1Cache', 'Delete transform cache (filtering)')}
          </Button>
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Button
            fullWidth
            variant="outlined"
            color="error"
            startIcon={<FilterIcon />}
            disabled={!canDeleteTransformCache}
            onClick={() => onDeleteTransformCache()}
          >
            {t('processing.download.deleteStage2Cache', 'Delete transform cache (preprocessing)')}
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
            {t('processing.download.deleteTiles', 'Delete vt cache')}
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
            {t('processing.download.deleteMetadata', 'Delete Metadata')}
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
