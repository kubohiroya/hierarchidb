/**
 * Plugin Dialog Component
 * Integrates plugin-provided steps with MultiStepDialog
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DialogStep, MultiStepDialog } from '@hierarchidb/ui-dialog';
import { NodeId, TreeId } from '@hierarchidb/common-type';
import { PluginStepRegistry, type PluginStepConfig } from '../registry/PluginStepRegistry';
import { HostProfileRegistry } from '../registry/HostProfileRegistry';
import { composeStepConfigs } from '../services/StepComposer';
import { useWorkingCopy } from '../hooks/useWorkingCopy';
import { BasicInfoStep } from './steps/BasicInfoStep';
import { getIconComponent, getPresentation } from '../utils/pluginPresentation';
import {
  getPeerDisplayMode,
  getPeerDialogPosition,
  getPeerDialogSize,
  setPeerDisplayMode,
  setPeerDialogPosition,
  setPeerDialogSize,
} from '../utils/peerDialogPersistence';
import { getWorkerClientHook } from '@hierarchidb/runtime-worker-bootstrap';
import type { WorkerAPI } from '@hierarchidb/common-api';
import type { TagEntity } from '@hierarchidb/common-type';

export interface PluginDialogProps {
  /** Dialog mode */
  mode: 'create' | 'edit';

  /** Node type */
  nodeType: string;

  /** Node ID (working copy ID) */
  nodeId: NodeId;

  pageNodeId: NodeId;

  /** Tree ID */
  treeId: TreeId;

  /** Dialog open state */
  open: boolean;

  /** Initial step to display */
  initialStep?: number;

  /** Close handler */
  onClose: () => void;

  /** Success handler */
  onSuccess?: (_nodeId: NodeId) => void;
}

/**
 * Plugin Dialog Component
 */
