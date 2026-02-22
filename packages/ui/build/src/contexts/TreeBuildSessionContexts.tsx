import { type NodeId, type NodeType, type TreeId, toNodeType } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import { createContext, type ReactNode, useContext, useMemo } from 'react';
import {
  type BuildSessionSnapshot,
  useBuildSessionSnapshots,
} from '~/hooks/useBuildSessionSnapshots';

type TreeContextValue = {
  treeId: TreeId | null;
};

type PageNodeContextValue = {
  pageNodeId: NodeId | null;
  pageNode: TreeNode | null;
};

type TargetNodeContextValue = {
  targetNodeId: NodeId | null;
  targetNode: TreeNode | null;
  nodeType: string | null;
  metadata: TreeNode['metadata'] | null;
  draftData: TreeNode['draftData'] | null;
};

type BuildSessionRuntimeContextValue = {
  nodeType: NodeType;
  sessions: readonly BuildSessionSnapshot[];
  sessionByNodeId: ReadonlyMap<NodeId, BuildSessionSnapshot>;
  runningNodeIds: ReadonlySet<NodeId>;
  activeNodeIds: ReadonlySet<NodeId>;
};

type TargetNodeBuildSessionContextValue = {
  session: BuildSessionSnapshot | null;
  hasSession: boolean;
  isActive: boolean;
};

const DEFAULT_BUILD_SESSION_NODE_TYPE = toNodeType('shape');

const TreeContext = createContext<TreeContextValue | null>(null);
const PageNodeContext = createContext<PageNodeContextValue | null>(null);
const TargetNodeContext = createContext<TargetNodeContextValue | null>(null);
const BuildSessionRuntimeContext = createContext<BuildSessionRuntimeContextValue | null>(null);
const TargetNodeBuildSessionContext = createContext<TargetNodeBuildSessionContextValue | null>(
  null
);

type TreeContextProviderProps = {
  treeId?: TreeId | null;
  children: ReactNode;
};

export function TreeContextProvider({ treeId, children }: TreeContextProviderProps) {
  const value = useMemo<TreeContextValue>(
    () => ({
      treeId: treeId ?? null,
    }),
    [treeId]
  );
  return <TreeContext.Provider value={value}>{children}</TreeContext.Provider>;
}

type PageNodeContextProviderProps = {
  pageNodeId?: NodeId | null;
  pageNode?: TreeNode | null;
  children: ReactNode;
};

export function PageNodeContextProvider({
  pageNodeId,
  pageNode,
  children,
}: PageNodeContextProviderProps) {
  const value = useMemo<PageNodeContextValue>(
    () => ({
      pageNodeId: pageNodeId ?? null,
      pageNode: pageNode ?? null,
    }),
    [pageNode, pageNodeId]
  );
  return <PageNodeContext.Provider value={value}>{children}</PageNodeContext.Provider>;
}

type TargetNodeContextProviderProps = {
  targetNodeId?: NodeId | null;
  targetNode?: TreeNode | null;
  nodeType?: string | null;
  children: ReactNode;
};

export function TargetNodeContextProvider({
  targetNodeId,
  targetNode,
  nodeType,
  children,
}: TargetNodeContextProviderProps) {
  const value = useMemo<TargetNodeContextValue>(
    () => ({
      targetNodeId: targetNodeId ?? null,
      targetNode: targetNode ?? null,
      nodeType: nodeType ?? null,
      metadata: targetNode?.metadata ?? null,
      draftData: targetNode?.draftData ?? null,
    }),
    [nodeType, targetNode, targetNodeId]
  );
  return <TargetNodeContext.Provider value={value}>{children}</TargetNodeContext.Provider>;
}

type BuildSessionRuntimeContextProviderProps = {
  nodeType?: NodeType;
  children: ReactNode;
};

