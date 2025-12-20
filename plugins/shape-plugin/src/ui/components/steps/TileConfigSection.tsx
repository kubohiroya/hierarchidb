import { Accordion, AccordionDetails, AccordionSummary, Grid, Stack, Typography, Slider } from '@mui/material';
import { Layers as LayersIcon, ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import type { ProcessingConfig, TileProcessingConfig } from '../../../common/types/index.js';
import { DEFAULT_PROCESSING_CONFIG, mergeProcessingConfig } from '../../../common/types/index.js';
import { WorkerNumberConfigCard } from './WorkerNumberConfigCard.js';

type Props = {
  config: ProcessingConfig;
  disabled?: boolean;
  onChange: (next: ProcessingConfig) => void;
};

export const TileConfigSection: React.FC<Props> = ({ config, disabled, onChange }) => {
  const baseTileConfig: TileProcessingConfig|undefined = config.tileConfig ?? DEFAULT_PROCESSING_CONFIG.tileConfig;

  const update = (partial: Partial<ProcessingConfig>) => {
    onChange(mergeProcessingConfig({ ...config, ...partial }));
  };

  if(!baseTileConfig){
    throw new Error("TileConfigSection: baseTileConfig is not defined");
  }

  return (
    <Accordion defaultExpanded>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack direction="row" spacing={2} alignItems="center">
          <LayersIcon color="primary" />
          <Typography variant="subtitle1">Tile Generation Setting</Typography>
        </Stack>
      </AccordionSummary>
      <AccordionDetails sx={{ p: 3 }}>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <WorkerNumberConfigCard
              icon={<LayersIcon fontSize="small" color="primary" />}
              title="Tile Workers"
              value={baseTileConfig.workers ?? 2}
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
            <Typography gutterBottom>Tile Buffer Size (px)</Typography>
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
          </Grid>

          <Grid size={{ xs: 12, sm: 4 }} style={{ paddingRight: '20px' }}>
            <Typography gutterBottom>Max Zoom Level</Typography>
            <Slider
              value={baseTileConfig.maxZoom ?? 12}
              onChange={(_, value: number | number[]) => {
                const maxZoom = value as number;
                update({
                  tileConfig: {
                    ...baseTileConfig,
                    maxZoom,
                  },
                });
              }}
              min={8}
              max={18}
              step={1}
              marks={[{ value: 8, label: '8' }, { value: 12, label: '12' }, { value: 18, label: '18' }]}
              valueLabelDisplay="auto"
              disabled={disabled}
            />
          </Grid>
        </Grid>
      </AccordionDetails>
    </Accordion>
  );
};
