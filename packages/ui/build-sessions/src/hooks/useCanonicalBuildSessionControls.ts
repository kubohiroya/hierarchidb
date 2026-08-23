import type { CanonicalBuildInputSource } from '@hierarchidb/build-api';
import type { NodeId, NodeType } from '@hierarchidb/core-types';
import { getBuildWorkerBridge } from '@hierarchidb/ui-worker-client';
import { useCallback, useEffect, useRef, useState } from 'react';

export type CanonicalBuildSessionSameRealmCommands = {
  initialize?: () => Promise<void>;
  startBuildSession: (nodeId: NodeId, inputSource: CanonicalBuildInputSource) => Promise<unknown>;
  pauseBuildSession: (nodeId: NodeId, reason?: string) => Promise<void>;
  cancelQueuedBuildSession: (nodeId: NodeId, reason?: string) => Promise<void>;
};

export type CanonicalBuildSessionCommandTransport =
  | {
      kind: 'worker';
      nodeType: NodeType;
      inputSource: CanonicalBuildInputSource;
    }
  | {
      kind: 'same-realm';
      commands: CanonicalBuildSessionSameRealmCommands;
    };

export type UseCanonicalBuildSessionControlsConfig = {
  nodeId: NodeId | null;
  subscriptionReady: boolean;
  commandTransport: CanonicalBuildSessionCommandTransport;
};

export type CanonicalBuildSessionControlIntent = 'start' | 'pause' | 'cancel';

export interface CanonicalBuildSessionControlState {
  pendingCommand: CanonicalBuildSessionControlIntent | null;
  mutationError: Error | null;
  canStartBuildSession: boolean;
  startBuildSession: () => Promise<boolean>;
  pauseBuildSession: (reason?: string) => Promise<boolean>;
  cancelQueuedBuildSession: (reason?: string) => Promise<boolean>;
  clearMutationError: () => void;
}

const SUBSCRIPTION_NOT_READY_ERROR =
  '[canonicalBuildSessionControls] canonical event subscription is not ready';
const COMMAND_TRANSPORT_NOT_READY_ERROR =
  '[canonicalBuildSessionControls] canonical command transport is not ready';

type CanonicalBuildSessionCommandTarget = {
  nodeId: NodeId;
  workerNodeType: NodeType | undefined;
  workerInputSource: CanonicalBuildInputSource | undefined;
  sameRealmInitialize: (() => Promise<void>) | undefined;
  sameRealmStartBuildSession:
    | CanonicalBuildSessionSameRealmCommands['startBuildSession']
    | undefined;
  sameRealmPauseBuildSession:
    | CanonicalBuildSessionSameRealmCommands['pauseBuildSession']
    | undefined;
  sameRealmCancelQueuedBuildSession:
    | CanonicalBuildSessionSameRealmCommands['cancelQueuedBuildSession']
    | undefined;
};

