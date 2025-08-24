import React, { useState, useCallback } from 'react';
import { TextField, Grid } from '@mui/material';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
} from '@mui/material';
import { FolderIcon } from './FolderIcon';
import type { FolderCreateData } from '../types';
import { NodeId } from '@hierarchidb/common-core';

export interface FolderCreateDialogProps {
  /**
   * Parent node where the folder will be created
   */
  parentNodeId: NodeId;

  /**
   * Called when user submits the form
   */
  onSubmit: (data: FolderCreateData) => Promise<void>;

  /**
   * Called when user cancels the dialog
   */
  onCancel: () => void;

  /**
   * Whether the dialog is open
   */
  open?: boolean;
}

/**
 * Dialog for creating new folders
 */
export const FolderCreateDialog: React.FC<FolderCreateDialogProps> = ({
  parentNodeId: _parentNodeId,
  onSubmit,
  onCancel,
  open = true,
}) => {
  const [formData, setFormData] = useState<FolderCreateData>({
    name: '',
    description: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState(false);

  // Validate form data
  const validateForm = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Folder name is required';
    } else if (formData.name.length > 255) {
      newErrors.name = 'Folder name is too long';
    } else if (!/^[^<>:"/\\|?*]+$/.test(formData.name)) {
      newErrors.name = 'Invalid characters in folder name';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData.name]);

  // Update form data and mark as dirty
  const handleFormDataChange = useCallback(
    (newData: FolderCreateData) => {
      setFormData(newData);
      setIsDirty(true);
      // Clear errors when user types
      if (errors.name && newData.name !== formData.name) {
        setErrors((prev) => {
          const { name, ...rest } = prev;
          return rest;
        });
      }
    },
    [errors.name, formData.name]
  );

  // Handle form submission
  const handleSubmit = useCallback(async () => {
    const cleanData = {
      name: formData.name.trim(),
      description: formData.description?.trim() || undefined,
    };
    await onSubmit(cleanData);
    // Reset form after successful submission
    setFormData({ name: '', description: '' });
    setIsDirty(false);
  }, [onSubmit, formData]);

  const isValid = validateForm();

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmitWrapper = async () => {
    if (!isValid || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await handleSubmit();
    } catch (error) {
      console.error('Failed to create folder:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (isDirty) {
      if (window.confirm('You have unsaved changes. Are you sure you want to cancel?')) {
        onCancel();
      }
    } else {
      onCancel();
    }
  };

  return (
    <Dialog open={open} onClose={handleCancel} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Typography
          variant="h6"
          component="div"
          sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
        >
          <FolderIcon />
          Create New Folder
        </Typography>
      </DialogTitle>

      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid item xs={12}>
            <TextField
              autoFocus
              fullWidth
              label="Folder Name"
              value={formData.name}
              onChange={(e) => handleFormDataChange({ ...formData, name: e.target.value })}
              error={!!errors.name}
              helperText={errors.name || 'Enter a name for the new folder'}
              required
              disabled={isSubmitting}
              placeholder="Enter folder name..."
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Description"
              value={formData.description}
              onChange={(e) => handleFormDataChange({ ...formData, description: e.target.value })}
              error={!!errors.description}
              helperText={errors.description || 'Optional description for the folder'}
              disabled={isSubmitting}
              placeholder="Enter optional description..."
            />
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmitWrapper}
          variant="contained"
          disabled={!isValid || isSubmitting}
        >
          {isSubmitting ? 'Creating...' : 'Create Folder'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

FolderCreateDialog.displayName = 'FolderCreateDialog';
