import { useCallback, useEffect, useRef, type MutableRefObject } from 'react';
import type { AuthProviderType } from '@hierarchidb/ui-auth';

type CallbackInput = {
  handleStartOrResume?: () => Promise<void>;
  handlePause?: () => void | Promise<void>;
  handleCancelQueued?: () => void | Promise<void>;
  closeAuthDialog?: () => void;
  handleProviderSelect?: (provider: AuthProviderType) => void;
  setCrashSuspectOpenFromHook: () => void;
  setSuspendSuspectOpenFromHook: () => void;
  forceResetStopState?: () => void;
};

type ShapeBuildStepAtomSyncCallbacks = {
  handleStartOrResumeRef: MutableRefObject<(() => Promise<void>) | null>;
  handlePauseRef: MutableRefObject<(() => void | Promise<void>) | null>;
  handleCancelQueuedRef: MutableRefObject<(() => void | Promise<void>) | null>;
  closeAuthDialogRef: MutableRefObject<(() => void) | null>;
  handleProviderSelectRef: MutableRefObject<((provider: AuthProviderType) => void) | null>;
  forceResetStopStateRef: MutableRefObject<(() => void) | null>;
  stableHandleStartOrResume: () => Promise<void>;
  stableHandlePause: () => void;
  stableHandleCancelQueued: () => void;
  stableCloseAuthDialog: () => void;
  stableHandleProviderSelect: (provider: AuthProviderType) => void;
  stableCloseCrashSuspect: () => void;
  stableCloseSuspendSuspect: () => void;
  stableForceResetStopState: () => void;
};

export const useShapeBuildStepAtomSyncCallbacks = ({
  handleStartOrResume,
  handlePause,
  handleCancelQueued,
  closeAuthDialog,
  handleProviderSelect,
  setCrashSuspectOpenFromHook,
  setSuspendSuspectOpenFromHook,
  forceResetStopState,
}: CallbackInput): ShapeBuildStepAtomSyncCallbacks => {
  const handleStartOrResumeRef = useRef<(() => Promise<void>) | null>(null);
  const handlePauseRef = useRef<(() => void | Promise<void>) | null>(null);
  const handleCancelQueuedRef = useRef<(() => void | Promise<void>) | null>(null);
  const closeAuthDialogRef = useRef<(() => void) | null>(null);
  const handleProviderSelectRef = useRef<((provider: AuthProviderType) => void) | null>(null);
  const forceResetStopStateRef = useRef<(() => void) | null>(null);

  const stableHandleStartOrResume = useCallback(() => {
    return handleStartOrResumeRef.current ? handleStartOrResumeRef.current() : Promise.resolve();
  }, []);

  const stableHandlePause = useCallback(() => {
    void handlePauseRef.current?.();
  }, []);

  const stableHandleCancelQueued = useCallback(() => {
    void handleCancelQueuedRef.current?.();
  }, []);

  const stableCloseAuthDialog = useCallback(() => {
    closeAuthDialogRef.current?.();
  }, []);

  const stableHandleProviderSelect = useCallback((provider: AuthProviderType) => {
    handleProviderSelectRef.current?.(provider);
  }, []);

  const stableCloseCrashSuspect = useCallback(() => {
    setCrashSuspectOpenFromHook();
  }, [setCrashSuspectOpenFromHook]);

  const stableCloseSuspendSuspect = useCallback(() => {
    setSuspendSuspectOpenFromHook();
  }, [setSuspendSuspectOpenFromHook]);

  const stableForceResetStopState = useCallback(() => {
    forceResetStopStateRef.current?.();
  }, []);

  useEffect(() => {
    handleStartOrResumeRef.current = handleStartOrResume ?? null;
    handlePauseRef.current = handlePause ?? null;
    handleCancelQueuedRef.current = handleCancelQueued ?? null;
    closeAuthDialogRef.current = closeAuthDialog ?? null;
    handleProviderSelectRef.current = handleProviderSelect ?? null;
    forceResetStopStateRef.current = forceResetStopState ?? null;
  }, [handleStartOrResume, handlePause, handleCancelQueued, closeAuthDialog, handleProviderSelect, forceResetStopState]);

  return {
    handleStartOrResumeRef,
    handlePauseRef,
    handleCancelQueuedRef,
    closeAuthDialogRef,
    handleProviderSelectRef,
    forceResetStopStateRef,
    stableHandleStartOrResume,
    stableHandlePause,
    stableHandleCancelQueued,
    stableCloseAuthDialog,
    stableHandleProviderSelect,
    stableCloseCrashSuspect,
    stableCloseSuspendSuspect,
    stableForceResetStopState,
  };
};
