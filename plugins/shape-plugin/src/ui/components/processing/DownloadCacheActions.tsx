import { Button, Grid } from '@mui/material';
import {
  CloudDownload as CloudDownloadIcon,
  FilterAlt as FilterAltIcon,
  Filter as FilterIcon,
  Layers as LayersIcon,
} from '@mui/icons-material';
import { useTranslation } from '../../i18n.js';

type Props = {
  deleteLabel: string;
  canDeleteRaw: boolean;
  canDeleteStage1: boolean;
  canDeleteStage2: boolean;
  canDeleteTiles: boolean;
  onDeleteRaw: () => void;
  onDeleteStage: (stage: 'simplify1' | 'simplify2') => void;
  onDeleteTiles: () => void;
};

export const DownloadCacheActions: React.FC<Props> = ({
  deleteLabel,
  canDeleteRaw,
  canDeleteStage1,
  canDeleteStage2,
  canDeleteTiles,
  onDeleteRaw,
  onDeleteStage,
  onDeleteTiles,
}) => {
  const { t } = useTranslation();

  return (
    <Grid container spacing={1} sx={{ width: '100%' }}>
      <Grid size={{ xs: 12, sm: 6 }}>
        <Button
          fullWidth
          variant="outlined"
          color="error"
          startIcon={<CloudDownloadIcon />}
          disabled={!canDeleteRaw}
          onClick={onDeleteRaw}
        >
          {deleteLabel}
        </Button>
      </Grid>
      <Grid size={{ xs: 12, sm: 6 }}>
        <Button
          fullWidth
          variant="outlined"
          color="error"
          startIcon={<FilterAltIcon />}
          disabled={!canDeleteStage1}
          onClick={() => onDeleteStage('simplify1')}
        >
          {t('processing.download.deleteStage1Cache', 'Delete Stage1 Cache')}
        </Button>
      </Grid>
      <Grid size={{ xs: 12, sm: 6 }}>
        <Button
          fullWidth
          variant="outlined"
          color="error"
          startIcon={<FilterIcon />}
          disabled={!canDeleteStage2}
          onClick={() => onDeleteStage('simplify2')}
        >
          {t('processing.download.deleteStage2Cache', 'Delete Stage2 Cache')}
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
    </Grid>
  );
};
