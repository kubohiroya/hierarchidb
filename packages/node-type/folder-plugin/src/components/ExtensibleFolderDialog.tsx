import React, { useCallback, useMemo, useState } from 'react';
import { Grid, TextField } from '@mui/material';
import { Folder as FolderIcon } from '@mui/icons-material';
import { type DialogStep, MultiStepDialog } from '@hierarchidb/ui-dialog';
import { useDialogUrlSync } from '@hierarchidb/runtime-ui-plugin-dialog';
import type { DialogStepDefinition, StepValidation, ValidationResult } from '@hierarchidb/common-type';
import { NodeId } from '@hierarchidb/common-type';
import type { FolderCreateData, FolderDisplayData, FolderEditData } from '../types';

// IconGroupSettings is exported by deprecated components; import type via that module if needed
export type IconGroupSettings = {
  normalMode: 'hidden' | 'always' | 'hover';
  fullscreenMode: 'hidden' | 'always' | 'hover';
};

/**
 * Base step data for folder-plugin dialogs
 */
export interface FolderStepData {
  name: string;
  description?: string;
}

/**
 * Props for the extensible folder-plugin base-dialog
 */
export interface ExtensibleFolderDialogProps {
  /**
   * Mode of the base-dialog
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
   * Current folder-plugin data (for edit mode)
   */
  currentData?: FolderDisplayData;

  /**
   * Called when base-dialog is submitted with final data
   */
  onSubmit: (data: FolderCreateData | FolderEditData) => Promise<void>;

  /**
   * Called when base-dialog is cancelled
   */
  onCancel: () => void;

  /**
   * Whether the base-dialog is open
   */
  open?: boolean;

  /**
   * Additional steps to include (from extensions)
   */
  additionalSteps?: DialogStepDefinition[];

  /**
   * Icon to display in base-dialog title
   */
  icon?: React.ReactNode;

  /**
   * Title for the base-dialog
   */
  title?: string;

  /**
   * Icon group display settings
   */
  iconGroupSettings?: IconGroupSettings;
}

/**
 * Base validation for folder-plugin name and description
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

    return errors.length === 0 ? { valid: true } : { valid: false, message: errors.join(', ') };
  }

  canProceed(data: FolderStepData): boolean {
    return !!data.name?.trim();
  }
}

/**
 * Base step component for folder-plugin name and description
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
    [data, onChange],
  );

  const handleDescriptionChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange({ ...data, description: e.target.value });
    },
    [data, onChange],
  );

  const nameError = errors?.find((e) => e.includes('name'));
  const descriptionError = errors?.find((e) => e.includes('Description'));

  return (
    <Grid container spacing={2}>
      <Grid>
        <TextField
          autoFocus
          fullWidth
          label="Folder Name"
          value={data.name || ''}
          onChange={handleNameChange}
          error={!!nameError}
          helperText={nameError || 'Enter a name for the folder-plugin'}
          required
          disabled={isSubmitting}
          placeholder="Enter folder name..."
        />
      </Grid>

      <Grid>
        <TextField
          fullWidth
          multiline
          rows={3}
          label="Description"
          value={data.description || ''}
          onChange={handleDescriptionChange}
          error={!!descriptionError}
          helperText={descriptionError || 'Optional description for the folder-plugin'}
          disabled={isSubmitting}
          placeholder="Enter optional description..."
        />
      </Grid>
    </Grid>
  );
};

/**
 * Extensible folder-plugin base-dialog that supports additional steps from plugins
 */
