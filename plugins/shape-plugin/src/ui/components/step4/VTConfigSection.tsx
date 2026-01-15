import { Accordion, AccordionDetails, AccordionSummary, Box, Card, CardContent, Grid, Stack, Typography, Slider, Tooltip } from '@mui/material';
import { Layers as LayersIcon, ExpandMore as ExpandMoreIcon, InfoOutlined as InfoOutlinedIcon } from '@mui/icons-material';
import type { ShapeEntity } from '../../../common/types/index.js';
import { WorkerNumberConfigCard } from './WorkerNumberConfigCard.js';
import { useTranslation } from '../../i18n.js';
import { useVTConfigSection } from './useVTConfigSection.ts';
import type { ShapeBuildConfig } from '../../../common/types/index.js';

type Props = {
  buildConfig: ShapeBuildConfig;
  draft?: Partial<ShapeEntity> | null;
  disabled?: boolean;
  onChange: (next: ShapeBuildConfig) => void;
};

export const VTConfigSection: React.FC<Props> = ({ buildConfig, disabled, onChange }) => {
  const { t } = useTranslation();
  const { update } = useVTConfigSection({ buildConfig, onChange });

  return (
    <Accordion defaultExpanded>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack direction="row" spacing={2} alignItems="center">
          <LayersIcon color="primary" />
          <Typography variant="subtitle1">
            {t('processing.tile.title', 'VT Generation')}
          </Typography>
          <Tooltip
            title={t(
              'processing.tile.descriptionTooltip',
              'Generate vector tiles for the selected zoom range.',
            )}
            placement="top"
          >
            <InfoOutlinedIcon color="action" fontSize="small" />
          </Tooltip>
        </Stack>
      </AccordionSummary>
      <AccordionDetails sx={{ p: 3 }}>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <WorkerNumberConfigCard
              icon={<LayersIcon fontSize="small" color="primary" />}
              title={t('processing.tile.workers', 'VT Worker Count')}
              value={buildConfig.vtConfig.concurrentProcesses ?? 2}
              helperText={t('processing.tile.workersHelp', 'Parallel workers for tile generation.')}
              warningText={undefined}
              onChange={(concurrentProcesses) =>
                update({
                    vtConfig: {
                      ...buildConfig.vtConfig,
                      concurrentProcesses,
                    },
                })
              }
              min={1}
              max={8}
              step={1}
              disabled={disabled}
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 12 }}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle2" gutterBottom>
                  {t('processing.tile.zoomBands', 'Zoom bands')}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>
                  {t(
                    'processing.tile.zoomBandsSummary',
                    'band0: z0-3\nband1: z3-6\nband2: z6-9\nband3: z9-11 (optional)',
                  )}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, sm: 4 }} style={{ paddingRight: '20px' }}>
            <Typography gutterBottom>
              {t('processing.tile.bufferSize', 'Tile Margin (px)')}
            </Typography>
            <Box sx={{ px: 2 }}>
              <Slider
                value={buildConfig.vtConfig.bufferSize ?? 256}
                onChange={(_, value: number | number[]) => {
                  const bufferSize = value as number;
                  update({
                    vtConfig: {
                      ...buildConfig.vtConfig,
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
              {t('processing.tile.expandFactor', 'Tile Expansion Factor')}
            </Typography>
            <Box sx={{ px: 2 }}>
              <Slider
                value={buildConfig.vtConfig.tileExpandFactor ?? 1}
                onChange={(_, value: number | number[]) => {
                  const tileExpandFactor = Number(value);
                  update({
                    vtConfig: {
                      ...buildConfig.vtConfig,
                      tileExpandFactor,
                    },
                  });
                }}
                min={0}
                max={3}
                step={0.1}
                marks={[
                  { value: 0, label: '0' },
                  { value: 1, label: '1' },
                  { value: 2, label: '2' },
                  { value: 3, label: '3' },
                ]}
                valueLabelDisplay="auto"
                disabled={disabled}
              />
            </Box>
            <Typography variant="caption" color="text.secondary">
              {t('processing.tile.expandFactorHelp', 'Extra tiles to include around each group when building TopoJSON.')}
            </Typography>
          </Grid>

          <Grid size={{ xs: 12, sm: 4 }} style={{ paddingRight: '20px' }}>
            <Typography gutterBottom>
              {t('processing.tile.expandMargin', 'Tile Expansion Margin')}
            </Typography>
            <Box sx={{ px: 2 }}>
              <Slider
                value={buildConfig.vtConfig.tileExpandMargin ?? 0}
                onChange={(_, value: number | number[]) => {
                  const tileExpandMargin = Number(value);
                  update({
                    vtConfig: {
                      ...buildConfig.vtConfig,
                      tileExpandMargin,
                    },
                  });
                }}
                min={0}
                max={2}
                step={0.1}
                marks={[
                  { value: 0, label: '0' },
                  { value: 0.5, label: '0.5' },
                  { value: 1, label: '1' },
                  { value: 2, label: '2' },
                ]}
                valueLabelDisplay="auto"
                disabled={disabled}
              />
            </Box>
            <Typography variant="caption" color="text.secondary">
              {t('processing.tile.expandMarginHelp', 'Additional margin in tile units for neighbor selection.')}
            </Typography>
          </Grid>
        </Grid>
      </AccordionDetails>
    </Accordion>
  );
};
