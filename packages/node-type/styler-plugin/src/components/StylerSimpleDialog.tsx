import React, { useCallback, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import { Add, Cancel, Delete, Save } from '@mui/icons-material';
import type { NodeId } from '@hierarchidb/common-type';
import type { StylerColorRule, StylerEntity, StylerStyle } from '~/entities/StylerEntity';

export interface StylerSimpleDialogProps {
  open: boolean;
  nodeId: NodeId;
  onClose: () => void;
  onSave: (config: StylerCreateConfig) => Promise<void>;
  existingEntity?: StylerEntity;
}

export interface StylerCreateConfig {
  file?: File;
  keyColumn: string;
  colorRules: StylerColorRule[];
  defaultStyle: StylerStyle;
  description?: string;
}

export const StylerSimpleDialog: React.FC<StylerSimpleDialogProps> = ({
                                                                        open,
                                                                        onClose,
                                                                        onSave,
                                                                        existingEntity,
                                                                      }) => {
  const [keyColumn, setKeyColumn] = useState('');
  const [colorRules, setColorRules] = useState<StylerColorRule[]>([]);
  const [defaultStyle, setDefaultStyle] = useState<StylerStyle>({
    backgroundColor: '#ffffff',
    textColor: '#000000',
    borderColor: '#cccccc',
  });
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const handleAddColorRule = useCallback(() => {
    const newRule: StylerColorRule = {
      column: '',
      operator: 'equals',
      value: '',
      style: {
        backgroundColor: '#ffeb3b',
        textColor: '#000000',
      },
    };
    setColorRules(prev => [...prev, newRule]);
  }, []);

  const handleUpdateColorRule = useCallback((index: number, updates: Partial<StylerColorRule>) => {
    setColorRules(prev => prev.map((rule, i) => i === index ? { ...rule, ...updates } : rule));
  }, []);

  const handleRemoveColorRule = useCallback((index: number) => {
    setColorRules(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleSave = useCallback(async () => {
    if (!keyColumn) {
      setError('Please select a key column');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const config: StylerCreateConfig = {
        keyColumn,
        colorRules,
        defaultStyle,
        description: description || undefined,
      };

      await onSave(config);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save Styler');
    } finally {
      setLoading(false);
    }
  }, [keyColumn, colorRules, defaultStyle, description, onSave, onClose]);

  React.useEffect(() => {
    if (existingEntity) {
      setKeyColumn(existingEntity.keyColumn || '');
      setColorRules(existingEntity.colorRules || []);
      setDefaultStyle(existingEntity.defaultStyle || { textColor: '', backgroundColor: '' });
      setDescription(existingEntity.description || '');
    }
  }, [existingEntity]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {existingEntity ? 'Edit Styler' : 'Create Styler'}
      </DialogTitle>

      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 1 }}>
          <TextField
            label="Key Column"
            value={keyColumn}
            onChange={(e) => setKeyColumn(e.target.value)}
            fullWidth
            required
          />

          <Paper sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6">Color Rules</Typography>
              <Button startIcon={<Add />} onClick={handleAddColorRule}>
                Add Rule
              </Button>
            </Box>

            {colorRules.map((rule, index) => (
              <Box key={index} sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
                <TextField
                  label="Column"
                  value={rule.column}
                  onChange={(e) => handleUpdateColorRule(index, { column: e.target.value })}
                  size="small"
                />
                <FormControl sx={{ minWidth: 120 }}>
                  <InputLabel>Operator</InputLabel>
                  <Select
                    value={rule.operator}
                    onChange={(e) => handleUpdateColorRule(index, { operator: e.target.value as any })}
                    label="Operator"
                    size="small"
                  >
                    <MenuItem value="equals">Equals</MenuItem>
                    <MenuItem value="contains">Contains</MenuItem>
                    <MenuItem value="greaterThan">Greater Than</MenuItem>
                    <MenuItem value="lessThan">Less Than</MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  label="Value"
                  value={rule.value}
                  onChange={(e) => handleUpdateColorRule(index, { value: e.target.value })}
                  size="small"
                />
                <TextField
                  label="Color"
                  type="color"
                  value={rule.style.backgroundColor || '#ffffff'}
                  onChange={(e) => handleUpdateColorRule(index, {
                    style: { ...rule.style, backgroundColor: e.target.value },
                  })}
                  size="small"
                  sx={{ width: 80 }}
                />
                <IconButton onClick={() => handleRemoveColorRule(index)} color="error" size="small">
                  <Delete />
                </IconButton>
              </Box>
            ))}

            {colorRules.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                No color rules defined.
              </Typography>
            )}
          </Paper>

          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Default Style</Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Background Color"
                type="color"
                value={defaultStyle.backgroundColor || '#ffffff'}
                onChange={(e) => setDefaultStyle(prev => ({ ...prev, backgroundColor: e.target.value }))}
                size="small"
              />
              <TextField
                label="Text Color"
                type="color"
                value={defaultStyle.textColor || '#000000'}
                onChange={(e) => setDefaultStyle(prev => ({ ...prev, textColor: e.target.value }))}
                size="small"
              />
            </Box>
          </Paper>

          <TextField
            label="Description (Optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            multiline
            rows={2}
            fullWidth
          />
        </Box>

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} startIcon={<Cancel />}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          startIcon={<Save />}
          disabled={loading || !keyColumn}
        >
          {loading ? 'Saving...' : 'Save Styler'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};