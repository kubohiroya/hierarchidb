import {
  type Tree,
  type TreeNode,
  type NodeType,
  type NodeAction,
  type NodeId,
  type TreeId,
} from '@hierarchidb/common-core';
import { WorkerAPIClient } from '@hierarchidb/ui-client';
import { useRouteLoaderData } from 'react-router';

export type LoadAppConfigReturn = {
  appPrefix: string;
  appName: string;
  appTitle: string;
  appDescription: string;
  appDetails: string;
  appHomepage: string;
  appLogo: string;
  appFavicon: string;
  appTheme: string;
  appLocale: string;
  appDefaultLocale: string;
  appDefaultLanguage: string;
  appAttribution: string;
};

export type LoadWorkerAPIClientReturn = {
  client: WorkerAPIClient;
};

export type LoadTreeArgs = {
  treeId: string;
};
export type LoadTreeReturn = {
  tree: Tree | undefined;
} & LoadWorkerAPIClientReturn;

export type LoadPageNodeArgs = {
  treeId: string;
  nodeId: string;
};
export type LoadPageNodeReturn = {
  client: WorkerAPIClient;
  pageNodeId: NodeId;
  pageNode: TreeNode | undefined;
} & LoadTreeReturn;

export type LoadTargetNodeArgs = {
  treeId: string;
  pageNodeId: string;
  targetNodeId: string;
};
export type LoadTargetNodeReturn = {
  targetNode: TreeNode | undefined;
} & LoadPageNodeReturn;

export type LoadNodeTypeArgs = {
  treeId: string;
  pageNodeId: string;
  targetNodeId: string;
  nodeType: string;
};
export type LoadNodeTypeReturn = {
  nodeType: NodeType | undefined;
} & LoadTargetNodeReturn;

export type LoadNodeActionArgs = {
  treeId: string;
  pageNodeId: string;
  targetNodeId: string;
  nodeType: string;
  action: string;
};
export type LoadNodeActionReturn = {
  action: NodeAction | undefined;
} & LoadNodeTypeReturn;

export function loadAppConfig(): LoadAppConfigReturn {
  const {
    VITE_APP_PREFIX,
    VITE_APP_NAME,
    VITE_APP_TITLE,
    VITE_APP_DESCRIPTION,
    APP_HOMEPAGE,
    VITE_APP_LOGO,
    VITE_APP_FAVICON,
    VITE_APP_THEME,
    VITE_APP_LOCALE,
    VITE_APP_ATTRIBUTION,
    VITE_APP_DETAILS,
  } = import.meta.env;

  return {
    appPrefix: VITE_APP_PREFIX || '',
    appName: VITE_APP_NAME || 'HierarchiDB',
    appTitle: VITE_APP_TITLE || 'HierarchiDB',
    appDescription:
      VITE_APP_DESCRIPTION ||
      'High-performance tree-structured data management framework for browser environments',
    appDetails:
      VITE_APP_DETAILS ||
      'A powerful framework for managing hierarchical data in browser environments',
    appHomepage: APP_HOMEPAGE || 'https://github.com/kubohiroya/hierarchidb',
    appLogo: VITE_APP_LOGO || 'logo.png',
    appFavicon: VITE_APP_FAVICON || 'logo.favicon.png',
    appTheme: VITE_APP_THEME || 'light',
    appLocale: VITE_APP_LOCALE || 'en-US',
    appAttribution: VITE_APP_ATTRIBUTION || '',
    appDefaultLocale: 'en-US',
    appDefaultLanguage: 'en',
  };
}

export async function loadWorkerAPIClient(): Promise<LoadWorkerAPIClientReturn> {
  const appConfig = loadAppConfig();
  return {
    ...appConfig,
    client: await WorkerAPIClient.getSingleton(),
  };
}

export async function loadTree({ treeId }: LoadTreeArgs): Promise<LoadTreeReturn> {
  const workerAPIClientReturn = await loadWorkerAPIClient();
  if (!treeId) {
    throw new Error('treeId is required');
  }
  return {
    client: workerAPIClientReturn.client,
    tree: await workerAPIClientReturn.client.getAPI().getTree({
      treeId: treeId as TreeId,
    }),
  };
}

export async function loadPageNode({
  treeId,
  nodeId,
}: LoadPageNodeArgs): Promise<LoadPageNodeReturn> {
  const loadTreeReturn = await loadTree({ treeId });
  const resolvedPageNodeId = (nodeId || `${treeId}Root`) as NodeId;
  const pageNode = await loadTreeReturn.client.getAPI().getNode(resolvedPageNodeId);

  console.log({ treeId, pageNodeId: nodeId, pageNode });

  return {
    ...loadTreeReturn,
    pageNodeId: resolvedPageNodeId,
    pageNode,
  };
}

export async function loadTargetNode({
  treeId,
  pageNodeId,
  targetNodeId,
}: LoadTargetNodeArgs): Promise<LoadTargetNodeReturn> {
  const loadPageNodeReturn = await loadPageNode({
    treeId,
    nodeId: pageNodeId,
  });
  return {
    ...loadPageNodeReturn,
    targetNode: await loadPageNodeReturn.client
      .getAPI()
      .getNode((targetNodeId || pageNodeId || `${treeId}Root`) as NodeId),
  };
}

export async function loadNodeType({
  treeId,
  pageNodeId,
  targetNodeId,
  nodeType,
}: LoadNodeTypeArgs): Promise<LoadNodeTypeReturn> {
  const loadTargetNodeReturn = await loadTargetNode({
    treeId,
    pageNodeId,
    targetNodeId,
  });
  return {
    ...loadTargetNodeReturn,
    nodeType: nodeType as NodeType | undefined,
  };
}

export async function loadNodeAction({
  treeId,
  pageNodeId,
  targetNodeId,
  nodeType,
  action,
}: LoadNodeActionArgs): Promise<LoadNodeActionReturn> {
  const loadNodeTypeReturn = await loadNodeType({
    treeId,
    pageNodeId,
    targetNodeId,
    nodeType,
  });
  return {
    ...loadNodeTypeReturn,
    action: action as NodeAction | undefined,
  };
}

export function useAppConfig(): LoadAppConfigReturn {
  return loadAppConfig();
}

export function useWorkerAPIClient() {
  return useRouteLoaderData('t') as WorkerAPIClient;
}

export function useTree(): Tree | undefined {
  return useRouteLoaderData('t/($treeId)');
}

export function usePageNode(): TreeNode | undefined {
  return useRouteLoaderData('t/($treeId)/($pageNodeId)');
}

export function useTargetNode(): TreeNode | undefined {
  return useRouteLoaderData('t/($treeId)/($pageNodeId)/($targetNodeId)');
}

export function useNodeType(): NodeType | undefined {
  return useRouteLoaderData('t/($treeId)/($pageNodeId)/($targetNodeId)/($nodeType)');
}

export function useNodeTAction(): NodeAction | undefined {
  return useRouteLoaderData('t/($treeId)/($pageNodeId)/($targetNodeId)/($nodeType)/($action)');
}
