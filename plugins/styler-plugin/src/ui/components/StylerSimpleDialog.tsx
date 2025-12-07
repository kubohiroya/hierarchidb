import type { NodeId } from '@hierarchidb/common-types';
import { Add, Cancel, Delete, Save } from '@mui/icons-material';
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
import React, { useCallback, useState, useId } from 'react';
import type {
  StylerColorRule,
  StylerEntity,
  StylerStyle,
} from '../../common/types/StylerEntity.js';

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
  const controlId = useId();
  type ColorRuleState = StylerColorRule & { _id: string };
  const generateRuleId = useCallback(
    () =>
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `rule-${Date.now()}-${Math.random()}`,
    []
  );

  const [keyColumn, setKeyColumn] = useState('');
  const [colorRules, setColorRules] = useState<ColorRuleState[]>([]);
  const [defaultStyle, setDefaultStyle] = useState<StylerStyle>({
    backgroundColor: '#ffffff',
    textColor: '#000000',
    borderColor: '#cccccc',
  });
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const handleAddColorRule = useCallback(() => {
    const newRule: ColorRuleState = {
      _id: generateRuleId(),
      column: '',
      operator: 'equals',
      value: '',
      style: {
        backgroundColor: '#ffeb3b',
        textColor: '#000000',
      },
    };
    setColorRules((prev) => [...prev, newRule]);
  }, [generateRuleId]);

  const handleUpdateColorRule = useCallback((index: number, updates: Partial<StylerColorRule>) => {
    setColorRules((prev) => prev.map((rule, i) => (i === index ? { ...rule, ...updates } : rule)));
  }, []);

  const handleRemoveColorRule = useCallback((index: number) => {
    setColorRules((prev) => prev.filter((_, i) => i !== index));
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
        colorRules: colorRules.map(({ _id, ...rule }) => rule),
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
      setColorRules(
        (existingEntity.colorRules || []).map((rule, index) => ({
          ...rule,
          _id: `${existingEntity.nodeId}-rule-${index}`,
        }))
      );
      setDefaultStyle(existingEntity.defaultStyle || { textColor: '', backgroundColor: '' });
      setDescription(existingEntity.description || '');
    }
  }, [existingEntity]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{existingEntity ? 'Edit Styler' : 'Create Styler'}</DialogTitle>

      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 1 }}>
          <TextField
            label="Key Column"
            id={`${controlId}-key-column`}
            name="key-column"
            value={keyColumn}
            onChange={(e) => setKeyColumn(e.target.value)}
            fullWidth
            required
            inputProps={{ id: `${controlId}-key-column`, name: 'key-column' }}
          />

          <Paper sx={{ p: 2 }}>
            <Box
              sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}
            >
              <Typography variant="h6">Color Rules</Typography>
              <Button startIcon={<Add />} onClick={handleAddColorRule}>
                Add Rule
              </Button>
            </Box>

            {colorRules.map((rule, index) => (
              <Box key={rule._id} sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
                <TextField
                  label="Column"
                  id={`${controlId}-rule-${rule._id}-column`}
                  name={`rule-${rule._id}-column`}
                  value={rule.column}
                  onChange={(e) => handleUpdateColorRule(index, { column: e.target.value })}
                  size="small"
                  inputProps={{ id: `${controlId}-rule-${rule._id}-column`, name: `rule-${rule._id}-column` }}
                />
                <FormControl sx={{ minWidth: 120 }}>
                  <InputLabel id={`${controlId}-rule-${rule._id}-operator-label`}>Operator</InputLabel>
                  <Select
                    labelId={`${controlId}-rule-${rule._id}-operator-label`}
                    id={`${controlId}-rule-${rule._id}-operator`}
                    value={rule.operator}
                    onChange={(e) =>
                      handleUpdateColorRule(index, {
                        operator: e.target.value as StylerColorRule['operator'],
                      })
                    }
                    label="Operator"
                    size="small"
                    inputProps={{ id: `${controlId}-rule-${rule._id}-operator`, name: `rule-${rule._id}-operator` }}
                  >
                    <MenuItem value="equals">Equals</MenuItem>
                    <MenuItem value="contains">Contains</MenuItem>
                    <MenuItem value="greaterThan">Greater Than</MenuItem>
                    <MenuItem value="lessThan">Less Than</MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  label="Value"
                  id={`${controlId}-rule-${rule._id}-value`}
                  name={`rule-${rule._id}-value`}
                  value={rule.value}
                  onChange={(e) => handleUpdateColorRule(index, { value: e.target.value })}
                  size="small"
                  inputProps={{ id: `${controlId}-rule-${rule._id}-value`, name: `rule-${rule._id}-value` }}
                />
                <TextField
                  label="Color"
                  type="color"
                  id={`${controlId}-rule-${rule._id}-color`}
                  name={`rule-${rule._id}-color`}
                  value={rule.style.backgroundColor || '#ffffff'}
                  onChange={(e) =>
                    handleUpdateColorRule(index, {
                      style: { ...rule.style, backgroundColor: e.target.value },
                    })
                  }
                  size="small"
                  sx={{ width: 80 }}
                  inputProps={{ id: `${controlId}-rule-${rule._id}-color`, name: `rule-${rule._id}-color` }}
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
            <Typography variant="h6" gutterBottom>
              Default Style
            </Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Background Color"
                type="color"
                value={defaultStyle.backgroundColor || '#ffffff'}
                onChange={(e) =>
                  setDefaultStyle((prev: StylerStyle) => ({
                    ...prev,
                    backgroundColor: e.target.value,
                  }))
                }
                size="small"
              />
              <TextField
                label="Text Color"
                type="color"
                value={defaultStyle.textColor || '#000000'}
                onChange={(e) =>
                  setDefaultStyle((prev: StylerStyle) => ({ ...prev, textColor: e.target.value }))
                }
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
