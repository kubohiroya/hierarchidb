/**
 * RoutePreviewStep - Step 6 of route creation dialog.
 */

import type React from 'react';
import {
  useTheme,
  Alert,
  Box,
  Button,
  Divider,
  Grid,
  MenuItem,
  Paper,
  Select,
  Slider,
  TextField,
  Typography,
} from '@mui/material';
import { FilterAlt, Palette, TableChart } from '@mui/icons-material';
import { FloatingWindow } from '@hierarchidb/components';
import { RoutePreviewEmptyContent, RoutePreviewHoverSnackbar } from './RoutePreviewStepElements.js';
import { DEFAULT_MAP_CONFIG, MapToggleCard, ResourceLayerMap, RoutePreviewList } from '@hierarchidb/ui-map';
import type { NodeId } from '@hierarchidb/core-types';
import type { RouteEntity } from '@hierarchidb/route-api';
import { useRoutePreviewStep } from './useRoutePreviewStep.js';
import {
  LINE_WIDTH_MAX,
  LINE_WIDTH_MIN,
  ROUTE_MODE_COLUMNS,
  ROUTE_STYLE_OPTIONS,
} from './routeSelectionConstants.js';

interface RoutePreviewStepProps {
  draft: Partial<RouteEntity>;
  nodeId?: NodeId;
  onUpdate: (updates: Partial<RouteEntity>) => void;
}

