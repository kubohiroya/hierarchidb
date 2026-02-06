import type { PeerEntity } from '@hierarchidb/core-types';
import type { TreeNodeUpdaterState } from '@hierarchidb/plugin-ui-sdk';
import { useEffect, useRef } from 'react';

type Params<TPayload extends PeerEntity> = {
  open: boolean;
  draft: TreeNodeUpdaterState<TPayload> | null;
  hasUnsavedChanges: boolean;
  saveDraft: (draft: TreeNodeUpdaterState<TPayload>) => Promise<unknown>;
  enabled?: boolean;
};

export function useAutosave<TPayload extends PeerEntity>({
  open,
  draft,
  hasUnsavedChanges,
  saveDraft,
  enabled = true,
}: Params<TPayload>) {
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!enabled || !open || !draft || !hasUnsavedChanges) {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
      return;
    }
    autoSaveTimerRef.current = setTimeout(() => {
      saveDraft(draft).catch((err) => {
        if (typeof console !== 'undefined' && typeof console.warn === 'function') {
          console.warn('[PluginDialogShell] autosave failed', err);
        }
      });
    }, 800);
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
  }, [draft, enabled, hasUnsavedChanges, open, saveDraft]);
}
