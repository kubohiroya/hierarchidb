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
  canDeleteRaw: boolean;
  canDeleteStage1: boolean;
  canDeleteStage2: boolean;
  canDeleteTiles: boolean;
  canDeleteMetadata: boolean;
  resetDisabled?: boolean;
  onDeleteRaw: () => void;
  onDeleteStage: (stage: 'extract1' | 'extract2') => void;
  onDeleteTiles: () => void;
  onDeleteMetadata: () => void;
  onResetDefaults: () => void;
};

export const DownloadCacheActions: React.FC<Props> = ({
                                                        deleteLabel,
                                                        countsLoading = false,
                                                        canDeleteRaw,
                                                        canDeleteStage1,
                                                        canDeleteStage2,
                                                        canDeleteTiles,
                                                        canDeleteMetadata,
                                                        resetDisabled,
                                                        onDeleteRaw,
                                                        onDeleteStage,
                                                        onDeleteTiles,
                                                        onDeleteMetadata,
                                                        onResetDefaults,
                                                      }) => {
  const { t } = useTranslation();
  const rawDisabled = countsLoading || !canDeleteRaw;

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
            onClick={onDeleteRaw}
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
            disabled={!canDeleteStage1}
            onClick={() => onDeleteStage('extract1')}
          >
            {t('processing.download.deleteStage1Cache', 'Delete extract1 cache')}
          </Button>
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Button
            fullWidth
            variant="outlined"
            color="error"
            startIcon={<FilterIcon />}
            disabled={!canDeleteStage2}
            onClick={() => onDeleteStage('extract2')}
          >
            {t('processing.download.deleteStage2Cache', 'Delete extract2 cache')}
          </Button>
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Button
            fullWidth
            variant="outlined"
            color="error"
            startIcon={<LayersIcon />}
            disabled={!canDeleteTiles}
            onClick={onDeleteTiles}
          >
            {t('processing.download.deleteTiles', 'Delete Tiles')}
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
