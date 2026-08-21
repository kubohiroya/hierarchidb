import { Box, Divider, Paper, Stack, Tooltip, Typography, useTheme } from '@mui/material';
import { Allotment } from 'allotment';
import type { ShapeBuildConfig } from '~/common/types/BuildTaskResult';
import type { TaskDetailSelection } from '~/ui/components/build-progress/TaskItemCard/TaskItemDetailTypes';
import { FeaturePreviewLauncherButtonGroupCard } from './FeaturePreviewLauncherButtonGroupCard';
import { TileEmitGeometryPreviewMap } from './TileEmitGeometryPreviewMap';
import 'allotment/dist/style.css';
import { useTileEmitTaskItemDetailPreview } from './useTileEmitTaskItemDetailPreview.js';

const numberFormatter = new Intl.NumberFormat('en-US');

const formatBytesToKb = (bytes: number | null | undefined): string => {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) return 'N/A';
  return `${numberFormatter.format(Math.round(bytes / 1024))} kB`;
};

const formatNumber = (value: number | null | undefined): string => {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'N/A';
  return numberFormatter.format(Math.round(value));
};

type TileEmitTaskItemDetailWindowProps = {
  detail: TaskDetailSelection;
  buildConfig?: ShapeBuildConfig;
};

export const TileEmitTaskItemDetailWindow = ({
  detail,
  buildConfig,
}: TileEmitTaskItemDetailWindowProps) => {
  const theme = useTheme();
  const {
    previewData,
    selectedFeatureId,
    setSelectedFeatureId,
    hoveredFeatureId,
    setHoveredFeatureId,
    loading,
    tileEmitConfig,
    tileBuffer,
    effectiveIndexMaxPoints,
    handleResetSelection,
  } = useTileEmitTaskItemDetailPreview({ detail, buildConfig });
  const isWarningResult = detail.task.metadata?.resultSeverity === 'warning';

  return (
    <Paper variant="outlined" sx={{ p: 1.5 }}>
      <Stack spacing={1.5}>
        {isWarningResult ? (
          <Paper
            variant="outlined"
            sx={{ p: 1.5, borderColor: 'warning.main', bgcolor: 'warning.50' }}
          >
            <Stack spacing={0.5}>
              <Typography variant="subtitle2" color="warning.dark">
                ⚠ {detail.summary.summaryLine}
              </Typography>
              {detail.summary.detailLines?.map((line) => (
                <Typography key={line} variant="caption" color="text.secondary">
                  {line}
                </Typography>
              ))}
            </Stack>
          </Paper>
        ) : null}
        {previewData.tileBBox && previewData.bufferBBox ? (
          <Box sx={{ width: '100%', height: 480 }}>
            <Allotment vertical>
              <Allotment.Pane minSize={300} preferredSize={300}>
                <Allotment>
                  <Allotment.Pane minSize={300} preferredSize={300}>
                    <TileEmitGeometryPreviewMap
                      tileBBox={previewData.tileBBox}
                      bufferBBox={previewData.bufferBBox}
                      features={previewData.features}
                      selectedFeatureId={selectedFeatureId}
                      hoveredFeatureId={hoveredFeatureId}
                      baseColor={theme.palette.primary.main}
                      hoverColor={theme.palette.warning.main}
                      onMouseLeave={handleResetSelection}
                    />
                  </Allotment.Pane>
                  <Allotment.Pane minSize={160}>
                    <Box sx={{ height: '100%', overflow: 'auto' }}>
                      <FeaturePreviewLauncherButtonGroupCard
                        items={previewData.entries.map((entry) => ({
                          id: entry.id,
                          label: entry.label,
                          countryCode: entry.countryCode,
                          tooltip: `${entry.label} ${formatBytesToKb(entry.geojsonBytes)}`,
                        }))}
                        selectedId={selectedFeatureId}
                        onSelect={(id) => setSelectedFeatureId((prev) => (prev === id ? null : id))}
                        onHoverChange={setHoveredFeatureId}
                      />
                    </Box>
                  </Allotment.Pane>
                </Allotment>
              </Allotment.Pane>
              <Allotment.Pane minSize={180}>
                <Box sx={{ height: '100%', overflow: 'auto' }}>
                  <Divider sx={{ mb: 1 }} />
                  <Tooltip
                    arrow
                    placement="top-start"
                    title={
                      <Paper variant="outlined" sx={{ p: 1 }}>
                        <Stack spacing={0.5}>
                          <Typography variant="caption" color="text.secondary">
                            geojson-vt parameters
                          </Typography>
                          <Typography variant="caption">
                            tolerance: {formatNumber(tileEmitConfig.tolerance)}
                          </Typography>
                          <Typography variant="caption">
                            extent: {formatNumber(tileEmitConfig.extent)}
                          </Typography>
                          <Typography variant="caption">
                            buffer: {formatNumber(tileBuffer)}
                          </Typography>
                          <Typography variant="caption">
                            indexMaxPoints: {formatNumber(effectiveIndexMaxPoints)}
                          </Typography>
                          <Typography variant="caption">
                            promoteId: {tileEmitConfig.promoteId ?? 'N/A'}
                          </Typography>
                          <Typography variant="caption">
                            layerSet: {tileEmitConfig.layerSetName ?? 'N/A'}
                          </Typography>
                          <Typography variant="caption">
                            format: {tileEmitConfig.format ?? 'N/A'}
                          </Typography>
                          <Typography variant="caption">
                            compression: {tileEmitConfig.compression ?? 'N/A'}
                          </Typography>
                          <Typography variant="caption">
                            enableTopojsonSimplify:{' '}
                            {tileEmitConfig.enableTopojsonSimplify ? 'true' : 'false'}
                          </Typography>
                        </Stack>
                      </Paper>
                    }
                    componentsProps={{
                      tooltip: { sx: { p: 0, bgcolor: 'transparent', boxShadow: 'none' } },
                    }}
                  >
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                      <Typography variant="caption" color="text.secondary">
                        Tile data sizes
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}
                      >
                        <Box component="span">Parent:</Box>
                        <Box component="span" sx={{ color: 'success.main', fontWeight: 600 }}>
                          {formatBytesToKb(previewData.parentTileBytes)}
                        </Box>
                        <Box component="span">/ Parent + descendant:</Box>
                        <Box component="span" sx={{ color: 'primary.main', fontWeight: 600 }}>
                          {formatBytesToKb(previewData.totalTileBytes)}
                        </Box>
                        <Box component="span">/ Input GeoJSON total:</Box>
                        <Box component="span" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                          {formatBytesToKb(previewData.inputBytes)}
                        </Box>
                      </Typography>
                      <Box
                        sx={{
                          position: 'relative',
                          width: '100%',
                          height: 10,
                          bgcolor: 'grey.300',
                          borderRadius: 0.5,
                          overflow: 'hidden',
                        }}
                      >
                        <Box sx={{ position: 'absolute', inset: 0, bgcolor: 'grey.300' }} />
                        <Box
                          sx={{
                            position: 'absolute',
                            insetY: 0,
                            left: 0,
                            width: `${previewData.inputBytes > 0 && previewData.totalTileBytes ? Math.min(100, Math.max(0, (previewData.totalTileBytes / previewData.inputBytes) * 100)) : 0}%`,
                            bgcolor: 'primary.main',
                          }}
                        />
                        <Box
                          sx={{
                            position: 'absolute',
                            insetY: 0,
                            left: 0,
                            width: `${previewData.inputBytes > 0 && previewData.parentTileBytes ? Math.min(100, Math.max(0, (previewData.parentTileBytes / previewData.inputBytes) * 100)) : 0}%`,
                            bgcolor: 'success.main',
                          }}
                        />
                      </Box>
                    </Box>
                  </Tooltip>
                </Box>
              </Allotment.Pane>
            </Allotment>
          </Box>
        ) : (
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="caption" color="text.secondary">
              {loading ? 'Loading preview...' : 'Preview unavailable'}
            </Typography>
          </Paper>
        )}
      </Stack>
    </Paper>
  );
};