export const RoutePreviewStep: React.FC<RoutePreviewStepProps> = ({ draft, nodeId, onUpdate }) => {
  const isDarkMode = useTheme().palette.mode === 'dark';
  const {
    t,
    mapInstance,
    setMapInstance,
    attributionItems,
    initialViewState,
    vectorLayers,
    hoverSnackbarProps,
    showMissingGeometry,
    lineStringsError,
    lineStringsLoading,
    hasGeometry,
    routeModeOptions,
    routeModeSelection,
    handleRouteModeToggle,
    listRows,
    listSearch,
    setListSearch,
    matchedIdSet,
    selectedIds,
    setSelectedIds,
    staleSummaryById,
    emptyContentProps,
    modeMeta,
    columnLabels,
    countLabels,
    searchLabels,
    statusLabels,
    errorColumnLabels,
    routeStyleConfig,
    styleWindow,
    showStyleWindowButton,
    handleModeColorChange,
    handleLineWidthChange,
    handleLineStyleChange,
    metadataSyncRunning,
    metadataSyncError,
    metadataSyncBadgeText,
    runMetadataSyncCheck,
    buildErrors,
    modeWindow,
    showModeWindowButton,
    listWindow,
    showListWindowButton,
  } = useRoutePreviewStep({ draft, nodeId, onUpdate });

  return (
    <Box display="flex" flexDirection="column" gap={2}>
      <Typography variant="h6">{t('preview.title', 'Preview')}</Typography>
      <Typography variant="body2" color="text.secondary">
        {t('preview.description', 'Preview the generated route geometry once the stage is complete.')}
      </Typography>

      {showMissingGeometry && (
        <Alert severity="info">
          {t('preview.missing', 'No route geometry is available yet. Run Build to generate a preview.')}
        </Alert>
      )}
      {lineStringsError && (
        <Alert severity="error">
          {lineStringsError}
        </Alert>
      )}
      {buildErrors.length > 0 && (
        <Alert severity="warning">
          <Typography variant="body2" fontWeight={600}>
            {t('preview.buildErrors', 'Build errors detected')}: {buildErrors.length}
          </Typography>
          <Box component="ul" sx={{ mb: 0, mt: 1, pl: 2 }}>
            {buildErrors.slice(0, 5).map((error) => (
              <Box component="li" key={error.id} sx={{ mb: 0.5 }}>
                <Typography variant="caption">
                  [{error.stage}] {error.sourceKey ?? '-'}: {error.message}
                </Typography>
              </Box>
            ))}
          </Box>
        </Alert>
      )}

      {hasGeometry && (
        <>
          <Alert severity="success">
            {t('preview.ready', 'Route geometry is available. Map preview will appear here.')}
          </Alert>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle1">{t('preview.mapTitle', 'Map Preview')}</Typography>
            <Box
              sx={{
                position: 'relative',
                height: 320,
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.default',
                overflow: 'hidden',
                mt: 2,
              }}
            >
              <ResourceLayerMap
                initialViewState={initialViewState}
                width="100%"
                height="100%"
                mapStyleUrl={DEFAULT_MAP_CONFIG.mapStyleUrl}
                basemapStyles={[]}
                vectorLayers={vectorLayers}
                attributionItems={attributionItems}
                mapOptions={DEFAULT_MAP_CONFIG.interactionOptions}
                onLoad={setMapInstance}
              />
              {modeWindow.windowState.isVisible ? (
                <FloatingWindow
                  title={t('preview.modeFilters.title', 'Route mode filters')}
                  titleIcon={<FilterAlt fontSize="small" />}
                  initialState={modeWindow.windowState}
                  onStateChange={modeWindow.handlers.onStateChange}
                  onClose={modeWindow.handlers.onClose}
                  resizable
                  minWidth={220}
                  minHeight={180}
                >
                  <MapToggleCard
                    title={t('preview.routeSelection', 'Route selection')}
                    options={routeModeOptions.map((option) => ({
                      id: option.id,
                      label: option.label,
                      icon: <option.Icon fontSize="small" />,
                    }))}
                    selection={routeModeSelection}
                    onToggle={handleRouteModeToggle}
                  />
                </FloatingWindow>
              ) : null}
              {listWindow.windowState.isVisible ? (
                <FloatingWindow
                  title={t('preview.listWindow.title', 'Route metadata')}
                  titleIcon={<TableChart fontSize="small" />}
                  initialState={listWindow.windowState}
                  onStateChange={listWindow.handlers.onStateChange}
                  onClose={listWindow.handlers.onClose}
                  resizable
                  minWidth={420}
                  minHeight={220}
                >
                  <RoutePreviewList
                    title={t('preview.list.title', 'Routes')}
                    rows={listRows}
                    loading={lineStringsLoading}
                    error={lineStringsError ?? undefined}
                    columnLabels={columnLabels}
                    modeMeta={Object.fromEntries(Object.entries(modeMeta).map(([key, meta]) => [
                      key,
                      { ...meta, icon: <meta.Icon fontSize="small" /> },
                    ]))}
                    search={{
                      value: listSearch,
                      onChange: setListSearch,
                      placeholder: searchLabels.placeholder,
                      ariaLabel: searchLabels.ariaLabel,
                    }}
                    countLabels={countLabels}
                    matchedRows={matchedIdSet}
                    selectedRows={new Set(selectedIds)}
                    onSelectionChange={(next: Set<string | number>) => setSelectedIds(Array.from(next).map(String))}
                    errorSummaryById={staleSummaryById}
                    errorColumnLabels={errorColumnLabels}
                    statusLabels={statusLabels}
                    toolbarActions={(
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => void runMetadataSyncCheck()}
                          disabled={metadataSyncRunning}
                        >
                          {metadataSyncRunning
                            ? t('preview.metadataSync.checking', 'Checking...')
                            : t('preview.metadataSync.checkButton', 'Check sync status')}
                        </Button>
                        {metadataSyncBadgeText ? (
                          <Typography variant="caption" color="text.secondary">
                            {metadataSyncBadgeText}
                          </Typography>
                        ) : null}
                      </Box>
                    )}
                    emptyContent={emptyContentProps ? (
                      <RoutePreviewEmptyContent {...emptyContentProps} />
                    ) : undefined}
                  />
                </FloatingWindow>
              ) : null}
              {metadataSyncError ? (
                <Box sx={{ position: 'absolute', left: 12, right: 12, bottom: 12, zIndex: 4 }}>
                  <Alert severity="error">{metadataSyncError}</Alert>
                </Box>
              ) : null}
              {styleWindow.windowState.isVisible ? (
                <FloatingWindow
                  title={t('routeConfig.style.title', 'Route style')}
                  titleIcon={<Palette fontSize="small" />}
                  initialState={styleWindow.windowState}
                  onStateChange={styleWindow.handlers.onStateChange}
                  onClose={styleWindow.handlers.onClose}
                  resizable
                  minWidth={280}
                  minHeight={280}
                >
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Typography variant="caption" color="text.secondary">
                      {t('routeConfig.style.description', 'Configure colors and line styles per transport mode.')}
                    </Typography>
                    <Typography variant="subtitle2">
                      {t('routeConfig.style.modeColorsTitle', 'Mode colors')}
                    </Typography>
                    <Grid container spacing={1}>
                      {ROUTE_MODE_COLUMNS.map((mode) => (
                        <Grid key={mode.id} size={{ xs: 12 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <mode.icon fontSize="small" />
                            <Typography variant="body2" sx={{ flex: 1 }}>
                              {t(mode.labelKey, mode.id)}
                            </Typography>
                            <TextField
                              type="color"
                              size="small"
                              value={routeStyleConfig.modeColors[mode.id]}
                              onChange={(event) => handleModeColorChange(mode.id, event.target.value)}
                              inputProps={{ 'aria-label': t('routeConfig.style.modeColorLabel', 'Color') }}
                            />
                          </Box>
                        </Grid>
                      ))}
                    </Grid>
                    <Divider />
                    <Box>
                      <Typography variant="subtitle2" gutterBottom>
                        {t('routeConfig.style.lineWidthLabel', 'Line width')}
                      </Typography>
                      <Slider
                        min={LINE_WIDTH_MIN}
                        max={LINE_WIDTH_MAX}
                        value={routeStyleConfig.lineWidth}
                        onChange={(_, next) => handleLineWidthChange(next)}
                        valueLabelDisplay="auto"
                      />
                    </Box>
                    <Box>
                      <Typography variant="subtitle2" gutterBottom>
                        {t('routeConfig.style.lineStyleLabel', 'Line style')}
                      </Typography>
                      <Select
                        fullWidth
                        size="small"
                        value={routeStyleConfig.lineStyle}
                        onChange={(event) => handleLineStyleChange(String(event.target.value))}
                      >
                        {ROUTE_STYLE_OPTIONS.map((option) => (
                          <MenuItem key={option.id} value={option.id}>
                            {t(option.labelKey, option.fallback)}
                          </MenuItem>
                        ))}
                      </Select>
                    </Box>
                  </Box>
                </FloatingWindow>
              ) : null}
              {(showModeWindowButton || showListWindowButton || showStyleWindowButton) ? (
                <Box position="absolute" top={8} right={8} zIndex={3}>
                  <Box display="flex" flexDirection="column" gap={1}>
                    {showModeWindowButton ? (
                      <Button
                        variant="contained"
                        color="primary"
                        size="large"
                        aria-label={t('preview.modeFilters.reopen', 'Show route mode filters')}
                        onClick={modeWindow.handlers.show}
                      >
                        <FilterAlt />
                      </Button>
                    ) : null}
                    {showListWindowButton ? (
                      <Button
                        variant="contained"
                        color="primary"
                        size="large"
                        aria-label={t('preview.listWindow.reopen', 'Show route metadata')}
                        onClick={listWindow.handlers.show}
                      >
                        <TableChart />
                      </Button>
                    ) : null}
                    {showStyleWindowButton ? (
                      <Button
                        variant="contained"
                        color="primary"
                        size="large"
                        aria-label={t('routeConfig.style.reopen', 'Show route style')}
                        onClick={styleWindow.handlers.show}
                      >
                        <Palette />
                      </Button>
                    ) : null}
                  </Box>
                </Box>
              ) : null}
              {mapInstance ? (
                  <RoutePreviewHoverSnackbar
                    {...hoverSnackbarProps}
                    isDarkMode={isDarkMode}
                    popupHint={t('preview.hoverShortcutHelp', 'Click one of the nearby routes to add/remove selection.')}
                  />
                ) : null}
              </Box>
          </Paper>
        </>
      )}
    </Box>
  );
};
