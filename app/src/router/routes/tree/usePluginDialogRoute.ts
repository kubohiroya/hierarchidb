import { NodeAction } from '@hierarchidb/tree-api';
import type { NodeId, TreeId } from '@hierarchidb/core-types';
import { loadTreeConsoleSettings, TREE_CONSOLE_SETTINGS_STORAGE_KEY } from '@hierarchidb/util';
import { useLocation, useNavigate, useRouterState } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { shiftBuildQueue } from '~/router/pages/tree/console/buildQueue';
import { treeRouteIds } from './treeRouteIds.ts';
import type { PluginDialogLoaderData } from './PluginDialogRoute.tsx';

const resolveDialogDisplayMode = (value?: string): 'normal' | 'maximize' | 'full-screen' => {
  switch (String(value ?? '').toLowerCase()) {
    case 'full':
      return 'full-screen';
    case 'maximize':
      return 'maximize';
    default:
      return 'normal';
  }
};

const toUrlModeSegment = (value: 'normal' | 'maximize' | 'full-screen'): string => {
  switch (value) {
    case 'full-screen':
      return 'full';
    case 'maximize':
      return 'maximize';
    default:
      return 'normal';
  }
};


export function usePluginDialogRoute(data: PluginDialogLoaderData) {
  const { tree, pageNodeId, targetNodeId, nodeType, action, params } = data;

  const navigate = useNavigate();
  const location = useLocation();
  const matches = useRouterState({ select: (state) => state.matches });
  const dialogMatch = useMemo(
    () =>
      matches.find(
        (match) =>
          match.routeId === treeRouteIds.dialogModeStep
          || match.routeId === treeRouteIds.dialogMode
          || match.routeId === treeRouteIds.dialog
      ),
    [matches]
  );
  const routeParams = (dialogMatch?.params as PluginDialogLoaderData['params'] | undefined)
    ?? params;

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

  const stepParam = useMemo(() => routeParams?.step ?? null, [routeParams?.step]);

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

  const currentStep = parsedStep;
  const urlDisplayMode = resolveDialogDisplayMode(routeParams?.mode);
  const requestedAction = routeParams?.action?.toLowerCase() ?? '';
  const forceInitialStep = stepParam !== null || requestedAction === 'preview';
  const lastUrlStateRef = useRef<{ mode: 'normal' | 'maximize' | 'full-screen'; step: number }>({
    mode: urlDisplayMode,
    step: currentStep,
  });
  useEffect(() => {
    lastUrlStateRef.current = { mode: urlDisplayMode, step: currentStep };
  }, [currentStep, urlDisplayMode]);

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

  const removePaddingWithFullScreenMode = resolvedNodeType === 'shape' && currentStep === 6;

  const handleSuccess = useCallback(
    (savedNodeId: NodeId) => {
      void navigate({ to: `/t/${resolvedTreeId}/${resolvedPageNodeId}/${savedNodeId}` });
    },
    [navigate, resolvedPageNodeId, resolvedTreeId]
  );

  const autoBuild = autoBuildEnabled
    ? { enabled: true, onComplete: handleAutoBuildComplete }
    : undefined;

  const handleUrlStateChange = useCallback(
    (next: { mode: 'normal' | 'maximize' | 'full-screen'; step: number }) => {
      const current = lastUrlStateRef.current;
      if (current.mode === next.mode && current.step === next.step) {
        return;
      }
      lastUrlStateRef.current = { mode: next.mode, step: next.step };
      const actionParam = params.action ?? String(effectiveAction ?? 'edit');
      const modeSegment = toUrlModeSegment(next.mode);
      void navigate({
        to: '/t/$treeId/$pageNodeId/$targetNodeId/$nodeType/$action/$mode/$step',
        params: {
          treeId: String(resolvedTreeId),
          pageNodeId: String(resolvedPageNodeId),
          targetNodeId: String(resolvedTargetNodeId),
          nodeType: String(resolvedNodeType),
          action: String(actionParam),
          mode: modeSegment,
          step: String(next.step),
        },
        replace: true,
      });
    },
    [
      effectiveAction,
      navigate,
      params.action,
      resolvedNodeType,
      resolvedPageNodeId,
      resolvedTargetNodeId,
      resolvedTreeId,
    ]
  );

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
    handleUrlStateChange,
    isOpen,
    isReady,
    mode,
    removePaddingWithFullScreenMode,
    resolvedNodeType,
    resolvedPageNodeId,
    resolvedTargetNodeId,
    resolvedTreeId,
    urlDisplayMode,
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