export const ExtensibleFolderDialog: React.FC<ExtensibleFolderDialogProps> = ({
                                                                                mode,
                                                                                parentId: _parentId,
                                                                                nodeId,
                                                                                currentData,
                                                                                onSubmit,
                                                                                onCancel,
                                                                                open = true,
                                                                                additionalSteps = [],
                                                                                icon = <FolderIcon />,
                                                                                title,
                                                                                iconGroupSettings,
                                                                              }) => {
  // URL-synced dialog state
  const {
    step: activeStep,
    setStep: setActiveStep,
    mode: urlMode,
    setMode,
    map,
    setMap,
    clearParams,
  } = useDialogUrlSync({
    defaults: { step: 0, mode: 'normal' },
    // Tests are sensitive to async updates; keep sync to avoid act() warnings
    debounce: { map: 0 },
    history: { step: 'replace' },
  });
  // Build the base step definition
  const baseStep = useMemo<DialogStepDefinition>(
    () => ({
      stepNumber: 1,
      title: 'Basic Information',
      component: FolderBaseStep,
      validation: {
        validate: (data: any) => new FolderStepValidation().validate(data),
      },
    }),
    [],
  );

  // Combine base step with additional steps
  const allSteps = useMemo(() => [baseStep, ...additionalSteps], [baseStep, additionalSteps]);

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

  // ダイアログを閉じる際にURLパラメータもクリア
  const handleClose = useCallback(() => {
    onCancel();
  }, [onCancel]);

  // Handle base-dialog submission
  const handleSubmit = useCallback(
    async (finalData: Record<string, any>) => {
      // Extract base folder-plugin data
      const folderData: FolderCreateData = {
        name: finalData.name?.trim() || '',
        description: finalData.description?.trim() || undefined,
      };

      // Extract extension fields (exclude base keys)
      const extensionData = Object.fromEntries(
        Object.entries(finalData).filter(([k]) => k !== 'name' && k !== 'description'),
      );

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
        Object.keys(finalData).forEach((key) => {
          if (key !== 'name' && key !== 'description') {
            (changes as any)[key] = (finalData as any)[key];
          }
        });

        await onSubmit(changes);
      } else {
        // Include only base fields + extension fields for create mode
        await onSubmit({ ...folderData, ...extensionData });
      }

      // no-op: URL params removed
    },
    [mode, currentData, onSubmit],
  );

  // Determine base-dialog title
  const dialogTitle = title || (mode === 'create' ? 'Create New Folder' : 'Edit Folder');

  // Combine title with icon for display
  const displayTitle = (
    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      {icon}
      {dialogTitle}
    </span>
  );

  // 拡張データに地図パラメータを含める
  const [formData, setFormData] = useState<any>(() => {
    const data: any = { ...initialData };
    return data;
  });
  const [formErrors, setFormErrors] = useState<string[] | undefined>(undefined);

  // Ensure we start at step 0 when the dialog opens (avoid leaking URL state across tests/routes)
  React.useLayoutEffect(() => {
    if (open) {
      clearParams();
      setActiveStep(0);
    }
  }, [open, clearParams, setActiveStep]);

  // 地図パラメータ変更のハンドラー
  const handleMapParamsChange = useCallback(
    (params: { zoom: number; lng: number; lat: number } | undefined) => {
      if (params) setMap({ lng: params.lng, lat: params.lat, zoom: params.zoom });
    },
    [setMap],
  );

  // Convert DialogStepDefinition[] -> DialogStep[] for ui-dialog
  const stepsForUi = useMemo<DialogStep[]>(() => {
    return allSteps.map((s) => ({
      id: String(s.stepNumber),
      label: s.title,
      component: React.createElement(s.component as any, {
        data: formData,
        onChange: (next: any) => setFormData((prev: any) => ({ ...prev, ...next })),
        errors: formErrors,
        isSubmitting: false,
      }),
      validate: s.validation
        ? async () => {
          try {
            const res = await s.validation!.validate(formData as any);
            if (res && typeof res === 'object' && 'valid' in res) {
              setFormErrors(res.valid ? [] : (res as any).message ? [(res as any).message] : ['Validation failed']);
              return (res as any).valid as boolean;
            }
            return !!res;
          } catch {
            setFormErrors(['Validation failed']);
            return false;
          }
        }
        : undefined,
    }));
  }, [allSteps, formData, formErrors]);

  return (
    <MultiStepDialog
      open={open}
      mode={mode}
      title={dialogTitle}
      icon={icon}
      steps={stepsForUi}
      activeStep={activeStep}
      onStepChange={setActiveStep}
      fullScreen={urlMode === 'full'}
      onFullscreenChange={(is) => setMode(is ? 'full' : 'normal')}
      onSubmit={() => handleSubmit(formData)}
      onCancel={handleClose}
      submitText="Complete"
      showFullscreenToggle={true}
    />
  );
};

ExtensibleFolderDialog.displayName = 'ExtensibleFolderDialog';
