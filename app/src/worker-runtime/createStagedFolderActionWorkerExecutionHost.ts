import type {
  BuildSessionStatus,
  BuildSessionStatusValue,
  CanonicalBuildInputSource,
} from '@hierarchidb/build-api';
import type { NodeId, NodeType } from '@hierarchidb/core-types';
import {
  type CoreDB,
  createStagedFolderActionCoreRunnerDependencies,
  runStagedFolderAction,
  type StagedFolderActionProgressStore,
} from '@hierarchidb/runtime-worker';
import type { StagedFolderActionRunRecord } from '@hierarchidb/staged-folder-action';
import type { TreeNode } from '@hierarchidb/tree-api';
import type { RunStagedFolderActionInput } from '@hierarchidb/worker-api';

export type StagedFolderActionWorkerExecutionHost = (
  input: RunStagedFolderActionInput
) => Promise<StagedFolderActionRunRecord>;

export type CreateStagedFolderActionWorkerExecutionHostInput = {
  coreDB: CoreDB;
  progressStore: StagedFolderActionProgressStore;
  getNode(nodeId: NodeId): Promise<TreeNode | null | undefined>;
  listDescendants(nodeId: NodeId): Promise<TreeNode[]>;
  canBuildNodeType(nodeType: NodeType): boolean;
  startBuildSession(
    nodeType: NodeType,
    nodeId: NodeId,
    inputSource: CanonicalBuildInputSource
  ): Promise<BuildSessionStatus>;
  getBuildSessionStatus(nodeType: NodeType, nodeId: NodeId): Promise<BuildSessionStatus>;
  now?: () => number;
  delay?: (ms: number) => Promise<void>;
  buildPollIntervalMs?: number;
  buildTimeoutMs?: number;
};

const STAGED_FOLDER_ACTION_BUILD_TERMINAL_STATUSES = new Set<BuildSessionStatusValue>([
  'completed',
  'failed',
  'paused',
  'recycled',
]);

const DEFAULT_BUILD_POLL_INTERVAL_MS = 500;
const DEFAULT_BUILD_TIMEOUT_MS = 30 * 60 * 1000;

export function createStagedFolderActionWorkerExecutionHost({
  coreDB,
  progressStore,
  getNode,
  listDescendants,
  canBuildNodeType,
  startBuildSession,
  getBuildSessionStatus,
  now = Date.now,
  delay = defaultDelay,
  buildPollIntervalMs = DEFAULT_BUILD_POLL_INTERVAL_MS,
  buildTimeoutMs = DEFAULT_BUILD_TIMEOUT_MS,
}: CreateStagedFolderActionWorkerExecutionHostInput): StagedFolderActionWorkerExecutionHost {
  return async (input) => {
    const dependencies = createStagedFolderActionCoreRunnerDependencies({
      coreDB,
      progressStore,
      now,
      runBuildAction: async ({ stagingRootNodeId }) => {
        const stagingRoot = await getNode(stagingRootNodeId);
        if (!stagingRoot) {
          throw new Error(
            `[worker bootstrap] staged-folder-action staging root not found: ${String(stagingRootNodeId)}`
          );
        }
        const targetCollection = await collectStagedFolderActionBuildTargets({
          stagingRoot,
          listDescendants,
          canBuildNodeType,
        });
        if (targetCollection.candidates.length === 0) {
          throw new Error(
            `[worker bootstrap] staged-folder-action build target candidate was not found under staging root: ${String(stagingRootNodeId)}`
          );
        }
        const completedTargets = [];
        for (const target of targetCollection.targets) {
          const nodeType = target.nodeType as NodeType;
          const nodeId = target.id as NodeId;
          const started = await startBuildSession(nodeType, nodeId, 'committed');
          const terminal = await waitForStagedFolderActionBuildTerminal({
            nodeType,
            nodeId,
            startedStatus: started,
            getBuildSessionStatus,
            now,
            delay,
            buildPollIntervalMs,
            buildTimeoutMs,
          });
          if (terminal.status !== 'completed') {
            throw new Error(
              `[worker bootstrap] staged-folder-action build did not complete: status=${terminal.status}, nodeType=${String(nodeType)}, nodeId=${String(nodeId)}`
            );
          }
          completedTargets.push({
            nodeType,
            nodeId,
            status: terminal.status,
          });
        }
        return {
          nodeType: stagingRoot.nodeType as NodeType,
          nodeId: stagingRootNodeId,
          status: 'completed',
          targets: completedTargets,
        };
      },
    });
    return runStagedFolderAction(dependencies, input);
  };
}

type CollectStagedFolderActionBuildTargetsInput = {
  stagingRoot: TreeNode;
  listDescendants(nodeId: NodeId): Promise<TreeNode[]>;
  canBuildNodeType(nodeType: NodeType): boolean;
};

export type StagedFolderActionBuildTargetCollection = {
  candidates: TreeNode[];
  targets: TreeNode[];
};

export async function collectStagedFolderActionBuildTargets({
  stagingRoot,
  listDescendants,
  canBuildNodeType,
}: CollectStagedFolderActionBuildTargetsInput): Promise<StagedFolderActionBuildTargetCollection> {
  if (canBuildNodeType(stagingRoot.nodeType as NodeType)) {
    return {
      candidates: [stagingRoot],
      targets: isBuildRequired(stagingRoot) ? [stagingRoot] : [],
    };
  }
  const descendants = await listDescendants(stagingRoot.id as NodeId);
  const candidates = descendants.filter((node) => canBuildNodeType(node.nodeType as NodeType));
  return {
    candidates,
    targets: candidates.filter(isBuildRequired),
  };
}

const isBuildRequired = (node: TreeNode): boolean =>
  Boolean(node.draftMetadata?.buildMetadata?.buildRequired) ||
  Boolean(node.metadata?.buildMetadata?.buildRequired);

type WaitForStagedFolderActionBuildTerminalInput = {
  nodeType: NodeType;
  nodeId: NodeId;
  startedStatus: BuildSessionStatus;
  getBuildSessionStatus(nodeType: NodeType, nodeId: NodeId): Promise<BuildSessionStatus>;
  now: () => number;
  delay(ms: number): Promise<void>;
  buildPollIntervalMs: number;
  buildTimeoutMs: number;
};

export async function waitForStagedFolderActionBuildTerminal({
  nodeType,
  nodeId,
  startedStatus,
  getBuildSessionStatus,
  now,
  delay,
  buildPollIntervalMs,
  buildTimeoutMs,
}: WaitForStagedFolderActionBuildTerminalInput): Promise<BuildSessionStatus> {
  if (STAGED_FOLDER_ACTION_BUILD_TERMINAL_STATUSES.has(startedStatus.status)) {
    return startedStatus;
  }
  const deadline = now() + buildTimeoutMs;
  while (now() < deadline) {
    await delay(buildPollIntervalMs);
    const status = await getBuildSessionStatus(nodeType, nodeId);
    if (STAGED_FOLDER_ACTION_BUILD_TERMINAL_STATUSES.has(status.status)) {
      return status;
    }
  }
  throw new Error(
    `[worker bootstrap] staged-folder-action build timed out for nodeType=${String(nodeType)}, nodeId=${String(nodeId)}`
  );
}

const defaultDelay = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });
