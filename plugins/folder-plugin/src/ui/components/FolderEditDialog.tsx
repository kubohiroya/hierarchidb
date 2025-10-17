import { useCallback, useEffect, useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material';
import { FolderIcon } from './FolderIcon.js';
import type { FolderDisplayData, FolderEditData } from '../../common/types/index.js';
import type { NodeId } from '@hierarchidb/common-types';

export interface FolderEditDialogProps {
  /**
   * ID of the folder-plugin being edited
   */
  nodeId: NodeId;

  /**
   * Current folder-plugin data
   */
  currentData: FolderDisplayData;

  /**
   * Called when user submits changes
   */
  onSubmit: (changes: FolderEditData) => Promise<void>;

  /**
   * Called when user cancels the base-dialog
   */
  onCancel: () => void;

  /**
   * Whether the base-dialog is open
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
      newErrors.name = 'Invalid characters in folder-plugin name';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData.name]);

  // Update form data
  const handleFormDataChange = useCallback(
    (newData: FolderEditData) => {
      setFormData(newData);
      setIsDirty(hasChanges());
      // Clear errors when user types
      if (errors.name && newData.name !== formData.name) {
        setErrors((prev) => {
          const { name, ...rest } = prev;
          return rest;
        });
      }
    },
    [errors.name, formData.name, hasChanges],
  );

  // Handle form submission
  const handleSubmit = useCallback(async () => {
    // Prepare changes object with only modified fields
    //const changes: FolderEditData = {};
    const newName = formData.name?.trim();
    const name = (newName !== currentData.name) ? newName : undefined;
    const newDescription = formData.description?.trim() || undefined;
    const description = (newDescription !== currentData.description)? newDescription: undefined;

    // Only submit if there are actual changes
    if (name) {
      await onSubmit({
        name, description
      });
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
        <Typography
          variant="h6"
          component="div"
          sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
        >
          <FolderIcon />
          Edit Folder
        </Typography>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            autoFocus
            fullWidth
            label="Folder Name"
            value={formData.name}
            onChange={(e) => handleFormDataChange({ ...formData, name: e.target.value })}
            error={!!errors.name}
            helperText={errors.name || 'Enter a name for the folder-plugin'}
            required
            disabled={isSubmitting}
            placeholder="Enter folder name..."
          />

          <TextField
            fullWidth
            multiline
            rows={3}
            label="Description"
            value={formData.description}
            onChange={(e) => handleFormDataChange({ ...formData, description: e.target.value })}
            error={!!errors.description}
            helperText={errors.description || 'Optional description for the folder-plugin'}
            disabled={isSubmitting}
            placeholder="Enter optional description..."
          />
        </Stack>
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
