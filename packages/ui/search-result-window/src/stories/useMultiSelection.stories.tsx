import type { Meta, StoryObj } from '@storybook/react-vite';
import { Provider } from 'jotai';
import { useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { useMultiSelection } from '~/hooks/useMultiSelection';
import type { SearchResult } from '~/types/index';
import type { NodeId } from '@hierarchidb/core-types';

const meta: Meta = {
  title: 'SearchResult/useMultiSelection',
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

const mockResults: SearchResult[] = [
  {
    nodeId: 'result-1' as NodeId,
    nodeName: 'Tokyo Station',
    nodeType: 'station',
    matchedProperty: 'name',
    matchedValue: 'Tokyo',
    confidence: 0.95,
    parentPath: ['Japan', 'Tokyo'],
    rowIndex: 0,
    rowData: { name: 'Tokyo Station', type: 'Railway' },
    displayColumns: ['name', 'type'],
  },
  {
    nodeId: 'result-2' as NodeId,
    nodeName: 'Shibuya Crossing',
    nodeType: 'landmark',
    matchedProperty: 'name',
    matchedValue: 'Shibuya',
    confidence: 0.88,
    parentPath: ['Japan', 'Tokyo', 'Shibuya'],
    rowIndex: 1,
    rowData: { name: 'Shibuya Crossing', type: 'Intersection' },
    displayColumns: ['name', 'type'],
  },
  {
    nodeId: 'result-3' as NodeId,
    nodeName: 'Mount Fuji',
    nodeType: 'mountain',
    matchedProperty: 'elevation',
    matchedValue: '3776',
    confidence: 0.92,
    parentPath: ['Japan', 'Shizuoka'],
    rowIndex: 2,
    rowData: { name: 'Mount Fuji', elevation: '3776m' },
    displayColumns: ['name', 'elevation'],
  },
  {
    nodeId: 'result-4' as NodeId,
    nodeName: 'Osaka Castle',
    nodeType: 'castle',
    matchedProperty: 'built',
    matchedValue: '1583',
    confidence: 0.79,
    parentPath: ['Japan', 'Osaka'],
    rowIndex: 3,
    rowData: { name: 'Osaka Castle', built: '1583' },
    displayColumns: ['name', 'built'],
  },
  {
    nodeId: 'result-5' as NodeId,
    nodeName: 'Kyoto Temple',
    nodeType: 'temple',
    matchedProperty: 'name',
    matchedValue: 'Kyoto',
    confidence: 0.85,
    parentPath: ['Japan', 'Kyoto'],
    rowIndex: 4,
    rowData: { name: 'Kyoto Temple', founded: '794' },
    displayColumns: ['name', 'founded'],
  },
];

function MultiSelectionDemo() {
  const [selectionLog, setSelectionLog] = useState<string[]>([]);
  const [mapFocusLog, setMapFocusLog] = useState<string[]>([]);

  const {
    selectedResults,
    selectedResultItems,
    handleResultSelect,
    handleMapFocus,
    selectAll,
    clearSelection,
    toggleSelection,
  } = useMultiSelection({
    results: mockResults,
    onSelectionChange: (selectedItems) => {
      const message = `Selection changed: ${selectedItems.length} items selected`;
      setSelectionLog((prev) => [
        `${new Date().toLocaleTimeString()}: ${message}`,
        ...prev.slice(0, 9),
      ]);
    },
    onMapFocus: (result) => {
      const message = `Map focus: ${result.nodeName}`;
      setMapFocusLog((prev) => [
        `${new Date().toLocaleTimeString()}: ${message}`,
        ...prev.slice(0, 9),
      ]);
    },
  });

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        useMultiSelection Hook Demo
      </Typography>

      <Stack spacing={3}>
        {/*
*/}
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Selection Status
          </Typography>
          <Stack direction="row" spacing={4}>
            <Typography>
              Selected: <strong>{selectedResults.size}</strong> / {mockResults.length}
            </Typography>
            <Typography>
              Selected Items: <strong>{selectedResultItems.length}</strong>
            </Typography>
          </Stack>
        </Paper>

        {/*
*/}
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Actions
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Button
              variant="contained"
              onClick={selectAll}
              disabled={selectedResults.size === mockResults.length}
            >
              Select All
            </Button>
            <Button
              variant="outlined"
              onClick={clearSelection}
              disabled={selectedResults.size === 0}
            >
              Clear Selection
            </Button>
            <Button
              variant="outlined"
              onClick={() => mockResults[0] && handleMapFocus(mockResults[0])}
            >
              Focus First Item
            </Button>
          </Stack>
        </Paper>

        {/*
*/}
        <Paper>
          <Typography variant="h6" sx={{ p: 2, pb: 0 }}>
            Search Results (Interactive)
          </Typography>
          <Typography variant="caption" sx={{ px: 2, color: 'text.secondary' }}>
            Click: Single select | Ctrl/Cmd+Click: Toggle | Shift+Click: Range select |
            Double-click: Map focus
          </Typography>

          <List>
            {mockResults.map((result) => {
              const isSelected = selectedResults.has(result.nodeId);

              return (
                <ListItem key={result.nodeId} disablePadding>
                  <ListItemButton
                    selected={isSelected}
                    onClick={(event) => {
                      handleResultSelect(result, {
                        shiftKey: event.shiftKey,
                        metaKey: event.metaKey,
                        ctrlKey: event.ctrlKey,
                      });
                    }}
                    onDoubleClick={() => {
                      handleMapFocus(result);
                    }}
                  >
                    <Checkbox
                      edge="start"
                      checked={isSelected}
                      onChange={() => toggleSelection(result)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <ListItemText
                      primary={result.nodeName}
                      secondary={`${result.nodeType} • Confidence: ${Math.round(result.confidence * 100)}% • ${result.parentPath.join(' > ')}`}
                    />
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        </Paper>

        {/*
*/}
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <Paper sx={{ flex: 1, p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Selection Log
            </Typography>
            <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
              {selectionLog.length === 0 ? (
                <Typography color="text.secondary">No selection changes yet</Typography>
              ) : (
                selectionLog.map((log, index) => (
                  <Typography
                    key={index}
                    variant="body2"
                    sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}
                  >
                    {log}
                  </Typography>
                ))
              )}
            </Box>
          </Paper>

          <Paper sx={{ flex: 1, p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Map Focus Log
            </Typography>
            <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
              {mapFocusLog.length === 0 ? (
                <Typography color="text.secondary">No map focus events yet</Typography>
              ) : (
                mapFocusLog.map((log, index) => (
                  <Typography
                    key={index}
                    variant="body2"
                    sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}
                  >
                    {log}
                  </Typography>
                ))
              )}
            </Box>
          </Paper>
        </Stack>

        {/*
*/}
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Selected Items Detail
          </Typography>
          {selectedResultItems.length === 0 ? (
            <Typography color="text.secondary">No items selected</Typography>
          ) : (
            <Stack spacing={1}>
              {selectedResultItems.map((item, index) => (
                <Box key={item.nodeId}>
                  <Typography variant="body2">
                    <strong>{index + 1}.</strong> {item.nodeName} ({item.nodeType})
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Path: {item.parentPath.join(' > ')} • Confidence:{' '}
                    {Math.round(item.confidence * 100)}%
                  </Typography>
                  {index < selectedResultItems.length - 1 && <Divider sx={{ mt: 0.5 }} />}
                </Box>
              ))}
            </Stack>
          )}
        </Paper>
      </Stack>
    </Box>
  );
}

export const Default: Story = {
  render: () => <MultiSelectionDemo />,
};

function LargeDataDemo() {
  const largeResults: SearchResult[] = Array.from({ length: 100 }, (_, i) => ({
    nodeId: `large-result-${i + 1}` as NodeId,
    nodeName: `Item ${i + 1}`,
    nodeType: 'item',
    matchedProperty: 'name',
    matchedValue: `Item ${i + 1}`,
    confidence: Math.random() * 0.4 + 0.6,
    parentPath: ['Category', `Subcategory ${Math.floor(i / 10) + 1}`],
    rowIndex: i,
    rowData: { name: `Item ${i + 1}`, index: i + 1 },
    displayColumns: ['name', 'index'],
  }));

  const { selectedResults, handleResultSelect, selectAll, clearSelection } =
    useMultiSelection({
      results: largeResults,
      onSelectionChange: (selectedItems) => {
        console.log(`Selection changed: ${selectedItems.length} items`);
      },
    });

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Large Dataset Demo (100 items)
      </Typography>

      <Stack spacing={2}>
        <Paper sx={{ p: 2 }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography>
              Selected: <strong>{selectedResults.size}</strong> / {largeResults.length}
            </Typography>
            <Button variant="outlined" size="small" onClick={selectAll}>
              Select All
            </Button>
            <Button variant="outlined" size="small" onClick={clearSelection}>
              Clear
            </Button>
          </Stack>
        </Paper>

        <Paper sx={{ maxHeight: 400, overflow: 'auto' }}>
          <List dense>
            {largeResults.map((result) => {
              const isSelected = selectedResults.has(result.nodeId);

              return (
                <ListItem key={result.nodeId} disablePadding>
                  <ListItemButton
                    selected={isSelected}
                    onClick={(event) => {
                      handleResultSelect(result, {
                        shiftKey: event.shiftKey,
                        metaKey: event.metaKey,
                        ctrlKey: event.ctrlKey,
                      });
                    }}
                  >
                    <Checkbox edge="start" checked={isSelected} size="small" />
                    <ListItemText
                      primary={result.nodeName}
                      secondary={`Confidence: ${Math.round(result.confidence * 100)}%`}
                    />
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        </Paper>
      </Stack>
    </Box>
  );
}

export const LargeDataset: Story = {
  render: () => <LargeDataDemo />,
};