export const useCanonicalBuildSessionControls = (
  config: UseCanonicalBuildSessionControlsConfig
): CanonicalBuildSessionControlState => {
  const { commandTransport, nodeId, subscriptionReady } = config;
  const workerNodeType = commandTransport.kind === 'worker' ? commandTransport.nodeType : undefined;
  const workerInputSource =
    commandTransport.kind === 'worker' ? commandTransport.inputSource : undefined;
  const sameRealmInitialize =
    commandTransport.kind === 'same-realm' ? commandTransport.commands.initialize : undefined;
  const sameRealmStartBuildSession =
    commandTransport.kind === 'same-realm'
      ? commandTransport.commands.startBuildSession
      : undefined;
  const sameRealmPauseBuildSession =
    commandTransport.kind === 'same-realm'
      ? commandTransport.commands.pauseBuildSession
      : undefined;
  const sameRealmCancelQueuedBuildSession =
    commandTransport.kind === 'same-realm'
      ? commandTransport.commands.cancelQueuedBuildSession
      : undefined;
  const [pendingCommand, setPendingCommand] = useState<CanonicalBuildSessionControlIntent | null>(
    null
  );
  const [mutationError, setMutationError] = useState<Error | null>(null);
  const [readyCommandTarget, setReadyCommandTarget] =
    useState<CanonicalBuildSessionCommandTarget | null>(null);
  const commandGenerationRef = useRef(0);
  const commandInFlightRef = useRef(false);

  const matchesCurrentCommandTarget = (target: CanonicalBuildSessionCommandTarget): boolean =>
    target.nodeId === nodeId &&
    target.workerNodeType === workerNodeType &&
    target.workerInputSource === workerInputSource &&
    target.sameRealmInitialize === sameRealmInitialize &&
    target.sameRealmStartBuildSession === sameRealmStartBuildSession &&
    target.sameRealmPauseBuildSession === sameRealmPauseBuildSession &&
    target.sameRealmCancelQueuedBuildSession === sameRealmCancelQueuedBuildSession;
  const commandReady =
    readyCommandTarget !== null && matchesCurrentCommandTarget(readyCommandTarget);

  useEffect(() => {
    commandGenerationRef.current += 1;
    const generation = commandGenerationRef.current;
    const invalidateGeneration = (): void => {
      if (generation === commandGenerationRef.current) {
        commandGenerationRef.current += 1;
      }
      commandInFlightRef.current = false;
    };
    commandInFlightRef.current = false;
    setPendingCommand(null);
    setMutationError(null);
    setReadyCommandTarget(null);
    if (!nodeId) {
      return invalidateGeneration;
    }
    const target: CanonicalBuildSessionCommandTarget = {
      nodeId,
      workerNodeType,
      workerInputSource,
      sameRealmInitialize,
      sameRealmStartBuildSession,
      sameRealmPauseBuildSession,
      sameRealmCancelQueuedBuildSession,
    };
    const initialize =
      workerNodeType === undefined
        ? sameRealmInitialize
        : () => getBuildWorkerBridge().initialize();
    if (!initialize) {
      setReadyCommandTarget(target);
      return invalidateGeneration;
    }
    void initialize()
      .then(() => {
        if (generation !== commandGenerationRef.current) return;
        setReadyCommandTarget(target);
      })
      .catch((error: unknown) => {
        if (generation !== commandGenerationRef.current) return;
        setMutationError(error instanceof Error ? error : new Error(String(error)));
      });
    return invalidateGeneration;
  }, [
    nodeId,
    sameRealmCancelQueuedBuildSession,
    sameRealmInitialize,
    sameRealmPauseBuildSession,
    sameRealmStartBuildSession,
    workerInputSource,
    workerNodeType,
  ]);

  const runMutation = useCallback(
    async (
      intent: CanonicalBuildSessionControlIntent,
      operation: (targetNodeId: NodeId) => Promise<unknown>
    ): Promise<boolean> => {
      if (!nodeId || commandInFlightRef.current) return false;
      if (!commandReady) {
        setMutationError(new Error(COMMAND_TRANSPORT_NOT_READY_ERROR));
        return false;
      }
      const generation = commandGenerationRef.current;
      commandInFlightRef.current = true;
      setPendingCommand(intent);
      setMutationError(null);
      try {
        await operation(nodeId);
        return true;
      } catch (error) {
        const resolved = error instanceof Error ? error : new Error(String(error));
        if (generation === commandGenerationRef.current) {
          setMutationError(resolved);
        }
        return false;
      } finally {
        if (generation === commandGenerationRef.current) {
          commandInFlightRef.current = false;
          setPendingCommand(null);
        }
      }
    },
    [commandReady, nodeId]
  );

  const startBuildSession = useCallback(async (): Promise<boolean> => {
    if (!nodeId) return false;
    if (!subscriptionReady) {
      setMutationError(new Error(SUBSCRIPTION_NOT_READY_ERROR));
      return false;
    }
    return runMutation('start', async (targetNodeId) => {
      if (workerNodeType !== undefined) {
        if (workerInputSource === undefined) {
          throw new Error('[canonicalBuildSessionControls] worker input source is unavailable');
        }
        await getBuildWorkerBridge().startBuildSession(
          workerNodeType,
          targetNodeId,
          workerInputSource
        );
        return;
      }
      if (!sameRealmStartBuildSession) {
        throw new Error('[canonicalBuildSessionControls] same-realm commands are unavailable');
      }
      await sameRealmStartBuildSession(targetNodeId, 'working-copy');
    });
  }, [
    nodeId,
    runMutation,
    sameRealmStartBuildSession,
    subscriptionReady,
    workerInputSource,
    workerNodeType,
  ]);

  const pauseBuildSession = useCallback(
    async (reason?: string): Promise<boolean> =>
      runMutation('pause', async (targetNodeId) => {
        if (workerNodeType !== undefined) {
          await getBuildWorkerBridge().pauseBuildSession(workerNodeType, targetNodeId, reason);
          return;
        }
        if (!sameRealmPauseBuildSession) {
          throw new Error('[canonicalBuildSessionControls] same-realm commands are unavailable');
        }
        await sameRealmPauseBuildSession(targetNodeId, reason);
      }),
    [runMutation, sameRealmPauseBuildSession, workerNodeType]
  );

  const cancelQueuedBuildSession = useCallback(
    async (reason?: string): Promise<boolean> =>
      runMutation('cancel', async (targetNodeId) => {
        if (workerNodeType !== undefined) {
          await getBuildWorkerBridge().cancelQueuedBuildSession(
            workerNodeType,
            targetNodeId,
            reason
          );
          return;
        }
        if (!sameRealmCancelQueuedBuildSession) {
          throw new Error('[canonicalBuildSessionControls] same-realm commands are unavailable');
        }
        await sameRealmCancelQueuedBuildSession(targetNodeId, reason);
      }),
    [runMutation, sameRealmCancelQueuedBuildSession, workerNodeType]
  );

  const clearMutationError = useCallback(() => {
    setMutationError(null);
  }, []);

  return {
    pendingCommand,
    mutationError,
    canStartBuildSession: Boolean(
      nodeId && subscriptionReady && commandReady && pendingCommand === null
    ),
    startBuildSession,
    pauseBuildSession,
    cancelQueuedBuildSession,
    clearMutationError,
  };
};
