import React, { useState, useEffect, useCallback } from 'react';
import {
  TextField,
  Grid,
} from '@mui/material';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
} from '@mui/material';
import { FolderIcon } from './FolderIcon';
import type { FolderEditData, FolderDisplayData } from '../types';
import type { NodeId } from '../types';

export interface FolderEditDialogProps {
  /**
   * ID of the folder being edited
   */
  nodeId: NodeId;

  /**
   * Current folder data
   */
  currentData: FolderDisplayData;

  /**
   * Called when user submits changes
   */
  onSubmit: (changes: FolderEditData) => Promise<void>;

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
 * Dialog for editing existing folders
 */
export const FolderEditDialog: React.FC<FolderEditDialogProps> = ({
  nodeId: _nodeId,
  currentData,
  onSubmit,
  onCancel,
  open = true,
}) => {
  const [formData, setFormData] = useState<FolderEditData>({
    name: currentData.name,
    description: currentData.description || '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState(false);

  // Reset form when currentData changes
  useEffect(() => {
    setFormData({
      name: currentData.name,
      description: currentData.description || '',
    });
    setErrors({});
    setIsDirty(false);
  }, [currentData]);

  // Check if data has changed
  const hasChanges = useCallback(() => {
    return (
      formData.name?.trim() !== currentData.name ||
      (formData.description?.trim() || '') !== (currentData.description || '')
    );
  }, [formData, currentData]);

  // Validate form data
  const validateForm = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name?.trim()) {
      newErrors.name = 'Folder name is required';
    } else if (formData.name.length > 255) {
      newErrors.name = 'Folder name is too long';
    } else if (!/^[^<>:"/\\|?*]+$/.test(formData.name)) {
      newErrors.name = 'Invalid characters in folder name';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData.name]);

  // Update form data
  const handleFormDataChange = useCallback((newData: FolderEditData) => {
    setFormData(newData);
    setIsDirty(hasChanges());
    // Clear errors when user types
    if (errors.name && newData.name !== formData.name) {
      setErrors((prev) => {
        const { name, ...rest } = prev;
        return rest;
      });
    }
  }, [errors.name, formData.name, hasChanges]);

  // Handle form submission
  const handleSubmit = useCallback(async () => {
    // Prepare changes object with only modified fields
    const changes: FolderEditData = {};

    if (formData.name?.trim() !== currentData.name) {
      changes.name = formData.name!.trim();
    }

    const newDescription = formData.description?.trim() || undefined;
    if (newDescription !== currentData.description) {
      changes.description = newDescription;
    }

    // Only submit if there are actual changes
    if (Object.keys(changes).length > 0) {
      await onSubmit(changes);
    } else {
      onCancel();
    }
  }, [currentData, onSubmit, onCancel, formData]);

  const isValid = validateForm() && hasChanges();

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmitWrapper = async () => {
    if (!isValid || isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      await handleSubmit();
    } catch (error) {
      console.error('Failed to update folder:', error);
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
        <Typography variant="h6" component="div" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FolderIcon />
          Edit Folder
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
              helperText={errors.name || 'Enter a name for the folder'}
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
          {isSubmitting ? 'Saving...' : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

FolderEditDialog.displayName = 'FolderEditDialog';