export const PluginDialog: React.FC<PluginDialogProps> = ({
                                                            mode,
                                                            nodeType,
                                                            nodeId,
  pageNodeId,
                                                            treeId,
                                                            open,
                                                            initialStep = 0,
                                                            onClose,
                                                            onSuccess,
                                                          }) => {
  const navigate = useNavigate();
  const registry = PluginStepRegistry.getInstance();
  const hostRegistry = HostProfileRegistry.getInstance();
  // Acquire Worker client via app-registered hook (always call at top level).
  // The hook may return null before bootstrap; avoid destructuring null.
  type WorkerRef = WorkerAPI | { client?: WorkerAPI } | null;
  const useClientHook = (getWorkerClientHook<WorkerRef>() || (() => null));
  const ref = useClientHook();
  const client: WorkerAPI | null = ref && ('getQueryAPI' in (ref as any)) ? (ref as WorkerAPI) : ((ref as { client?: WorkerAPI })?.client ?? null);

  // Working copy management
  const {
    workingCopy,
    hasUnsavedChanges,
    updateWorkingCopy,
    saveWorkingCopy,
    saveDraft,
    discardWorkingCopy,
    loading,
    error,
  } = useWorkingCopy({
    mode,
    nodeType,
    nodeId,
    treeId,
    client,
  });

  // State
  const [activeStep, setActiveStep] = useState(initialStep);
  const [basicInfo, setBasicInfo] = useState({
    name: '',
    description: '',
    tags: [] as string[],
  });
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  const [displayMode, setDisplayMode] = useState<'standard' | 'maximized' | 'fullscreen'>('standard');
  const [initialPos, setInitialPos] = useState<{ x: number; y: number } | undefined>(undefined);
  const [initialSize, setInitialSize] = useState<{ width: number; height: number } | undefined>(undefined);
  const saveDraftInProgress = React.useRef(false);

  // Presentation (icon/label) from package.json (hierarchidb.plugin.icon)
  const IconNode = useMemo<React.ElementType | undefined>(() => getIconComponent(nodeType) as React.ElementType | undefined, [nodeType]);
  const presentation = useMemo(() => getPresentation(nodeType), [nodeType]);

  // Get plugin steps (DialogStep placeholders) and configs (typed)
  const [regTick, setRegTick] = useState(0);
  const [hostTick, setHostTick] = useState(0);

  // Subscribe to registry/host changes so steps recompose once plugins register
  useEffect(() => {
    const unsubA = registry.subscribe?.(() => setRegTick((v) => v + 1));
    const unsubB = hostRegistry?.subscribe?.(() => setHostTick((v) => v + 1));
    return () => { unsubA && unsubA(); unsubB && unsubB(); };
  }, [registry, hostRegistry]);

  const pluginSteps = useMemo(() => {
    void regTick; // recompose when registry updates
    if (mode === 'create') return registry.getCreateSteps(nodeType);
    if (mode === 'edit' && nodeId) return registry.getEditSteps(nodeType, nodeId as string, workingCopy?.data);
    return [];
  }, [mode, nodeType, nodeId, workingCopy, registry, regTick]);

  const composed = useMemo(() => {
    void regTick; void hostTick; // recompose when registries/hosts update
    return composeStepConfigs(nodeType, mode);
  }, [nodeType, mode, regTick, hostTick]);
  const pluginStepConfigs = composed.configs;

  // Adapter: render config-based steps with typed props and without any casts
  const StepAdapter: React.FC<{ cfg: PluginStepConfig } & { mode: 'create' | 'edit'; nodeId?: string; parentId?: string; data: unknown; onDataChange: (d: unknown) => void }>
    = ({ cfg, mode, nodeId, parentId, data, onDataChange }) => {
      const [, setValid] = useState<boolean | undefined>(undefined);
      const [, setError] = useState<string | null>(null);
      // Host validation is still handled centrally; Step can influence via setValid
      useEffect(() => {
        if (typeof cfg.validate === 'function') {
          Promise.resolve(cfg.validate()).then((ok) => setValid(!!ok)).catch(() => setValid(false));
        }
      }, [data, cfg]);

      // Normalize: treat componentFactory as a React component by wrapping it.
      // This guarantees any hooks inside plugin factory execute within a component render.
      const FactoryComponent = useMemo(() => {
        const Comp: React.FC = () => (
          <>
            {cfg.componentFactory({
              mode,
              nodeId,
              parentId,
              data: data as unknown as any,
              onChange: onDataChange as (d: any) => void,
              setValid: (v: boolean) => setValid(!!v),
              setError,
            })}
          </>
        );
        Comp.displayName = `StepFactory(${cfg.id})`;
        return Comp;
      }, [cfg, mode, nodeId, parentId, data, onDataChange]);

      return <FactoryComponent />;
    };

  // Build complete steps array
  const steps: DialogStep[] = useMemo(() => {
    // Generic basic step (only when host does not provide its own)
    const basicStep: DialogStep = {
      id: 'basic-info',
      label: 'Basic Information',
      component: (
        <BasicInfoStep
          name={basicInfo.name}
          description={basicInfo.description}
          tags={basicInfo.tags}
          tagSuggestions={tagSuggestions}
          onChange={(d) => setBasicInfo({
            name: d.name,
            description: d.description,
            tags: d.tags ?? [],
          })}
          mode={mode}
        />
      ),
      validate: () => {
        return basicInfo.name.trim().length > 0;
      },
    };

    // Build plugin steps either from typed configs or legacy DialogStep providers
    let tail: DialogStep[] = [];
    if (pluginStepConfigs && pluginStepConfigs.length) {
      // Render via StepAdapter to avoid any casts
      tail = pluginStepConfigs.map((cfg) => ({
        id: cfg.id,
        label: cfg.label,
        validate: () => {
          try { return cfg.validate ? cfg.validate(workingCopy?.data) : true; } catch { return false; }
        },
        component: (
          <StepAdapter
            key={`cfg-${cfg.id}`}
            cfg={cfg}
            mode={mode}
            nodeId={mode === 'edit' ? String(nodeId) : undefined}
            parentId={mode === 'create' ? String(pageNodeId) : undefined}
            data={workingCopy?.data}
            onDataChange={(d) => { updateWorkingCopy({ data: d }); }}
          />
        ),
      }));
    } else {
      tail = pluginSteps;
    }
    const core = composed.hasHostBase ? tail : [basicStep, ...tail];
    return core;
  }, [basicInfo, mode, pluginSteps, pluginStepConfigs, nodeId, pageNodeId, workingCopy?.data, updateWorkingCopy, composed.hasHostBase, tagSuggestions]);

  // Load data for edit mode (from workingCopy if available)
  useEffect(() => {
    if (mode === 'edit' && workingCopy) {
      const tags = (() => {
        const d = workingCopy.data as unknown;
        const arr = (d && typeof d === 'object' && Array.isArray((d as any).tags)) ? (d as any).tags as unknown[] : [];
        return arr.filter((x): x is string => typeof x === 'string');
      })();
      setBasicInfo({ name: workingCopy.name || '', description: workingCopy.description || '', tags });
    }
  }, [mode, workingCopy]);

  // Prefill from Worker QueryAPI for both create/edit when nodeId is available
  useEffect(() => {
    let disposed = false;
    (async () => {
      try {
        if (!client || !nodeId) return;
        const query = await client.getQueryAPI();
        const node = await query.getNode(nodeId);
        if (!node) return;
        if (!disposed) {
          const nodeTags = (() => {
            const d = (node as any)?.data;
            const arr = (d && typeof d === 'object' && Array.isArray(d.tags)) ? d.tags as unknown[] : [];
            return arr.filter((x): x is string => typeof x === 'string');
          })();
          setBasicInfo((prev) => ({
            name: prev.name || node.name || '',
            description: prev.description || (node as any).description || '',
            tags: nodeTags.length ? nodeTags : (prev.tags || []),
          }));
        }
      } catch (err) {
        console.warn('[PluginDialog] Failed to prefill from QueryAPI', err);
      }
    })();
    return () => { disposed = true; };
  }, [client, nodeId]);

  // Load tag suggestions and node tags via TagAPI
  useEffect(() => {
    let disposed = false;
    (async () => {
      try {
        if (!client) return;
        const tagAPI = await client.getTagAPI();
        const all = await tagAPI.getAllTags();
        if (!disposed) setTagSuggestions(all.map((t: TagEntity) => t.name).filter(Boolean));
        if (mode === 'edit' && nodeId) {
          const nodeTags = await tagAPI.getTagsForNode(nodeId);
          const tagNames = (nodeTags || []).map((t: TagEntity) => t.name).filter(Boolean);
          if (!disposed && tagNames.length) setBasicInfo((prev) => ({ ...prev, tags: prev.tags?.length ? prev.tags : tagNames }));
        }
      } catch (err) {
        console.warn('[PluginDialog] Failed to load tags', err);
      }
    })();
    return () => { disposed = true; };
  }, [client, nodeId, mode]);

  // Load persisted display mode / position / size (UI-only Dexie)
  useEffect(() => {
    let disposed = false;
    (async () => {
      try {
        if (!nodeType || !nodeId) return;
        const dm = await getPeerDisplayMode(nodeType, String(nodeId));
        const pos = await getPeerDialogPosition(nodeType, String(nodeId));
        const size = await getPeerDialogSize(nodeType, String(nodeId));
        if (!disposed) {
          if (dm) setDisplayMode(dm);
          if (pos) setInitialPos(pos);
          if (size) setInitialSize(size);
        }
      } catch (err) {
        console.warn('[PluginDialog] Failed to load persisted dialog UI state', err);
      }
    })();
    return () => { disposed = true; };
  }, [nodeType, nodeId]);

  // Debounced savers for move/resize to reduce writes during interaction
  const saveTimer = React.useRef<number | null>(null);
  const debounced = (fn: () => void, delay = 200) => {
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    saveTimer.current = window.setTimeout(() => { saveTimer.current = null; fn(); }, delay);
  };

  // Get dialog title
  const dialogTitle = useMemo(() => {
    const label = presentation?.label || nodeType;
    const modeLabel = mode === 'create' ? 'Create' : 'Edit';
    const current = activeStep + 1;
    const total = steps.length;
    const s = steps[activeStep];
    const stepTitle = s && s.label ? ` ${s.label}` : '';
    // Format: e.g., "Create Folder [1/3] Basic Information"
    return `${modeLabel} ${label} [${current}/${total}]${stepTitle}`;
  }, [mode, presentation?.label, nodeType, activeStep, steps.length]);

  // Debounced evaluator for step navigability / filled status
  const [evaluatedState, setEvaluatedState] = useState<{ navigable?: boolean[]; filled?: boolean[] }>({});
  useEffect(() => {
    let disposed = false;
    const handle = window.setTimeout(async () => {
      const filled: boolean[] = [];
      for (let i = 0; i < steps.length; i++) {
        const v = steps[i]?.validate;
        if (typeof v === 'function') {
          try { filled[i] = !!(await Promise.resolve(v())); } catch { filled[i] = false; }
        } else {
          filled[i] = true;
        }
      }
      const navigable: boolean[] = [];
      for (let i = 0; i < steps.length; i++) {
        if (i === 0) { navigable[i] = true; continue; }
        // allow navigate if all required previous steps are filled
        const prevOk = steps.slice(0, i).every((s, idx) => s?.optional ? true : !!filled[idx]);
        navigable[i] = prevOk;
      }
      if (!disposed) setEvaluatedState({ navigable, filled });
    }, 200);
    return () => { disposed = true; window.clearTimeout(handle); };
  }, [steps, basicInfo, workingCopy]);

  const evaluateSteps = useMemo(() => ({
    getNavigableSteps: () => evaluatedState.navigable || [],
    getFilledSteps: () => evaluatedState.filled || [],
  }), [evaluatedState, steps]);

  const evaluateSubmit = useCallback(async () => {
    const filled = evaluatedState.filled || [];
    const baseOk = steps.every((s, i) => (s?.optional ?? false) ? true : !!filled[i]);
    if (!baseOk) return false;
    if (composed?.hostCanSubmit) {
      try { return !!(await composed.hostCanSubmit(workingCopy?.data)); } catch { return false; }
    }
    return true;
  }, [evaluatedState.filled, steps, composed, workingCopy?.data]);

  // Handle submit
  const handleSubmit = useCallback(async () => {
    try {
      // Combine basic info with working copy data
      const finalData = {
        ...workingCopy,
        name: basicInfo.name,
        description: basicInfo.description,
        data: { ...(workingCopy?.data as Record<string, unknown> || {}), tags: basicInfo.tags },
      };

      // Save the working copy
      const savedNodeId = await saveWorkingCopy(finalData);

      // After successfully persisting to original (commit), ensure working copy is discarded
      try {
        await discardWorkingCopy();
      } catch (e) {
        // Non-fatal; worker-side commit normally discards WC already
        console.warn('[PluginDialog] discardWorkingCopy after submit failed (ignored)', e);
      }

      // Navigate to the new/updated node
      if (savedNodeId) {
        onSuccess?.(savedNodeId);

        // Update URL to reflect the saved node
        if (mode === 'create') {
          navigate(`/t/${treeId}/${pageNodeId}/${savedNodeId}`);
        }
      }

      onClose();
    } catch (error) {
      console.error('Failed to save:', error);
      throw error;
    }
  }, [workingCopy, basicInfo, saveWorkingCopy, onSuccess, onClose, mode, navigate, treeId, pageNodeId]);

  // Handle save draft
  const handleSaveDraft = useCallback(async () => {
    try {
      saveDraftInProgress.current = true;
      const draftData = {
        ...workingCopy,
        name: basicInfo.name,
        description: basicInfo.description,
        isDraft: true,
      };
      await saveDraft(draftData);
      // Do not close here; MultiStepDialog will invoke onClose after onSaveDraft resolves
    } catch (error) {
      console.error('Failed to save draft:', error);
      throw error;
    }
  }, [workingCopy, basicInfo, saveDraft]);

  // Handle cancel
  const handleCancel = useCallback(async () => {
    try {
      // Always discard on cancel (both create and edit). Draft is handled by onSaveDraft.
      await discardWorkingCopy();
    } catch (e) {
      console.warn('[PluginDialog] discardWorkingCopy on cancel failed (ignored)', e);
    }
    onClose();
  }, [discardWorkingCopy, onClose]);

  // Handle step change
  const handleStepChange = useCallback((step: number) => {
    setActiveStep(step);

    // Update URL to reflect current step
    const stepId = steps[step]?.id;
    if (stepId) {
      const basePath = mode === 'create'
        ? `/t/${treeId}/${pageNodeId}/new/${nodeType}`
        : `/t/${treeId}/${pageNodeId}/${nodeId}/${nodeType}`;
      navigate(`${basePath}/${stepId}`, { replace: true });
    }
  }, [steps, mode, treeId, pageNodeId, nodeId, nodeType, navigate]);

  // Error handling
  if (error) {
    return (
      <div>
        Error loading dialog: {error.message}
      </div>
    );
  }

  return (
    <MultiStepDialog
      open={open}
      mode={mode}
      title={dialogTitle}
      steps={steps}
      evaluateSteps={evaluateSteps}
      evaluateSubmit={evaluateSubmit}
      activeStep={activeStep}
      onStepChange={handleStepChange}
      nonLinear={true}
      hasUnsavedChanges={hasUnsavedChanges}
      supportsDraft={true}
      loading={loading}
      onSubmit={handleSubmit}
      onSaveDraft={handleSaveDraft}
      onCancel={handleCancel}
      onClose={() => {
        // Ensure working copy cleanup when the dialog is closed via the header X,
        // backdrop click, or ESC (MultiStepDialog prefers onClose over onCancel).
        if (saveDraftInProgress.current) {
          // Save-as-draft completes and closes the dialog without discarding WC.
          saveDraftInProgress.current = false;
          onClose();
          return;
        }
        void discardWorkingCopy()
          .catch((e) => console.warn('[PluginDialog] Failed to discard working copy on close', e))
          .finally(() => onClose());
      }}
      icon={IconNode as unknown as React.ReactNode}
      displayMode={displayMode}
      onDisplayModeChange={(m: 'standard' | 'maximized' | 'fullscreen') => {
        setDisplayMode(m);
        // Persist mode immediately
        void setPeerDisplayMode(nodeType, String(nodeId), m);
      }}
      initialPosition={initialPos}
      initialSize={initialSize}
      onDialogMove={(pos: { x: number; y: number }) => {
        if (displayMode !== 'standard') return;
        debounced(() => { void setPeerDialogPosition(nodeType, String(nodeId), pos); });
      }}
      onDialogResize={(size: { width: number; height: number }) => {
        if (displayMode !== 'standard') return;
        debounced(() => { void setPeerDialogSize(nodeType, String(nodeId), size); });
      }}
    />
  );
};
