import { Accordion, AccordionDetails, AccordionSummary, Box, Grid, Stack, Typography, Slider } from '@mui/material';
import { Layers as LayersIcon, ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import type { BatchConfig } from '../../../common/types/index.js';
import { WorkerNumberConfigCard } from './WorkerNumberConfigCard.js';
import { useTranslation } from '../../i18n.js';
import { useTileConfigSection } from '../../hooks/useTileConfigSection.js';

type Props = {
  config: BatchConfig;
  disabled?: boolean;
  onChange: (next: BatchConfig) => void;
};

export const TileConfigSection: React.FC<Props> = ({ config, disabled, onChange }) => {
  const { t } = useTranslation();
  const { baseTileConfig, zoomRange, update } = useTileConfigSection({ config, disabled, onChange });

  return (
    <Accordion defaultExpanded>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack direction="row" spacing={2} alignItems="center">
          <LayersIcon color="primary" />
          <Typography variant="subtitle1">
            {t('processing.tile.title', 'Tile Generation Setting')}
          </Typography>
        </Stack>
      </AccordionSummary>
      <AccordionDetails sx={{ p: 3 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('processing.tile.description', 'Generate vector tiles with zoom-aware simplification.')}
        </Typography>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <WorkerNumberConfigCard
              icon={<LayersIcon fontSize="small" color="primary" />}
              title={t('processing.tile.workers', 'Tile Worker Count')}
              value={baseTileConfig.workers ?? 2}
              helperText={t('processing.tile.workersHelp', 'Parallel workers for tile generation.')}
              onChange={(workers) =>
                update({
                  tileConfig: {
                    ...baseTileConfig,
                    workers,
                  },
                })
              }
              min={1}
              max={8}
              step={1}
              disabled={disabled}
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 4 }} style={{ paddingRight: '20px' }}>
            <Typography gutterBottom>
              {t('processing.tile.bufferSize', 'Tile Margin (px)')}
            </Typography>
            <Box sx={{ px: 2 }}>
              <Slider
                value={baseTileConfig.bufferSize ?? 256}
                onChange={(_, value: number | number[]) => {
                  const bufferSize = value as number;
                  update({
                    tileConfig: {
                      ...baseTileConfig,
                      bufferSize,
                    },
                  });
                }}
                min={0}
                max={512}
                step={32}
                marks={[{ value: 0, label: '0' }, { value: 256, label: '256' }, { value: 512, label: '512' }]}
                valueLabelDisplay="auto"
                disabled={disabled}
              />
            </Box>
            <Typography variant="caption" color="text.secondary">
              {t('processing.tile.bufferSizeHelp', 'Extra margin around tile edges to reduce visual seams.')}
            </Typography>
          </Grid>

          <Grid size={{ xs: 12, sm: 4 }} style={{ paddingRight: '20px' }}>
            <Typography gutterBottom>
              {t('processing.tile.zoomRange', 'Zoom Range')}
            </Typography>
            <Box sx={{ px: 2 }}>
              <Slider
                value={zoomRange}
                onChange={(_, value: number[]) => {
                  const [nextMin, nextMax] = value as number[];
                  if(nextMin && nextMax) {
                    update({
                      tileConfig: {
                        ...baseTileConfig,
                        minZoom: nextMin,
                        maxZoom: nextMax,
                      },
                    });
                  }
                }}
                min={0}
                max={18}
                step={1}
                marks={[{ value: 0, label: '0' }, { value: 8, label: '8' }, { value: 12, label: '12' }, { value: 18, label: '18' }]}
                valueLabelDisplay="auto"
                disabled={disabled}
              />
            </Box>
            <Typography variant="caption" color="text.secondary">
              {t('processing.tile.zoomRangeHelp', 'Generate tiles within this zoom range.')}
            </Typography>
          </Grid>
        </Grid>
      </AccordionDetails>
    </Accordion>
  );
};
