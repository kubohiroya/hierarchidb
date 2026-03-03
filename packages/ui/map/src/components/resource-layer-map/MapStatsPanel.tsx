import { Box as MuiBox, Typography } from '@mui/material';
import type { BoxProps } from '@mui/material';
import type React from 'react';
import type { WindowState } from '@hierarchidb/ui-floating-window';
import { normalizeChildren, formatBytes } from './resourceLayerMapHelpers.js';
import type { MapStatsStore } from '../useResourceLayerMapStats.js';
import { useMapStatsPanel } from './useMapStatsPanel.js';

const Box: React.FC<BoxProps> = ({ children, ...props }) => (
  <MuiBox {...props}>{normalizeChildren(children)}</MuiBox>
);

const MapStatsPanel: React.FC<{
  store: MapStatsStore;
  vectorLayerEntries: Array<{ id: string; label?: string }>;
  renderExtra?: () => React.ReactNode;
  showTitle?: boolean;
  title?: string;
}> = ({ store, vectorLayerEntries, renderExtra, showTitle = true, title = 'Dexie Tile Stats' }) => {
  const { snapshot, extraNode } = useMapStatsPanel({ store, renderExtra });
  return (
    <Box
      display="flex"
      gap={1}
      alignItems="flex-start"
      sx={{ px: 1.5, py: 1, color: 'text.primary' }}
    >
      {showTitle ? (
        <Typography variant="caption" fontWeight={700} display="block">
          {title}
        </Typography>
      ) : null}
      <Box mt={0.5}>
        <Typography variant="caption" display="block">
          Requests: {snapshot.tileStats.requests.toLocaleString()}
        </Typography>
        <Typography variant="caption" display="block">
          Data: {formatBytes(snapshot.tileStats.bytes)}
        </Typography>
      </Box>
      <Box mt={0.75}>
        <Typography variant="caption" fontWeight={600} display="block">
          Viewport Features
        </Typography>
        {vectorLayerEntries.length === 0 ? (
          <Typography variant="caption" display="block">
            No layers
          </Typography>
        ) : (
          vectorLayerEntries.map((entry) => (
            <Typography key={entry.id} variant="caption" display="block">
              {entry.label}: {snapshot.featureCounts[entry.id]?.toLocaleString() ?? '0'}
            </Typography>
          ))
        )}
      </Box>
      {extraNode ? (
        <Box sx={{ px: 1.5, py: 1, color: 'text.primary' }}>
          {extraNode}
        </Box>
      ) : null}
    </Box>
  );
};

export { MapStatsPanel };

export const DEFAULT_STATS_WINDOW_STATE: WindowState = {
  position: { x: 24, y: 96 },
  size: { width: 260, height: 220 },
  isMinimized: false,
  isFullscreen: false,
  isVisible: true,
  zIndex: 1200,
};
