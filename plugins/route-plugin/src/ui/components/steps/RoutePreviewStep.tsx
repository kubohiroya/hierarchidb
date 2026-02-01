/**
 * RoutePreviewStep - Step 6 of route creation dialog.
 */

import type React from 'react';
import { Alert, Box, Paper, Typography } from '@mui/material';
import { DEFAULT_MAP_CONFIG, MapToggleCard, ResourceLayerMap, RoutePreviewList } from '@hierarchidb/ui-map';
import type { NodeId } from '@hierarchidb/core-types';
import type { RouteUpdaterPayload } from '@hierarchidb/route-api';
import { useRoutePreviewStep } from './useRoutePreviewStep.js';

interface RoutePreviewStepProps {
  draft: RouteUpdaterPayload;
  nodeId?: NodeId;
}

export const RoutePreviewStep: React.FC<RoutePreviewStepProps> = ({ draft, nodeId }) => {
  const {
    t,
    mapInstance,
    setMapInstance,
    attributionItems,
    initialViewState,
    vectorLayers,
    hoverSnackbar,
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
    emptyErrorSummary,
    emptyContent,
    columnLabels,
    countLabels,
    searchLabels,
    statusLabels,
    errorColumnLabels,
  } = useRoutePreviewStep({ draft, nodeId });

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

      {hasGeometry && (
        <>
          <Alert severity="success">
            {t('preview.ready', 'Route geometry is available. Map preview will appear here.')}
          </Alert>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle1">{t('preview.mapTitle', 'Map Preview')}</Typography>
            <Box sx={{ mt: 2 }}>
              <MapToggleCard
                title="Route Selection"
                options={routeModeOptions.map((option) => ({
                  id: option.id,
                  label: option.label,
                  icon: option.icon,
                }))}
                selection={routeModeSelection}
                onToggle={handleRouteModeToggle}
              />
            </Box>
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
              <RoutePreviewList
                title={t('preview.list.title', 'Routes')}
                rows={listRows}
                loading={lineStringsLoading}
                error={lineStringsError ?? undefined}
                columnLabels={columnLabels}
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
                errorSummaryById={emptyErrorSummary}
                errorColumnLabels={errorColumnLabels}
                statusLabels={statusLabels}
                emptyContent={emptyContent}
              />
              {mapInstance ? hoverSnackbar : null}
            </Box>
          </Paper>
        </>
      )}
    </Box>
  );
};
