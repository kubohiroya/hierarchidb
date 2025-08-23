import {
  type Tree,
  type TreeNode,
  type TreeNodeType,
  type TreeNodeAction,
  type NodeId,
  type TreeId,
} from "@hierarchidb/00-core";
import { WorkerAPIClient } from "@hierarchidb/10-ui-client";
import { useRouteLoaderData } from "react-router";

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

export type LoadPageTreeNodeArgs = {
  treeId: string;
  pageNodeId: string;
};
export type LoadPageTreeNodeReturn = {
  client: WorkerAPIClient;
  pageTreeNode: TreeNode | undefined;
} & LoadTreeReturn;

export type LoadTargetTreeNodeArgs = {
  treeId: string;
  pageNodeId: string;
  targetNodeId: string;
};
export type LoadTargetTreeNodeReturn = {
  targetTreeNode: TreeNode | undefined;
} & LoadPageTreeNodeReturn;

export type LoadTreeNodeTypeArgs = {
  treeId: string;
  pageNodeId: string;
  targetNodeId: string;
  nodeType: string;
};
export type LoadTreeNodeTypeReturn = {
  nodeType: TreeNodeType | undefined;
} & LoadTargetTreeNodeReturn;

export type LoadTreeNodeActionArgs = {
  treeId: string;
  pageNodeId: string;
  targetNodeId: string;
  nodeType: string;
  action: string;
};
export type LoadTreeNodeActionReturn = {
  action: TreeNodeAction | undefined;
} & LoadTreeNodeTypeReturn;

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
    appPrefix: VITE_APP_PREFIX || "",
    appName: VITE_APP_NAME || "HierarchiDB",
    appTitle: VITE_APP_TITLE || "HierarchiDB",
    appDescription:
      VITE_APP_DESCRIPTION ||
      "High-performance tree-structured data management framework for browser environments",
    appDetails:
      VITE_APP_DETAILS ||
      "A powerful framework for managing hierarchical data in browser environments",
    appHomepage: APP_HOMEPAGE || "https://github.com/kubohiroya/hierarchidb",
    appLogo: VITE_APP_LOGO || "logo.png",
    appFavicon: VITE_APP_FAVICON || "logo.favicon.png",
    appTheme: VITE_APP_THEME || "light",
    appLocale: VITE_APP_LOCALE || "en-US",
    appAttribution: VITE_APP_ATTRIBUTION || "",
    appDefaultLocale: "en-US",
    appDefaultLanguage: "en",
  };
}

export async function loadWorkerAPIClient(): Promise<LoadWorkerAPIClientReturn> {
  const appConfig = loadAppConfig();
  return {
    ...appConfig,
    client: await WorkerAPIClient.getSingleton(),
  };
}

export async function loadTree({
  treeId,
}: LoadTreeArgs): Promise<LoadTreeReturn> {
  const workerAPIClientReturn = await loadWorkerAPIClient();
  if (!treeId) {
    throw new Error("treeId is required");
  }
  return {
    client: workerAPIClientReturn.client,
    tree: await workerAPIClientReturn.client.getAPI().getTree({
      treeId: treeId as TreeId,
    }),
  };
}

export async function loadPageTreeNode({
  treeId,
  pageNodeId,
}: LoadPageTreeNodeArgs): Promise<LoadPageTreeNodeReturn> {
  const loadTreeReturn = await loadTree({ treeId });
  return {
    ...loadTreeReturn,
    pageTreeNode: await loadTreeReturn.client.getAPI().getNode(
      (pageNodeId || `${treeId}Root`) as NodeId
    ),
  };
}

export async function loadTargetTreeNode({
  treeId,
  pageNodeId,
  targetNodeId,
}: LoadTargetTreeNodeArgs): Promise<LoadTargetTreeNodeReturn> {
  const loadPageTreeNodeReturn = await loadPageTreeNode({
    treeId,
    pageNodeId,
  });
  return {
    ...loadPageTreeNodeReturn,
    targetTreeNode: await loadPageTreeNodeReturn.client.getAPI().getNode(
      (targetNodeId || pageNodeId || `${treeId}Root`) as NodeId
    ),
  };
}

export async function loadTreeNodeType({
  treeId,
  pageNodeId,
  targetNodeId,
  nodeType,
}: LoadTreeNodeTypeArgs): Promise<LoadTreeNodeTypeReturn> {
  const loadTargetTreeNodeReturn = await loadTargetTreeNode({
    treeId,
    pageNodeId,
    targetNodeId,
  });
  return {
    ...loadTargetTreeNodeReturn,
    nodeType: nodeType as TreeNodeType | undefined,
  };
}

export async function loadTreeNodeAction({
  treeId,
  pageNodeId,
  targetNodeId,
  nodeType,
  action,
}: LoadTreeNodeActionArgs): Promise<LoadTreeNodeActionReturn> {
  const loadTreeNodeTypeReturn = await loadTreeNodeType({
    treeId,
    pageNodeId,
    targetNodeId,
    nodeType,
  });
  return {
    ...loadTreeNodeTypeReturn,
    action: action as TreeNodeAction | undefined,
  };
}

export function useAppConfig(): LoadAppConfigReturn {
  return loadAppConfig();
}

export function useWorkerAPIClient() {
  return useRouteLoaderData("t") as WorkerAPIClient;
}

export function useTree(): Tree | undefined {
  return useRouteLoaderData("t/($treeId)");
}

export function usePageTreeNode(): TreeNode | undefined {
  return useRouteLoaderData("t/($treeId)/($pageNodeId)");
}

export function useTargetTreeNode(): TreeNode | undefined {
  return useRouteLoaderData(
    "t/($treeId)/($pageNodeId)/($targetNodeId)",
  );
}

export function useTreeNodeType(): TreeNodeType | undefined {
  return useRouteLoaderData(
    "t/($treeId)/($pageNodeId)/($targetNodeId)/($nodeType)",
  );
}

export function useTreeNodeTAction(): TreeNodeAction | undefined {
  return useRouteLoaderData(
    "t/($treeId)/($pageNodeId)/($targetNodeId)/($nodeType)/($action)",
  );
}
