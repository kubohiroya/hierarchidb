import { unconditionalEventStreamer } from '@hierarchidb/build-runtime-services';
import type { NodeId, NodeType } from '@hierarchidb/core-types';
import { getBuildWorkerBridge } from '@hierarchidb/ui-worker-client';
import { useEffect, useState } from 'react';
import {
  type CanonicalBuildSessionKernelConsumer,
  type CanonicalBuildSessionSubscriptionHandlers,
  createCanonicalBuildSessionSubscriptionKernel,
} from '../kernel/createCanonicalBuildSessionSubscriptionKernel.js';

export type CanonicalBuildSessionSubscriptionTransport = 'worker' | 'same-realm';

export type UseCanonicalBuildSessionSubscriptionConfig<StageId extends string> = {
  nodeType: NodeType;
  nodeId: NodeId | null;
  autoSubscribe?: boolean;
  subscriptionTransport: CanonicalBuildSessionSubscriptionTransport;
  resolveStageId: (value: unknown) => StageId;
  consumer: Omit<CanonicalBuildSessionKernelConsumer<StageId>, 'onError'>;
};

export type CanonicalBuildSessionSubscriptionState = {
  subscriptionReady: boolean;
  subscriptionError: Error | null;
};

type CanonicalBuildSessionSubscriptionIdentity<StageId extends string> = {
  autoSubscribe: boolean;
  consumer: Omit<CanonicalBuildSessionKernelConsumer<StageId>, 'onError'>;
  nodeId: NodeId;
  nodeType: NodeType;
  resolveStageId: (value: unknown) => StageId;
  subscriptionTransport: CanonicalBuildSessionSubscriptionTransport;
};

type CanonicalBuildSessionSubscriptionFailure<StageId extends string> = {
  identity: CanonicalBuildSessionSubscriptionIdentity<StageId>;
  error: Error;
};

const subscribeSameRealmCanonicalEvents = (
  nodeId: NodeId,
  handlers: CanonicalBuildSessionSubscriptionHandlers
): (() => void) => {
  const unsubscribers: Array<() => void> = [];
  try {
    unsubscribers.push(
      unconditionalEventStreamer.subscribe(nodeId, 'stage-snapshot', handlers.onTaskEvent),
      unconditionalEventStreamer.subscribe(nodeId, 'task-progress', handlers.onProgressEvent),
      unconditionalEventStreamer.subscribe(nodeId, 'session-state', handlers.onSessionState),
      unconditionalEventStreamer.subscribe(nodeId, 'heartbeat', handlers.onHeartbeat)
    );
  } catch (error) {
    for (const unsubscribe of unsubscribers.splice(0)) {
      unsubscribe();
    }
    throw error;
  }
  let disposed = false;
  return () => {
    if (disposed) return;
    disposed = true;
    for (const unsubscribe of unsubscribers.splice(0)) {
      unsubscribe();
    }
  };
};

export const useCanonicalBuildSessionSubscription = <StageId extends string>(
  config: UseCanonicalBuildSessionSubscriptionConfig<StageId>
): CanonicalBuildSessionSubscriptionState => {
  const {
    autoSubscribe = true,
    consumer,
    nodeId,
    nodeType,
    resolveStageId,
    subscriptionTransport,
  } = config;
  const [readyIdentity, setReadyIdentity] =
    useState<CanonicalBuildSessionSubscriptionIdentity<StageId> | null>(null);
  const [subscriptionFailure, setSubscriptionFailure] =
    useState<CanonicalBuildSessionSubscriptionFailure<StageId> | null>(null);

  const matchesCurrentSubscription = (
    identity: CanonicalBuildSessionSubscriptionIdentity<StageId>
  ): boolean =>
    identity.autoSubscribe === autoSubscribe &&
    identity.consumer === consumer &&
    identity.nodeId === nodeId &&
    identity.nodeType === nodeType &&
    identity.resolveStageId === resolveStageId &&
    identity.subscriptionTransport === subscriptionTransport;

  useEffect(() => {
    consumer.onReset();
    setReadyIdentity(null);
    setSubscriptionFailure(null);
    if (!nodeId || !autoSubscribe) return;

    const identity: CanonicalBuildSessionSubscriptionIdentity<StageId> = {
      autoSubscribe,
      consumer,
      nodeId,
      nodeType,
      resolveStageId,
      subscriptionTransport,
    };

    let cancelled = false;
    let unsubscribeAll: (() => void) | undefined;
    const kernel = createCanonicalBuildSessionSubscriptionKernel({
      nodeId,
      resolveStageId,
      consumer: {
        ...consumer,
        onError: (error) => {
          if (!cancelled) setSubscriptionFailure({ identity, error });
        },
      },
    });

    const run = async (): Promise<void> => {
      let acquiredUnsubscribe: () => void;
      if (subscriptionTransport === 'same-realm') {
        acquiredUnsubscribe = subscribeSameRealmCanonicalEvents(nodeId, kernel.handlers);
      } else {
        const bridge = getBuildWorkerBridge();
        await bridge.initialize();
        if (cancelled) return;
        acquiredUnsubscribe = await bridge.subscribeAll(nodeType, nodeId, kernel.handlers);
      }
      if (cancelled) {
        acquiredUnsubscribe();
        return;
      }
      unsubscribeAll = acquiredUnsubscribe;
      setReadyIdentity(identity);
    };

    void run().catch((error: unknown) => {
      if (cancelled) return;
      setSubscriptionFailure({
        identity,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    });

    return () => {
      cancelled = true;
      kernel.dispose();
      unsubscribeAll?.();
    };
  }, [autoSubscribe, consumer, nodeId, nodeType, resolveStageId, subscriptionTransport]);

  return {
    subscriptionReady: readyIdentity !== null && matchesCurrentSubscription(readyIdentity),
    subscriptionError:
      subscriptionFailure !== null && matchesCurrentSubscription(subscriptionFailure.identity)
        ? subscriptionFailure.error
        : null,
  };
};
