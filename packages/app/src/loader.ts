import { Tree, TreeNode, TreeNodeType, TreeNodeAction, TreeNodeTypes } from '@hierarchidb/core';
import { WorkerAPIClient } from '@hierarchidb/ui-client';
import { useRouteLoaderData } from 'react-router';

export type LoadAppConfigReturn = {
  appPrefix: string;
  appName: string;
  appTitle: string;
  appDescription: string;
  appHomepage: string;
  appLogo: string;
  appFavicon: string;
  appTheme: string;
  appLocale: string;
  appDefaultLocale: string;
  appDefaultLanguage: string;
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

export type LoadPageTreeNodeArgs = {
  treeId: string;
  pageTreeNodeId: string;
};
export type LoadPageTreeNodeReturn = {
  client: WorkerAPIClient;
  pageTreeNode: TreeNode | undefined;
} & LoadTreeReturn;

export type LoadTargetTreeNodeArgs = {
  treeId: string;
  pageTreeNodeId: string;
  targetTreeNodeId: string;
};
export type LoadTargetTreeNodeReturn = {
  targetTreeNode: TreeNode | undefined;
} & LoadPageTreeNodeReturn;

export type LoadTreeNodeTypeArgs = {
  treeId: string;
  pageTreeNodeId: string;
  targetTreeNodeId: string;
  treeNodeType: string;
};
export type LoadTreeNodeTypeReturn = {
  treeNodeType: TreeNodeType | undefined;
} & LoadTargetTreeNodeReturn;

export type LoadTreeNodeActionArgs = {
  treeId: string;
  pageTreeNodeId: string;
  targetTreeNodeId: string;
  treeNodeType: string;
  action: string;
};
export type LoadTreeNodeActionReturn = {
  action: TreeNodeAction | undefined;
} & LoadTreeNodeTypeReturn;

export async function loadAppConfig(): Promise<LoadAppConfigReturn> {
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
  } = import.meta.env;

  return {
    appPrefix: VITE_APP_PREFIX || '',
    appName: VITE_APP_NAME || 'HierarchiDB',
    appTitle: VITE_APP_TITLE || 'HierarchiDB',
    appDescription:
      VITE_APP_DESCRIPTION ||
      'High-performance tree-structured data management framework for browser environments',
    appHomepage: APP_HOMEPAGE || 'https://github.com/kubohiroya/hierarchidb',
    appLogo: VITE_APP_LOGO || 'logo.png',
    appFavicon: VITE_APP_FAVICON || 'logo.favicon.png',
    appTheme: VITE_APP_THEME || 'light',
    appLocale: VITE_APP_LOCALE || 'en-US',
    appDefaultLocale: 'en-US',
    appDefaultLanguage: 'en',
  };
}

export async function loadWorkerAPIClient(): Promise<LoadWorkerAPIClientReturn> {
  const appConfig = await loadAppConfig();
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
      treeId,
    }),
  };
}

export async function loadPageTreeNode({
  treeId,
  pageTreeNodeId,
}: LoadPageTreeNodeArgs): Promise<LoadPageTreeNodeReturn> {
  const loadTreeReturn = await loadTree({ treeId });
  return {
    ...loadTreeReturn,
    pageTreeNode: await loadTreeReturn.client.getAPI().getNode({
      treeNodeId: pageTreeNodeId || treeId + TreeNodeTypes.Root,
    }),
  };
}

export async function loadTargetTreeNode({
  treeId,
  pageTreeNodeId,
  targetTreeNodeId,
}: LoadTargetTreeNodeArgs): Promise<LoadTargetTreeNodeReturn> {
  const loadPageTreeNodeReturn = await loadPageTreeNode({ treeId, pageTreeNodeId });
  return {
    ...loadPageTreeNodeReturn,
    targetTreeNode: await loadPageTreeNodeReturn.client.getAPI().getNode({
      treeNodeId: targetTreeNodeId || pageTreeNodeId || treeId + TreeNodeTypes.Root,
    }),
  };
}

export async function loadTreeNodeType({
  treeId,
  pageTreeNodeId,
  targetTreeNodeId,
  treeNodeType,
}: LoadTreeNodeTypeArgs): Promise<LoadTreeNodeTypeReturn> {
  const loadTargetTreeNodeReturn = await loadTargetTreeNode({
    treeId,
    pageTreeNodeId,
    targetTreeNodeId,
  });
  return {
    ...loadTargetTreeNodeReturn,
    treeNodeType: treeNodeType as TreeNodeType | undefined,
  };
}

export async function loadTreeNodeAction({
  treeId,
  pageTreeNodeId,
  targetTreeNodeId,
  treeNodeType,
  action,
}: LoadTreeNodeActionArgs): Promise<LoadTreeNodeActionReturn> {
  const loadTreeNodeTypeReturn = await loadTreeNodeType({
    treeId,
    pageTreeNodeId,
    targetTreeNodeId,
    treeNodeType,
  });
  return {
    ...loadTreeNodeTypeReturn,
    action: action as TreeNodeAction | undefined,
  };
}

export function useAppConfig() {
  return useRouteLoaderData('/info') as LoadAppConfigReturn;
}

export function useWorkerAPIClient() {
  return useRouteLoaderData('t') as WorkerAPIClient;
}

export function useTree(): Tree | undefined {
  return useRouteLoaderData('t/($treeId)');
}

export function usePageTreeNode(): TreeNode | undefined {
  return useRouteLoaderData('t/($treeId)/($pageTreeNodeId)');
}

export function useTargetTreeNode(): TreeNode | undefined {
  return useRouteLoaderData('t/($treeId)/($pageTreeNodeId)/($targetTreeNodeId)');
}

export function useTreeNodeType(): TreeNodeType | undefined {
  return useRouteLoaderData('t/($treeId)/($pageTreeNodeId)/($targetTreeNodeId)/($treeNodeType)');
}

export function useTreeNodeTAction(): TreeNodeAction | undefined {
  return useRouteLoaderData(
    't/($treeId)/($pageTreeNodeId)/($targetTreeNodeId)/($treeNodeType)/($action)'
  );
}
