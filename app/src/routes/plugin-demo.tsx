/**
 * Plugin UI Demo Page
 * プラグインUIのモックデータによる表示確認用ページ
 */

import { useState } from "react";
import {
  Box,
  Container,
  Typography,
  Button,
  Paper,
  Stack,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from "@mui/material";
import { type NodeId } from "@hierarchidb/common-core";

// Note: These imports will be commented out initially to avoid build errors
// We'll use mock components instead
// import { BaseMapDialog } from "@hierarchidb/basemap";
// import { StyleMapDialog } from "@hierarchidb/stylemap";

// Mock Dialog Component for demonstration
const MockDialog = ({ title, open, onClose, data, onSave }: any) => {
  const [formData, setFormData] = useState(data);

  const handleSave = () => {
    onSave(formData);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 2 }}>
          <TextField
            label="Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            fullWidth
          />
          <TextField
            label="Description"
            value={formData.description}
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
  const [openStyleMap, setOpenStyleMap] = useState(false);
  const [lastAction, setLastAction] = useState<string>("");

  // モックのノードID生成
  const mockNodeId = crypto.randomUUID() as NodeId;

  // BaseMapのモックデータ
  const mockBaseMapEntity = {
    nodeId: mockNodeId,
    name: "Sample BaseMap",
    description: "This is a demo basemap configuration",
    mapStyle: "streets-v11",
    center: [139.6917, 35.6895], // Tokyo coordinates
    zoom: 10,
    bearing: 0,
    pitch: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  // StyleMapのモックデータ
  const mockStyleMapEntity = {
    nodeId: mockNodeId,
    name: "Sample StyleMap",
    description: "This is a demo stylemap configuration",
    filterRules: [],
    selectedKeyColumn: "category",
    selectedValueColumns: ["value1", "value2"],
    keyValueMappings: [
      { key: "A", value: "Category A" },
      { key: "B", value: "Category B" },
    ],
    styleMapConfig: {
      defaultColors: {
        text: "#000000",
        background: "#ffffff",
        border: "#cccccc",
      },
      colorRules: [
        { key: "A", color: "#ff0000" },
        { key: "B", color: "#00ff00" },
      ],
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const handleBaseMapSave = async (data: any) => {
    console.log("BaseMap saved:", data);
    setLastAction(`BaseMap saved: ${JSON.stringify(data, null, 2)}`);
    setOpenBaseMap(false);
  };

  const handleStyleMapSave = async (data: any) => {
    console.log("StyleMap saved:", data);
    setLastAction(`StyleMap saved: ${JSON.stringify(data, null, 2)}`);
    setOpenStyleMap(false);
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
              maxHeight: 200
            }}>
              {JSON.stringify(mockBaseMapEntity, null, 2)}
            </Typography>
          </Box>
        </Paper>

        {/* StyleMap Plugin Section */}
        <Paper elevation={2} sx={{ p: 3 }}>
          <Typography variant="h5" gutterBottom>
            StyleMap Plugin
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            データの視覚的スタイルマッピングを設定するプラグイン
          </Typography>
          
          <Stack direction="row" spacing={2}>
            <Button
              variant="contained"
              color="secondary"
              onClick={() => setOpenStyleMap(true)}
            >
              Open StyleMap Dialog
            </Button>
          </Stack>

          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" component="pre" sx={{ 
              display: 'block',
              p: 1,
              bgcolor: 'grey.100',
              borderRadius: 1,
              overflow: 'auto',
              maxHeight: 200
            }}>
              {JSON.stringify(mockStyleMapEntity, null, 2)}
            </Typography>
          </Box>
        </Paper>

        {/* Action Log */}
        {lastAction && (
          <Alert severity="success" onClose={() => setLastAction("")}>
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

      {openStyleMap && (
        <MockDialog
          title="StyleMap Configuration"
          open={openStyleMap}
          onClose={() => setOpenStyleMap(false)}
          data={mockStyleMapEntity}
          onSave={handleStyleMapSave}
        />
      )}
    </Container>
  );
}