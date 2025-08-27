import React, { useCallback, useMemo } from 'react';
import { TextField, Grid } from '@mui/material';
import {
  MultiStepDialog,
  type DialogStepDefinition,
  type ValidationResult,
  type StepValidation,
} from '@hierarchidb/ui-plugin-base';

import type { FolderCreateData, FolderEditData, FolderDisplayData } from '../types';
import { NodeId } from '@hierarchidb/common-core';

/**
 * Base step data for folder dialogs
 */
export interface FolderStepData {
  name: string;
  description?: string;
}

/**
 * Props for the extensible folder dialog
 */
export interface ExtensibleFolderDialogProps {
  /**
   * Mode of the dialog
   */
  mode: 'create' | 'edit';

  /**
   * Parent node ID (for create mode)
   */
  parentId?: NodeId;

  /**
   * Node ID being edited (for edit mode)
   */
  nodeId?: NodeId;

  /**
   * Current folder data (for edit mode)
   */
  currentData?: FolderDisplayData;

  /**
   * Called when dialog is submitted with final data
   */
  onSubmit: (data: FolderCreateData | FolderEditData) => Promise<void>;

  /**
   * Called when dialog is cancelled
   */
  onCancel: () => void;

  /**
   * Whether the dialog is open
   */
  open?: boolean;

  /**
   * Additional steps to include (from extensions)
   */
  additionalSteps?: DialogStepDefinition[];

  /**
   * Icon to display in dialog title
   */
  icon?: React.ReactNode;

  /**
   * Title for the dialog
   */
  title?: string;
}

/**
 * Base validation for folder name and description
 */
class FolderStepValidation implements StepValidation<FolderStepData> {
  async validate(data: FolderStepData): Promise<ValidationResult> {
    const errors: string[] = [];

    // Validate name
    if (!data.name?.trim()) {
      errors.push('Folder name is required');
    } else if (data.name.length > 255) {
      errors.push('Folder name is too long (max 255 characters)');
    } else if (!/^[^<>:"/\\|?*]+$/.test(data.name)) {
      errors.push('Folder name contains invalid characters');
    }

    // Validate description (optional)
    if (data.description && data.description.length > 1000) {
      errors.push('Description is too long (max 1000 characters)');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  canProceed(data: FolderStepData): boolean {
    return !!data.name?.trim();
  }
}

/**
 * Base step component for folder name and description
 */
const FolderBaseStep: React.FC<{
  data: FolderStepData;
  onChange: (data: FolderStepData) => void;
  errors?: string[];
  isSubmitting?: boolean;
}> = ({ data, onChange, errors, isSubmitting }) => {
  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange({ ...data, name: e.target.value });
    },
    [data, onChange]
  );

  const handleDescriptionChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange({ ...data, description: e.target.value });
    },
    [data, onChange]
  );

  const nameError = errors?.find(e => e.includes('name'));
  const descriptionError = errors?.find(e => e.includes('Description'));

  return (
    <Grid container spacing={2}>
      <Grid item xs={12}>
        <TextField
          autoFocus
          fullWidth
          label="Folder Name"
          value={data.name || ''}
          onChange={handleNameChange}
          error={!!nameError}
          helperText={nameError || 'Enter a name for the folder'}
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
          value={data.description || ''}
          onChange={handleDescriptionChange}
          error={!!descriptionError}
          helperText={descriptionError || 'Optional description for the folder'}
          disabled={isSubmitting}
          placeholder="Enter optional description..."
        />
      </Grid>
    </Grid>
  );
};

/**
 * Extensible folder dialog that supports additional steps from plugins
 */
export const ExtensibleFolderDialog: React.FC<ExtensibleFolderDialogProps> = ({
  mode,
  parentId: _parentId,
  nodeId: _nodeId,
  currentData,
  onSubmit,
  onCancel,
  open = true,
  additionalSteps = [],
  icon: _icon, // TODO: MultiStepDialog doesn't support icons yet
  title,
}) => {
  // Build the base step definition
  const baseStep = useMemo<DialogStepDefinition>(
    () => ({
      stepNumber: 1,
      title: 'Basic Information',
      component: FolderBaseStep,
      validation: {
        validate: (data: any) => new FolderStepValidation().validate(data)
      },
    }),
    []
  );

  // Combine base step with additional steps
  const allSteps = useMemo(
    () => [baseStep, ...additionalSteps],
    [baseStep, additionalSteps]
  );

  // Set initial data based on mode
  const initialData = useMemo(() => {
    if (mode === 'edit' && currentData) {
      return {
        name: currentData.name,
        description: currentData.description || '',
      };
    }
    return {
      name: '',
      description: '',
    };
  }, [mode, currentData]);

  // Handle dialog submission
  const handleSubmit = useCallback(
    async (finalData: Record<string, any>) => {
      // Extract base folder data
      const folderData: FolderCreateData = {
        name: finalData.name?.trim() || '',
        description: finalData.description?.trim() || undefined,
      };

      // In edit mode, only send changed fields
      if (mode === 'edit' && currentData) {
        const changes: FolderEditData = {};
        
        if (folderData.name !== currentData.name) {
          changes.name = folderData.name;
        }
        
        if (folderData.description !== currentData.description) {
          changes.description = folderData.description;
        }

        // Include extension data in changes
        Object.keys(finalData).forEach(key => {
          if (key !== 'name' && key !== 'description') {
            (changes as any)[key] = (finalData as any)[key];
          }
        });

        await onSubmit(changes);
      } else {
        // Include all data for create mode
        await onSubmit({ ...finalData, ...folderData });
      }
    },
    [mode, currentData, onSubmit]
  );

  // Determine dialog title
  const dialogTitle = title || (mode === 'create' ? 'Create New Folder' : 'Edit Folder');

  // Determine dialog icon


  return (
    <MultiStepDialog
      open={open}
      title={dialogTitle}

      steps={allSteps}
      initialData={initialData}
      onComplete={handleSubmit}
      onClose={onCancel}

      maxWidth="sm"
      fullWidth
    />
  );
};

ExtensibleFolderDialog.displayName = 'ExtensibleFolderDialog';