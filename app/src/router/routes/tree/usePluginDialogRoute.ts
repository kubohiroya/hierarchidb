import { NodeAction, type NodeId, type TreeId } from '@hierarchidb/common-types';
import { loadTreeConsoleSettings, TREE_CONSOLE_SETTINGS_STORAGE_KEY } from '@hierarchidb/util';
import { useLocation, useNavigate } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { shiftBuildQueue } from '../../pages/tree/console/buildQueue.ts';
import type { PluginDialogLoaderData } from './PluginDialogRoute.tsx';

export function usePluginDialogRoute(data: PluginDialogLoaderData) {
  const { tree, pageNodeId, targetNodeId, nodeType, action, params } = data;

  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = useMemo(
    () => new URLSearchParams(location.searchStr ?? ''),
    [location.searchStr]
  );
  const autoBuildEnabled = searchParams.get('build') === '1';
  const buildQueueKey = searchParams.get('buildQueue') ?? undefined;
  const returnToParam = searchParams.get('returnTo') ?? undefined;
  const [isOpen, setIsOpen] = useState(true);
  const [backdropDismissEnabled, setBackdropDismissEnabled] = useState<boolean>(() => {
    const stored = loadTreeConsoleSettings().dialogBackdropDismissEnabled;
    return typeof stored === 'boolean' ? stored : false;
  });

  useEffect(() => {
    const global = typeof window !== 'undefined' ? window : null;
    if (!global) return undefined;
    const handleStorage = (event: StorageEvent) => {
      if (event.key && event.key !== TREE_CONSOLE_SETTINGS_STORAGE_KEY) return;
      const stored = loadTreeConsoleSettings().dialogBackdropDismissEnabled;
      setBackdropDismissEnabled(typeof stored === 'boolean' ? stored : false);
    };
    global.addEventListener('storage', handleStorage);
    return () => {
      global.removeEventListener('storage', handleStorage);
    };
  }, []);

  const treeId: TreeId | undefined = tree?.id ?? (params.treeId as TreeId | undefined);
  const effectiveTargetNodeId: NodeId | undefined =
    targetNodeId ?? (params.targetNodeId as NodeId | undefined);
  const effectivePageNodeId: NodeId | undefined =
    pageNodeId ??
    (params.pageNodeId as NodeId | undefined) ??
    (treeId ? (`${treeId}:root` as NodeId) : undefined);
  const effectiveNodeType: string | undefined = nodeType ?? params.nodeType;
  const effectiveAction: NodeAction | undefined = action ?? toNodeAction(params.action);

  const isReady = Boolean(
    treeId && effectiveTargetNodeId && effectivePageNodeId && effectiveNodeType && effectiveAction
  );

  const stepParam = useMemo(() => {
    if (params.step) return params.step;
    const hash = location.hash ?? '';
    const usesHashRouting = hash.startsWith('#/');
    const pathWithQuery = usesHashRouting ? hash.slice(1) : (location.pathname ?? '');
    const pathOnly = pathWithQuery.split('?')[0] ?? '';
    const normalizedPath = pathOnly.startsWith('/') ? pathOnly : `/${pathOnly}`;
    const segments = normalizedPath.split('/').filter(Boolean);
    const tIndex = segments.indexOf('t');
    if (tIndex < 0) return null;
    const stepSegment = segments[tIndex + 7];
    if (!stepSegment) return null;
    const parsed = parseInt(stepSegment, 10);
    return Number.isFinite(parsed) && parsed >= 1 ? String(parsed) : null;
  }, [location.hash, location.pathname, params.step]);

  const initialStepRef = useRef<number | null>(null);
  const forceInitialStepRef = useRef<boolean | null>(null);

  useEffect(() => {
    initialStepRef.current = null;
    forceInitialStepRef.current = null;
  }, []);

  const parsedStep = useMemo(() => {
    if (stepParam !== null && stepParam !== undefined) {
      const n = parseInt(stepParam, 10);
      return Number.isFinite(n) && n >= 1 ? n : 1;
    }
    return 1;
  }, [stepParam]);

  const resolvedTreeId = treeId as TreeId;
  const resolvedTargetNodeId = effectiveTargetNodeId as NodeId;
  const resolvedPageNodeId = effectivePageNodeId as NodeId;
  const resolvedNodeType = effectiveNodeType as string;

  useEffect(() => {
    if (!autoBuildEnabled || !effectiveTargetNodeId) return;
    if (effectiveNodeType !== 'shape') return;
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem('autoResumeBuild', String(effectiveTargetNodeId));
    } catch (error) {
      console.warn('[PluginDialogRoute] failed to persist autoResumeBuild', error);
    }
  }, [autoBuildEnabled, effectiveNodeType, effectiveTargetNodeId]);

  const handleAutoBuildComplete = useCallback(() => {
    if (!autoBuildEnabled) return;
    if (buildQueueKey) {
      const next = shiftBuildQueue(buildQueueKey);
      if (next?.nextUrl) {
        void navigate({ to: next.nextUrl });
        return;
      }
      const fallback = next?.returnTo ?? returnToParam;
      if (fallback) {
        void navigate({ to: fallback });
        return;
      }
    }
    if (returnToParam) {
      void navigate({ to: returnToParam });
      return;
    }
    void navigate({ to: `/t/${resolvedTreeId}/${resolvedPageNodeId}` });
  }, [
    autoBuildEnabled,
    buildQueueKey,
    navigate,
    resolvedPageNodeId,
    resolvedTreeId,
    returnToParam,
  ]);

  if (initialStepRef.current === null) {
    initialStepRef.current = parsedStep;
  }
  if (forceInitialStepRef.current === null) {
    forceInitialStepRef.current = stepParam !== null && parsedStep > 1;
  }
  const currentStep = initialStepRef.current ?? parsedStep;
  const requestedAction = params.action?.toLowerCase() ?? '';
  const forceInitialStep = (forceInitialStepRef.current ?? false) || requestedAction === 'preview';

  const mode: 'create' | 'edit' | 'preview' =
    requestedAction === 'preview'
      ? 'preview'
      : requestedAction === 'edit' || effectiveAction === NodeAction.UPDATE
        ? 'edit'
        : 'create';

  const handleClose = useCallback(() => {
    setIsOpen(false);
    const destination = resolvedPageNodeId
      ? `/t/${resolvedTreeId}/${resolvedPageNodeId}`
      : `/t/${resolvedTreeId}`;
    void navigate({ to: destination });
  }, [navigate, resolvedPageNodeId, resolvedTreeId]);

  const handleSuccess = useCallback(
    (savedNodeId: NodeId) => {
      void navigate({ to: `/t/${resolvedTreeId}/${resolvedPageNodeId}/${savedNodeId}` });
    },
    [navigate, resolvedPageNodeId, resolvedTreeId]
  );

  const autoBuild = autoBuildEnabled
    ? { enabled: true, onComplete: handleAutoBuildComplete }
    : undefined;

  return {
    autoBuild,
    backdropDismissEnabled,
    currentStep,
    effectiveAction,
    effectiveNodeType,
    effectivePageNodeId,
    effectiveTargetNodeId,
    forceInitialStep,
    handleClose,
    handleSuccess,
    isOpen,
    isReady,
    mode,
    resolvedNodeType,
    resolvedPageNodeId,
    resolvedTargetNodeId,
    resolvedTreeId,
  };
}

function toNodeAction(value: string | undefined): NodeAction | undefined {
  switch (value) {
    case NodeAction.CREATE:
    case NodeAction.UPDATE:
    case NodeAction.DELETE:
    case NodeAction.MOVE:
    case NodeAction.DUPLICATE:
    case NodeAction.IMPORT:
    case NodeAction.EXPORT:
    case NodeAction.RESTORE:
    case NodeAction.DISCARD:
      return value;
    case 'edit':
    case 'preview':
      return NodeAction.UPDATE;
    default:
      return undefined;
  }
}