export function BuildSessionRuntimeContextProvider({
  nodeType = DEFAULT_BUILD_SESSION_NODE_TYPE,
  children,
}: BuildSessionRuntimeContextProviderProps) {
  const { sessions } = useBuildSessionSnapshots(nodeType);

  const value = useMemo<BuildSessionRuntimeContextValue>(() => {
    const sessionByNodeId = new Map<NodeId, BuildSessionSnapshot>();
    const runningNodeIds = new Set<NodeId>();
    const activeNodeIds = new Set<NodeId>();

    for (const session of sessions) {
      const nodeId = session.nodeId;
      sessionByNodeId.set(nodeId, session);
      runningNodeIds.add(nodeId);
      if (session.isActive) {
        activeNodeIds.add(nodeId);
      }
    }

    return {
      nodeType,
      sessions,
      sessionByNodeId,
      runningNodeIds,
      activeNodeIds,
    };
  }, [nodeType, sessions]);

  return (
    <BuildSessionRuntimeContext.Provider value={value}>
      {children}
    </BuildSessionRuntimeContext.Provider>
  );
}

type TargetNodeBuildSessionContextProviderProps = {
  children: ReactNode;
};

export function TargetNodeBuildSessionContextProvider({
  children,
}: TargetNodeBuildSessionContextProviderProps) {
  const targetContext = useOptionalTargetNodeContext();
  const runtimeContext = useOptionalBuildSessionRuntimeContext();

  const value = useMemo<TargetNodeBuildSessionContextValue>(() => {
    const targetNodeId = targetContext?.targetNodeId;
    const session = targetNodeId
      ? (runtimeContext?.sessionByNodeId.get(targetNodeId) ?? null)
      : null;
    return {
      session,
      hasSession: Boolean(session),
      isActive: Boolean(session?.isActive),
    };
  }, [runtimeContext?.sessionByNodeId, targetContext?.targetNodeId]);

  return (
    <TargetNodeBuildSessionContext.Provider value={value}>
      {children}
    </TargetNodeBuildSessionContext.Provider>
  );
}

export function useTreeContext(): TreeContextValue {
  const context = useContext(TreeContext);
  if (!context) {
    throw new Error('useTreeContext must be used within TreeContextProvider.');
  }
  return context;
}

export function useOptionalTreeContext(): TreeContextValue | null {
  return useContext(TreeContext);
}

export function usePageNodeContext(): PageNodeContextValue {
  const context = useContext(PageNodeContext);
  if (!context) {
    throw new Error('usePageNodeContext must be used within PageNodeContextProvider.');
  }
  return context;
}

export function useOptionalPageNodeContext(): PageNodeContextValue | null {
  return useContext(PageNodeContext);
}

export function useTargetNodeContext(): TargetNodeContextValue {
  const context = useContext(TargetNodeContext);
  if (!context) {
    throw new Error('useTargetNodeContext must be used within TargetNodeContextProvider.');
  }
  return context;
}

export function useOptionalTargetNodeContext(): TargetNodeContextValue | null {
  return useContext(TargetNodeContext);
}

export function useBuildSessionRuntimeContext(): BuildSessionRuntimeContextValue {
  const context = useContext(BuildSessionRuntimeContext);
  if (!context) {
    throw new Error(
      'useBuildSessionRuntimeContext must be used within BuildSessionRuntimeContextProvider.'
    );
  }
  return context;
}

export function useOptionalBuildSessionRuntimeContext(): BuildSessionRuntimeContextValue | null {
  return useContext(BuildSessionRuntimeContext);
}

export function useTargetNodeBuildSessionContext(): TargetNodeBuildSessionContextValue {
  const context = useContext(TargetNodeBuildSessionContext);
  if (!context) {
    throw new Error(
      'useTargetNodeBuildSessionContext must be used within TargetNodeBuildSessionContextProvider.'
    );
  }
  return context;
}

export function useOptionalTargetNodeBuildSessionContext(): TargetNodeBuildSessionContextValue | null {
  return useContext(TargetNodeBuildSessionContext);
}

export function resolveBuildSessionNavigationNodeType(params: {
  nodeId: NodeId;
  runtimeNodeType?: NodeType | null;
  targetNodeId?: NodeId | null;
  targetNodeType?: string | null;
}): string {
  const { nodeId, runtimeNodeType, targetNodeId, targetNodeType } = params;
  if (targetNodeId && targetNodeType && targetNodeId === nodeId) {
    return targetNodeType;
  }
  return runtimeNodeType ?? DEFAULT_BUILD_SESSION_NODE_TYPE;
}
