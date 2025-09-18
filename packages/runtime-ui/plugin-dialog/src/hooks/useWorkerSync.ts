/**
 * Worker Sync Hook
 * Synchronizes Jotai atoms with Worker state
 */

import { useCallback, useEffect, useRef } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { NodeId } from '@hierarchidb/common-type';
import {
  dialogStateAtom,
  dialogStepsAtom,
  setStepCapabilitiesAtom,
  setValidationResultAtom,
  updateWorkingCopyAtom,
  workerConnectionAtom,
  workingCopyAtom,
} from '../atoms/workingCopyAtoms.js';
import {
  type CapabilitiesRequest,
  getWorkerBridge,
  type ValidationRequest,
  type WorkerNotification,
} from '../services/WorkerBridge.js';

interface UseWorkerSyncOptions {
  nodeId: NodeId;
  nodeType: string;
  enabled?: boolean;
}

/**
 * Hook to sync with Worker
 */
export function useWorkerSync({
                                nodeId,
                                nodeType,
                                enabled = true,
                              }: UseWorkerSyncOptions) {
  const [workerConnection, setWorkerConnection] = useAtom(workerConnectionAtom);
  const [workingCopy, setWorkingCopy] = useAtom(workingCopyAtom);
  const dialogState = useAtomValue(dialogStateAtom);
  const steps = useAtomValue(dialogStepsAtom);
  const setValidationResult = useSetAtom(setValidationResultAtom);
  const setStepCapabilities = useSetAtom(setStepCapabilitiesAtom);
  const updateWorkingCopy = useSetAtom(updateWorkingCopyAtom);

  const workerBridge = useRef(getWorkerBridge());
  const lastValidationRequest = useRef<string>('');
  const lastCapabilitiesRequest = useRef<string>('');

  // Initialize Worker connection
  useEffect(() => {
    if (!enabled) return;

    let mounted = true;

    const initWorker = async () => {
      try {
        setWorkerConnection({
          isConnected: false,
          isLoading: true,
          error: null,
        });

        await workerBridge.current.initialize();

        if (mounted) {
          setWorkerConnection({
            isConnected: true,
            isLoading: false,
            error: null,
          });
        }
      } catch (error) {
        if (mounted) {
          setWorkerConnection({
            isConnected: false,
            isLoading: false,
            error: error as Error,
          });
        }
      }
    };

    initWorker();

    return () => {
      mounted = false;
    };
  }, [enabled, setWorkerConnection]);

  // Subscribe to Worker notifications
  useEffect(() => {
    if (!enabled || !workerConnection.isConnected) return;

    const unsubscribe = workerBridge.current.subscribe(
      (notification: WorkerNotification) => {
        switch (notification.type) {
          case 'validation':
            setValidationResult(
              notification.result.stepId,
              {
                isValid: notification.result.isValid,
                errors: notification.result.errors,
                warnings: notification.result.warnings,
              },
            );
            break;

          case 'capabilities':
            setStepCapabilities(
              notification.stepIndex,
              notification.capabilities,
            );
            break;

          case 'workingCopyUpdated':
            setWorkingCopy(notification.data);
            break;

          case 'error':
            console.error('Worker error:', notification.error);
            break;
        }
      },
    );

    return unsubscribe;
  }, [
    enabled,
    workerConnection.isConnected,
    setValidationResult,
    setStepCapabilities,
    setWorkingCopy,
  ]);

  // Request validation when data changes
  useEffect(() => {
    if (!enabled || !workerConnection.isConnected || !workingCopy) return;

    const currentStep = steps[dialogState.currentStep];
    if (!currentStep) return;

    // Create request key to detect changes
    const requestKey = `${currentStep.id}-${JSON.stringify(workingCopy.data)}`;

    // Skip if same as last request
    if (requestKey === lastValidationRequest.current) return;
    lastValidationRequest.current = requestKey;

    // Queue validation request
    const request: ValidationRequest = {
      nodeId,
      stepId: currentStep.id,
      stepIndex: dialogState.currentStep,
      data: workingCopy.data,
      nodeType,
    };

    workerBridge.current.queueValidation(request);
  }, [
    enabled,
    workerConnection.isConnected,
    workingCopy,
    dialogState.currentStep,
    steps,
    nodeId,
    nodeType,
  ]);

  // Request capabilities evaluation when step or data changes
  useEffect(() => {
    if (!enabled || !workerConnection.isConnected || !workingCopy) return;

    // Create request key to detect changes
    const requestKey = `${dialogState.currentStep}-${JSON.stringify(workingCopy.data)}`;

    // Skip if same as last request
    if (requestKey === lastCapabilitiesRequest.current) return;
    lastCapabilitiesRequest.current = requestKey;

    // Queue capabilities evaluation for all steps
    steps.forEach((_step, index) => {
      const request: CapabilitiesRequest = {
        nodeId,
        stepIndex: index,
        data: workingCopy.data,
        nodeType,
        totalSteps: steps.length,
      };

      workerBridge.current.queueCapabilitiesEvaluation(request);
    });
  }, [
    enabled,
    workerConnection.isConnected,
    workingCopy,
    dialogState.currentStep,
    steps,
    nodeId,
    nodeType,
  ]);

  // Load working copy from Worker
  const loadWorkingCopy = useCallback(async () => {
    if (!workerConnection.isConnected) {
      throw new Error('Worker not connected');
    }

    try {
      const data = await workerBridge.current.loadWorkingCopy(nodeId);
      setWorkingCopy(data);
      return data;
    } catch (error) {
      console.error('Failed to load working copy:', error);
      throw error;
    }
  }, [workerConnection.isConnected, nodeId, setWorkingCopy]);

  // Save working copy to Worker
  const saveWorkingCopy = useCallback(async (asDraft: boolean = false) => {
    if (!workerConnection.isConnected || !workingCopy) {
      throw new Error('Cannot save: Worker not connected or no working copy');
    }

    try {
      const savedId = await workerBridge.current.saveWorkingCopy(
        nodeId,
        workingCopy,
        asDraft,
      );
      return savedId;
    } catch (error) {
      console.error('Failed to save working copy:', error);
      throw error;
    }
  }, [workerConnection.isConnected, workingCopy, nodeId]);

  // Update working copy on Worker
  const syncWorkingCopy = useCallback(async (updates: any) => {
    if (!workerConnection.isConnected) {
      // Store locally if Worker not connected
      updateWorkingCopy(updates);
      return;
    }

    try {
      // Update local state immediately
      updateWorkingCopy(updates);

      // Sync with Worker
      await workerBridge.current.updateWorkingCopy(nodeId, updates);
    } catch (error) {
      console.error('Failed to sync with Worker:', error);
      // Local state already updated, so user can continue
    }
  }, [workerConnection.isConnected, nodeId, updateWorkingCopy]);

  // Discard working copy
  const discardWorkingCopy = useCallback(async () => {
    if (!workerConnection.isConnected) {
      throw new Error('Worker not connected');
    }

    try {
      await workerBridge.current.discardWorkingCopy(nodeId);
      setWorkingCopy(null);
    } catch (error) {
      console.error('Failed to discard working copy:', error);
      throw error;
    }
  }, [workerConnection.isConnected, nodeId, setWorkingCopy]);

  // Start batch processing
  const startBatch = useCallback(async (batchConfig: any) => {
    if (!workerConnection.isConnected) {
      throw new Error('Worker not connected');
    }

    try {
      await workerBridge.current.startBatch(nodeId, batchConfig);
    } catch (error) {
      console.error('Failed to start batch:', error);
      throw error;
    }
  }, [workerConnection.isConnected, nodeId]);

  return {
    // Connection state
    isConnected: workerConnection.isConnected,
    isLoading: workerConnection.isLoading,
    connectionError: workerConnection.error,

    // Actions
    loadWorkingCopy,
    saveWorkingCopy,
    syncWorkingCopy,
    discardWorkingCopy,
    startBatch,
  };
}