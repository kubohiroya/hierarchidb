/**
  * Plugin UI Demo Page
 * UI
  */

import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { type NodeId } from '@hierarchidb/common-type';

// Note: These imports will be commented out initially to avoid build errors
// We'll use mock components instead
// import { BaseMapDialog } from "@hierarchidb/basemap";
// import { StylerDialog } from "@hierarchidb/plugins-styler-plugin";

// Mock Dialog Component for demonstration
type MockDialogProps = {
  title: string;
  open: boolean;
  onClose: () => void;
  data?: Record<string, unknown>;
  onSave?: (data: Record<string, unknown>) => void;
};

const MockDialog = ({ title, open, onClose, data, onSave }: MockDialogProps) => {
  const [formData, setFormData] = useState<Record<string, unknown>>(data ?? {});

  const handleSave = () => {
    onSave?.(formData);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 2 }}>
          <TextField
            label="Name"
            value={typeof formData.name === 'string' ? formData.name : ''}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            fullWidth
          />
          <TextField
            label="Description"
            value={typeof formData.description === 'string' ? formData.description : ''}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            multiline
            rows={3}
            fullWidth
          />
          <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
            <Typography variant="caption" component="pre" sx={{ fontSize: '0.75rem' }}>
              {JSON.stringify(formData, null, 2)}
            </Typography>
          </Paper>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained">Save</Button>
      </DialogActions>
    </Dialog>
  );
};

export default function PluginDemo() {
  const [openBaseMap, setOpenBaseMap] = useState(false);
  const [openStyler, setOpenStyler] = useState(false);
  const [lastAction, setLastAction] = useState<string>('');

  //  ID
  const mockNodeId = crypto.randomUUID() as NodeId;

  //  BaseMap
  const mockBaseMapEntity = {
    nodeId: mockNodeId,
    name: 'Sample BaseMap',
    description: 'This is a demo basemap configuration',
    mapStyle: 'streets-v11',
    center: [139.6917, 35.6895], // Tokyo coordinates
    zoom: 10,
    bearing: 0,
    pitch: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  //  Styler
  const mockStylerEntity = {
    nodeId: mockNodeId,
    name: 'Sample Styler',
    description: 'This is a demo styler-plugin configuration',
    filterRules: [],
    selectedKeyColumn: 'category',
    selectedValueColumns: ['value1', 'value2'],
    keyValueMappings: [
      { key: 'A', value: 'Category A' },
      { key: 'B', value: 'Category B' },
    ],
    stylerConfig: {
      defaultColors: {
        text: '#000000',
        background: '#ffffff',
        border: '#cccccc',
      },
      colorRules: [
        { key: 'A', color: '#ff0000' },
        { key: 'B', color: '#00ff00' },
      ],
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const handleBaseMapSave = async (data: Record<string, unknown>) => {
    console.log('BaseMap saved:', data);
    setLastAction(`BaseMap saved: ${JSON.stringify(data, null, 2)}`);
    setOpenBaseMap(false);
  };

  const handleStylerSave = async (data: Record<string, unknown>) => {
    console.log('Styler saved:', data);
    setLastAction(`Styler saved: ${JSON.stringify(data, null, 2)}`);
    setOpenStyler(false);
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h3" component="h1" gutterBottom>
        Plugin UI Demo
      </Typography>

      <Typography variant="body1" color="text.secondary" paragraph>
        このページでは、HierarchiDBのプラグインUIコンポーネントをモックデータで確認できます。
      </Typography>

      <Stack spacing={3}>
        {/* BaseMap Plugin Section */}
        <Paper elevation={2} sx={{ p: 3 }}>
          <Typography variant="h5" gutterBottom>
            BaseMap Plugin
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            地図ベースレイヤーの設定を管理するプラグイン
          </Typography>

          <Stack direction="row" spacing={2}>
            <Button
              variant="contained"
              color="primary"
              onClick={() => setOpenBaseMap(true)}
            >
              Open BaseMap Dialog
            </Button>
          </Stack>

          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" component="pre" sx={{
              display: 'block',
              p: 1,
              bgcolor: 'grey.100',
              borderRadius: 1,
              overflow: 'auto',
              maxHeight: 200,
            }}>
              {JSON.stringify(mockBaseMapEntity, null, 2)}
            </Typography>
          </Box>
        </Paper>

        {/* Styler Plugin Section */}
        <Paper elevation={2} sx={{ p: 3 }}>
          <Typography variant="h5" gutterBottom>
            Styler Plugin
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            データの視覚的スタイルマッピングを設定するプラグイン
          </Typography>

          <Stack direction="row" spacing={2}>
            <Button
              variant="contained"
              color="secondary"
              onClick={() => setOpenStyler(true)}
            >
              Open Styler Dialog
            </Button>
          </Stack>

          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" component="pre" sx={{
              display: 'block',
              p: 1,
              bgcolor: 'grey.100',
              borderRadius: 1,
              overflow: 'auto',
              maxHeight: 200,
            }}>
              {JSON.stringify(mockStylerEntity, null, 2)}
            </Typography>
          </Box>
        </Paper>

        {/* Action Log */}
        {lastAction && (
          <Alert severity="success" onClose={() => setLastAction('')}>
            <Typography variant="caption" component="pre">
              {lastAction}
            </Typography>
          </Alert>
        )}
      </Stack>

      {/* Dialogs - Using mock dialogs for now */}
      {openBaseMap && (
        <MockDialog
          title="BaseMap Configuration"
          open={openBaseMap}
          onClose={() => setOpenBaseMap(false)}
          data={mockBaseMapEntity}
          onSave={handleBaseMapSave}
        />
      )}

      {openStyler && (
        <MockDialog
          title="Styler Configuration"
          open={openStyler}
          onClose={() => setOpenStyler(false)}
          data={mockStylerEntity}
          onSave={handleStylerSave}
        />
      )}
    </Container>
  );
}
