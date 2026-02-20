import type { Meta, StoryObj } from '@storybook/react-vite';
import { Provider } from 'jotai';
import { useState } from 'react';
import { Box, Button, Chip, Paper, Stack, Typography } from '@mui/material';
import { MapHighlightProvider, useMapHighlightContext } from '~/components/MapHighlightProvider';
import type { NodeId } from '@hierarchidb/core-types';

const meta: Meta<typeof MapHighlightProvider> = {
  title: 'SearchResult/MapHighlightProvider',
  component: MapHighlightProvider,
  parameters: {
    layout: 'padded',
  },
  decorators: [
    (Story) => (
      <Provider>
        <Story />
      </Provider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

function MapHighlightDemo() {
  const {
    highlightState,
    setSearchMatched,
    setSelected,
    addSearchMatched,
    addSelected,
    removeSearchMatched,
    removeSelected,
    clearAll,
    clearSearchMatched,
    clearSelected,
    updateStyles,
    setFocused,
  } = useMapHighlightContext();

  const sampleNodeIds: NodeId[] = [
    'node-tokyo-station' as NodeId,
    'node-shibuya-crossing' as NodeId,
    'node-mount-fuji' as NodeId,
    'node-osaka-castle' as NodeId,
    'node-fushimi-inari' as NodeId,
  ];

  const handleSetSearchMatched = () => {
    setSearchMatched([sampleNodeIds[0]!, sampleNodeIds[1]!, sampleNodeIds[2]!]);
  };

  const handleSetSelected = () => {
    setSelected([sampleNodeIds[1]!, sampleNodeIds[3]!]);
  };

  const handleAddSearchMatched = () => {
    addSearchMatched(sampleNodeIds[4]!);
  };

  const handleAddSelected = () => {
    addSelected(sampleNodeIds[0]!);
  };

  const handleSetFocused = () => {
    setFocused(sampleNodeIds[2]!);
  };

  const handleUpdateStyles = () => {
    updateStyles({
      searchMatch: {
        fillColor: '#FF6B6B',
        fillOpacity: 0.8,
      },
      selection: {
        strokeColor: '#4ECDC4',
        strokeWidth: 4,
        strokeOpacity: 0.9,
      },
    });
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Map Highlight State Demo
      </Typography>

      <Stack spacing={3}>
        {/*
*/}
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Current State
          </Typography>

          <Stack spacing={1}>
            <Box>
              <Typography variant="subtitle2">
                Search Matched ({highlightState.searchMatched.size})
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {Array.from(highlightState.searchMatched).map((nodeId) => (
                  <Chip
                    key={nodeId}
                    label={nodeId}
                    size="small"
                    color="warning"
                    onDelete={() => removeSearchMatched(nodeId)}
                  />
                ))}
              </Box>
            </Box>

            <Box>
              <Typography variant="subtitle2">
                Selected ({highlightState.selected.size})
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {Array.from(highlightState.selected).map((nodeId) => (
                  <Chip
                    key={nodeId}
                    label={nodeId}
                    size="small"
                    color="primary"
                    onDelete={() => removeSelected(nodeId)}
                  />
                ))}
              </Box>
            </Box>

            <Box>
              <Typography variant="subtitle2">Focused</Typography>
              {highlightState.focused ? (
                <Chip
                  label={highlightState.focused}
                  size="small"
                  color="secondary"
                  onDelete={() => setFocused(null)}
                />
              ) : (
                <Typography variant="body2" color="text.secondary">
                  None
                </Typography>
              )}
            </Box>
          </Stack>
        </Paper>

        {/*
*/}
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Actions
          </Typography>

          <Stack spacing={2}>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Button
                variant="contained"
                color="warning"
                onClick={handleSetSearchMatched}
              >
                Set Search Matched
              </Button>
              <Button
                variant="contained"
                color="primary"
                onClick={handleSetSelected}
              >
                Set Selected
              </Button>
              <Button
                variant="outlined"
                color="secondary"
                onClick={handleSetFocused}
              >
                Set Focused
              </Button>
            </Stack>

            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Button
                variant="outlined"
                onClick={handleAddSearchMatched}
              >
                Add Search Matched
              </Button>
              <Button
                variant="outlined"
                onClick={handleAddSelected}
              >
                Add Selected
              </Button>
              <Button
                variant="outlined"
                onClick={handleUpdateStyles}
              >
                Update Styles
              </Button>
            </Stack>

            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Button
                variant="outlined"
                color="warning"
                onClick={clearSearchMatched}
              >
                Clear Search Matched
              </Button>
              <Button
                variant="outlined"
                color="primary"
                onClick={clearSelected}
              >
                Clear Selected
              </Button>
              <Button
                variant="outlined"
                color="error"
                onClick={clearAll}
              >
                Clear All
              </Button>
            </Stack>
          </Stack>
        </Paper>

        {/*
*/}
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Styles
          </Typography>
          <pre style={{ fontSize: '12px', margin: 0 }}>
            {JSON.stringify(highlightState.styles, null, 2)}
          </pre>
        </Paper>
      </Stack>
    </Box>
  );
}

export const Default: Story = {
  render: () => (
    <MapHighlightProvider>
      <MapHighlightDemo />
    </MapHighlightProvider>
  ),
};

export const WithInitialData: Story = {
  render: () => (
    <MapHighlightProvider
      initialStyles={{
        searchMatch: {
          fillColor: '#FFE066',
          fillOpacity: 0.7,
        },
        selection: {
          strokeColor: '#FF6B6B',
          strokeWidth: 3,
          strokeOpacity: 0.8,
        },
      }}
    >
      <MapHighlightDemo />
    </MapHighlightProvider>
  ),
};

function CallbackDemo() {
  const [stateChanges, setStateChanges] = useState<any[]>([]);

  return (
    <MapHighlightProvider
      onStateChange={(state) => {
        setStateChanges(prev => [
          { timestamp: Date.now(), state: { ...state } },
          ...prev.slice(0, 9), //  10
        ]);
      }}
    >
      <Stack spacing={2}>
        <MapHighlightDemo />

        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            State Change Log
          </Typography>
          {stateChanges.length === 0 ? (
            <Typography color="text.secondary">No changes yet</Typography>
          ) : (
            <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
              {stateChanges.map((change) => (
                <Box key={change.timestamp} sx={{ mb: 1, fontSize: '12px' }}>
                  <Typography variant="caption" color="text.secondary">
                    {new Date(change.timestamp).toLocaleTimeString()}
                  </Typography>
                  <pre style={{ margin: 0, fontSize: '11px' }}>
                    {JSON.stringify(change.state, null, 1)}
                  </pre>
                </Box>
              ))}
            </Box>
          )}
        </Paper>
      </Stack>
    </MapHighlightProvider>
  );
}

export const WithCallbacks: Story = {
  render: () => <CallbackDemo />,
};
