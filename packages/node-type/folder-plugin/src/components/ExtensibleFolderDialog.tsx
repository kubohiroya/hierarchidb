import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { Grid, TextField } from '@mui/material';
import { Folder as FolderIcon } from '@mui/icons-material';
import {
  type DialogStep,
  type StepStateEvaluator,
  HeadlessMultiStepDialog,
  type HeadlessMultiStepDialogProps,
  type StepNavigationEvent,
} from '@hierarchidb/ui-dialog';
import { folderExtensionRegistry } from '../api/FolderExtensionAPI.js';
import { useDialogUrlSync } from '@hierarchidb/runtime-ui-plugin-dialog';
import type { DialogStepDefinition, StepValidation, ValidationResult } from '@hierarchidb/common-type';
import { NodeId } from '@hierarchidb/common-type';
import type { FolderCreateData, FolderDisplayData, FolderEditData } from '../types.js';

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

  // Display mode persistence per-node (standard | maximized | fullscreen)
  // Dexie-backed persistence
  const [displayMode, setDisplayMode] = useState<'standard' | 'maximized' | 'fullscreen'>('standard');
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (nodeId) {
        const { getPeerDisplayMode } = await import('~/shared/peer-display-mode');
        const m = (await getPeerDisplayMode('folder', String(nodeId))) || 'standard';
        if (mounted) setDisplayMode(m);
      }
    })();
    return () => { mounted = false; };
  }, [nodeId]);

  // URL の mode=full を最優先（戻る操作等で同期される）
  React.useEffect(() => {
    setDisplayMode((prev) => (urlMode === 'full' ? 'fullscreen' : (prev === 'fullscreen' ? 'standard' : prev)));
  }, [urlMode]);

  const persistDisplayMode = useCallback((mode: 'standard' | 'maximized' | 'fullscreen') => {
    (async () => {
      if (nodeId) {
        const { setPeerDisplayMode } = await import('~/shared/peer-display-mode');
        await setPeerDisplayMode('folder', String(nodeId), mode);
      }
    })();
  }, [nodeId]);

  // Combine base step with registry-provided steps and additional steps (props)
  const allSteps = useMemo<DialogStepDefinition[]>(() => {
    const fromRegistry: DialogStepDefinition[] = mode === 'edit'
      ? folderExtensionRegistry.getEditDialogSteps()
      : folderExtensionRegistry.getCreateDialogSteps();

    // Deduplicate by stepNumber; explicit props win over registry; base wins by default
    const byNumber = new Map<number, DialogStepDefinition>();
    byNumber.set(1, baseStep);
    for (const s of fromRegistry) byNumber.set(s.stepNumber, s);
    for (const s of additionalSteps) byNumber.set(s.stepNumber, s);

    return Array.from(byNumber.values()).sort((a, b) => a.stepNumber - b.stepNumber);
  }, [baseStep, additionalSteps, mode]);

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

  // 拡張データに地図パラメータを含める
  const [formData, setFormData] = useState<any>(() => {
    const data: any = { ...initialData };
    return data;
  });
  const [formErrors, setFormErrors] = useState<string[] | undefined>(undefined);
  const hasUnsavedChanges = useMemo(() => {
    return JSON.stringify(formData) !== JSON.stringify(initialData);
  }, [formData, initialData]);

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
            // Normalize result shape
            if (typeof res === 'boolean') {
              setFormErrors(res ? [] : ['Validation failed']);
              return res;
            }
            if (res && typeof res === 'object') {
              const isValid = 'isValid' in res ? (res as any).isValid : ('valid' in res ? (res as any).valid : true);
              const message = (res as any).message as string | undefined;
              setFormErrors(isValid ? [] : message ? [message] : (res as any).errors ?? ['Validation failed']);
              return !!isValid;
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

  // === Step state evaluator (navigable/filled) based on validation + dependsOn ===
  const stepStateEvaluator = useMemo<StepStateEvaluator>(() => {
    const registeredEvaluators = folderExtensionRegistry.getDialogEvaluators();
    const numberToIndex = new Map<number, number>();
    allSteps.forEach((s, idx) => numberToIndex.set(s.stepNumber, idx));
    const stepNumbers = allSteps.map(s => s.stepNumber);

    const normalizeValidate = async (def: DialogStepDefinition | undefined): Promise<boolean> => {
      if (!def?.validation?.validate) return true;
      try {
        const r = await def.validation.validate(formData);
        if (typeof r === 'boolean') return r;
        if (r && typeof r === 'object') {
          if ('isValid' in r) return !!(r as any).isValid;
          if ('valid' in r) return !!(r as any).valid;
        }
        return !!r;
      } catch {
        return false;
      }
    };

    const defaultEvaluator: StepStateEvaluator = {
      getFilledSteps: (_data: any, stepNumbers?: number[]) => {
        if (!stepNumbers || stepNumbers.length === filledCache.length) return filledCache;
        return stepNumbers.map((_, i) => filledCache[i] ?? false);
      },
      getNavigableSteps: (_data: any) => {
        // Heuristic, stable, and fast:
        // - Always allow current index and the immediate next index
        // - Respect dependsOn by requiring all dependency stepNumbers to be <= current stepNumber
        //   (i.e., cannot jump ahead before deps come earlier in the flow)
        const nav = allSteps.map((_s, i) => false);
        const current = activeStep;
        const currentStepNumber = allSteps[current]?.stepNumber ?? 1;
        allSteps.forEach((def, idx) => {
          if (idx === current || idx === current + 1 || idx === 0) {
            const deps = def.dependsOn || [];
            const ok = deps.every((stepNo) => stepNo <= currentStepNumber);
            nav[idx] = ok;
          }
        });
        return nav;
      },
    };

    // Compose with registered plugin evaluators (AND 合成: より厳しい制約を優先)
    const composeAnd = (base: boolean[], extras: boolean[][]) => {
      if (extras.length === 0) return base;
      const len = base.length;
      const out = base.slice();
      for (const arr of extras) {
        for (let i = 0; i < len; i++) {
          const v = typeof arr[i] === 'boolean' ? arr[i] as boolean : true; // 未定義は非拘束として扱う
          out[i] = out[i] && v;
        }
      }
      return out;
    };

    return {
      getFilledSteps: (data: any) => {
        const base = defaultEvaluator.getFilledSteps(data);
        const pluginFilled = registeredEvaluators.map(ev => ev.getFilledSteps(data, stepNumbers));
        return composeAnd(base, pluginFilled);
      },
      getNavigableSteps: (data: any) => {
        const base = defaultEvaluator.getNavigableSteps(data);
        const pluginNav = registeredEvaluators.map(ev => ev.getNavigableSteps(data, stepNumbers));
        return composeAnd(base, pluginNav);
      },
    };
  }, [allSteps, formData, activeStep, filledCache]);

  // Cache for filled-state: run async validations in effect and keep last known results
  const [filledCache, setFilledCache] = useState<boolean[]>(() => allSteps.map(() => false));
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const results: boolean[] = [];
      for (const def of allSteps) {
        if (!def.validation?.validate) {
          results.push(true);
          continue;
        }
        try {
          const r = await def.validation.validate(formData);
          const ok = typeof r === 'boolean' ? r : ('isValid' in (r as any) ? (r as any).isValid : ('valid' in (r as any) ? (r as any).valid : true));
          results.push(!!ok);
        } catch {
          results.push(false);
        }
      }
      if (!cancelled) setFilledCache(results);
    })();
    return () => { cancelled = true; };
  }, [allSteps, formData]);

  // === Submit eligibility (compose: host default AND all plugin guards) ===
  const navigableSteps = useMemo(() => stepStateEvaluator.getNavigableSteps(formData), [stepStateEvaluator, formData]);
  const filledSteps = useMemo(() => stepStateEvaluator.getFilledSteps(formData), [stepStateEvaluator, formData]);
  const enabledStepIndices = useMemo(() => (
    (navigableSteps || []).reduce<number[]>((acc, allow, idx) => {
      if (allow) acc.push(idx);
      return acc;
    }, [])
  ), [navigableSteps]);
  const validatedStepIndices = useMemo(() => (
    (filledSteps || []).reduce<number[]>((acc, valid, idx) => {
      if (valid) acc.push(idx);
      return acc;
    }, [])
  ), [filledSteps]);
  const committableStepIndices = useMemo(() => (
    stepsForUi.length ? [stepsForUi.length - 1] : []
  ), [stepsForUi.length]);

  const invalidMessageMap = useMemo(() => {
    if (!formErrors || formErrors.length === 0) return {};
    const stepId = stepsForUi[activeStep]?.id ?? String(activeStep);
    return { [stepId]: formErrors.join('\n') } as Record<string, string>;
  }, [formErrors, stepsForUi, activeStep]);

  const handleNavigate = useCallback((event: StepNavigationEvent) => {
    switch (event.type) {
      case 'direct':
        setActiveStep(event.targetIndex);
        break;
      case 'next':
        setActiveStep((prev) => Math.min(prev + 1, stepsForUi.length - 1));
        break;
      case 'back':
        setActiveStep((prev) => Math.max(prev - 1, 0));
        break;
    }
  }, [stepsForUi.length]);

  const renderHeader = useCallback<HeadlessMultiStepDialogProps<any>['renderHeader']>((props) => {
    return (
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid #dde1eb' }}>
        {icon}
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600 }}>{dialogTitle}</div>
          <small style={{ color: '#64748b' }}>
            Step {props.activeStepIndex + 1} / {stepsForUi.length}
          </small>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={() => handleNavigate({ type: 'back' })} disabled={props.activeStepIndex === 0}>Back</button>
          <button type="button" onClick={() => handleNavigate({ type: 'next' })} disabled={props.activeStepIndex >= stepsForUi.length - 1}>Next</button>
        </div>
      </header>
    );
  }, [dialogTitle, icon, handleNavigate, stepsForUi.length]);

  const renderContent = useCallback<HeadlessMultiStepDialogProps<any>['renderContent']>((props) => {
    const stepNode = stepsForUi[props.activeStepIndex]?.component;
    const currentErrors = invalidMessageMap[stepsForUi[props.activeStepIndex]?.id ?? ''];
    return (
      <div style={{ padding: 16 }}>
        {stepNode}
        {currentErrors && (
          <div style={{ marginTop: 12, color: '#d32f2f' }}>{currentErrors}</div>
        )}
      </div>
    );
  }, [stepsForUi, invalidMessageMap]);

  const renderFooter = useCallback<HeadlessMultiStepDialogProps<any>['renderFooter']>((props) => {
    const canSubmit = filledSteps?.every(Boolean) ?? true;
    return (
      <footer style={{ padding: '12px 16px', borderTop: '1px solid #dde1eb', display: 'flex', justifyContent: 'space-between' }}>
        <button type="button" onClick={handleClose}>Cancel</button>
        <button type="button" onClick={() => props.onRequestCommit?.()} disabled={!canSubmit}>
          Complete
        </button>
      </footer>
    );
  }, [handleClose, filledSteps]);

  return (
    <HeadlessMultiStepDialog
      open={open}
      stepComponents={stepsForUi.map((step) => ({ id: step.id, label: step.label ?? step.id, component: () => null }))}
      stepData={formData}
      onStepDataChange={() => undefined}
      activeStepIndex={activeStep}
      onStepNavigate={handleNavigate}
      enabledStepIndices={enabledStepIndices}
      validatedStepIndices={validatedStepIndices}
      committableStepIndices={committableStepIndices}
      invalidMessageMap={invalidMessageMap}
      onRequestClose={() => handleClose()}
      onRequestCommit={() => handleSubmit(formData)}
      isDirty={hasUnsavedChanges}
      displayMode={displayMode}
      onDisplayModeChange={(m) => {
        if (m === 'fullscreen') setMode('full'); else setMode('normal');
        setDisplayMode(m);
        persistDisplayMode(m);
      }}
      renderHeader={renderHeader}
      renderContent={renderContent}
      renderFooter={renderFooter}
    />
  );
};

ExtensibleFolderDialog.displayName = 'ExtensibleFolderDialog';
