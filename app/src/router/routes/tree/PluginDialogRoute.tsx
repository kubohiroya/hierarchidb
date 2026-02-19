/**
 * Plugin Dialog Route Component
 * Integrates plugin console with React Router
 */

import { PluginDialogHost } from '@hierarchidb/ui-plugin-shell/plugin-ui-host';
import { useLoaderData } from '@tanstack/react-router';
import type { LoadNodeActionReturn } from '~/router/loaders/treeLoaders';
import { usePluginDialogRoute } from './usePluginDialogRoute.js';

type TreeDialogRouteParams = {
  treeId: string;
  pageNodeId?: string;
  targetNodeId: string;
  nodeType: string;
  action: string;
  mode?: string;
  step?: string;
};

export interface PluginDialogLoaderData extends LoadNodeActionReturn {
  params: TreeDialogRouteParams;
}

/**
 * Plugin Dialog Route Component
 * This component should be used in React Router route definitions
 */

export interface PluginDialogRouteProps {
  loaderData?: PluginDialogLoaderData;
}

const PluginDialogRouteBody: React.FC<{ data: PluginDialogLoaderData }> = ({ data }) => {
  const {
    autoBuild,
    backdropDismissEnabled,
    currentStep,
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
  } = usePluginDialogRoute(data);

  if (!isReady) {
    console.warn('[PluginDialogRoute] Missing required data to render plugin dialog', {
      treeId: resolvedTreeId,
      effectiveTargetNodeId: resolvedTargetNodeId,
      effectivePageNodeId: resolvedPageNodeId,
      effectiveNodeType: resolvedNodeType,
    });
    return null;
  }

  // Unified host: headless plugin dialog shell
  return (
    <PluginDialogHost
      mode={mode}
      nodeType={resolvedNodeType}
      nodeId={resolvedTargetNodeId}
      pageNodeId={resolvedPageNodeId}
      treeId={resolvedTreeId}
      open={isOpen}
      onClose={handleClose}
      onSuccess={handleSuccess}
      initialStep={currentStep}
      forceInitialStep={forceInitialStep}
      urlState={{ mode: urlDisplayMode, step: currentStep }}
      onUrlStateChange={handleUrlStateChange}
      backdropDismissEnabled={backdropDismissEnabled}
      autoBuild={autoBuild}
      removePaddingWithFullScreenMode={removePaddingWithFullScreenMode}
    />
  );
};

const PluginDialogRouteFromRouter: React.FC = () => {
  const candidate = useLoaderData({
    from: '/t/$treeId/$pageNodeId/$targetNodeId/$nodeType/$action',
  }) as
    | PluginDialogLoaderData
    | { kind: 'archive'; data: unknown }
    | { kind: 'plugin'; data: PluginDialogLoaderData };
  if (typeof candidate === 'object' && candidate !== null && 'kind' in candidate) {
    if (candidate.kind === 'plugin') {
      return <PluginDialogRouteBody data={candidate.data} />;
    }
    return null;
  }
  return <PluginDialogRouteBody data={candidate} />;
};

export const PluginDialogRoute: React.FC<PluginDialogRouteProps> = ({ loaderData }) => {
  if (loaderData) {
    return <PluginDialogRouteBody data={loaderData} />;
  }
  return <PluginDialogRouteFromRouter />;
};

/**
 * Create route configuration for plugin console
 * Uses the route pattern: /t/:treeId/:pageNodeId/:targetNodeId/:nodeType/:action/:mode?/:step?
 */
export function createPluginDialogRoutes() {
  return [
    // Standard route pattern with action
    {
      path: 't/:treeId/:pageNodeId/:targetNodeId/:nodeType/:action/:mode?/:step?',
      element: <PluginDialogRoute />,
    },
  ];
}
