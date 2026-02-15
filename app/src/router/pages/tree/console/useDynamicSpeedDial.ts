import type { TreeId } from '@hierarchidb/core-types';
import { useIconRegistry } from '@hierarchidb/ui-icon';
import { useGlobalI18nTranslator } from '@hierarchidb/ui-plugin-shell/ui-i18n';
import type { HierarchicalTreeNode } from '@hierarchidb/ui-treeconsole-base';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePluginMenuItems } from '~/hooks/usePluginMenuItems.js';
import type { PluginMenuItem, TreeContext } from '~/plugin-loaders/menu-builders.js';

type DynamicSpeedDialWindow = Window & {
  __HDB_SD_HITBOX__?: boolean;
};

type DialogVisibilityEvent = CustomEvent<{ open: boolean; count: number }>;

const SPEED_DIAL_TRANSITION_MS = 220;

export interface DynamicSpeedDialState {
  open: boolean;
  debugHitbox: boolean;
  hitboxes: {
    container?: DOMRect;
    fab?: DOMRect;
    actions: DOMRect[];
    topAtFab?: string;
  };
  useVM: boolean;
  vmItems: PluginMenuItem[];
  language: string;
  actionsPointerEvents: 'auto' | 'none';
  dialogOpen: boolean;
}

export interface UseDynamicSpeedDialResult extends DynamicSpeedDialState {
  containerRef: React.RefObject<HTMLDivElement | null>;
  resolveIcon: ReturnType<typeof useIconRegistry>['resolveIcon'];
  translateWithFallback: (key: string, fallback: string) => string;
  handleClose: () => void;
  toggleOpen: () => void;
  handleVMActionClick: (createType: string, options?: { openInNewTab?: boolean }) => void;
  transitionDuration: number;
}

export function useDynamicSpeedDial(params: {
  treeId?: TreeId;
  hidden?: boolean;
  onCreateAction: (action: string, node: HierarchicalTreeNode, options?: { openInNewTab?: boolean }) => void;
  onSuppress?: () => void;
  menuContext?: TreeContext;
}): UseDynamicSpeedDialResult {
  const { treeId, hidden, onCreateAction, onSuppress } = params;
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [debugHitbox, setDebugHitbox] = useState<boolean>(() => {
    try {
      const sp = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      const urlOn = sp?.get('sdHitbox') === '1' || sp?.get('debug') === 'sd';
      const persisted =
        typeof localStorage !== 'undefined' ? localStorage.getItem('hdb.sd.hitbox') === '1' : false;
      const globalOn =
        typeof window !== 'undefined' &&
        (window as DynamicSpeedDialWindow).__HDB_SD_HITBOX__ === true;
      return urlOn || persisted || globalOn;
    } catch {
      return false;
    }
  });

  const [hitboxes, setHitboxes] = useState<DynamicSpeedDialState['hitboxes']>({ actions: [] });
  const [dialogOpen, setDialogOpen] = useState<boolean>(() => {
    if (typeof document === 'undefined') return false;
    return document.body?.dataset?.hdbDialogOpen === '1';
  });

  const vmItems = usePluginMenuItems(treeId);
  const useVM = vmItems.length > 0;
  const { t, language } = useGlobalI18nTranslator();
  const { resolveIcon } = useIconRegistry();

  const translateWithFallback = useCallback(
    (key: string, fallback: string) => {
      const safeFallback = fallback?.trim?.() ?? '';
      const translated = t(key, safeFallback);
      if (translated === key) {
        return safeFallback || key;
      }
      return translated;
    },
    [t]
  );

  const handleClose = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onDocPointerDown = (ev: Event) => {
      const root = containerRef.current;
      const target = ev.target as Node | null;
      if (!root) return;
      if (target && target instanceof Element) {
        if (target.closest('[data-hdb-speed-dial-submenu="1"]')) return;
      }
      if (target && root.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', onDocPointerDown, true);
    return () => {
      document.removeEventListener('pointerdown', onDocPointerDown, true);
    };
  }, [open]);

  useEffect(() => {
    if (hidden || dialogOpen) {
      setOpen(false);
    }
  }, [dialogOpen, hidden]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (event: Event) => {
      const detail = (event as DialogVisibilityEvent).detail;
      if (!detail) return;
      setDialogOpen(detail.open);
    };
    window.addEventListener('hdb:dialog-visibility', handler as EventListener);
    return () => {
      window.removeEventListener('hdb:dialog-visibility', handler as EventListener);
    };
  }, []);

  const handleVMActionClick = useCallback(
    (createType: string, options?: { openInNewTab?: boolean }) => {
      const action = `create:${createType}`;
      onSuppress?.();
      handleClose();
      onCreateAction(action, {} as HierarchicalTreeNode, options);
    },
    [handleClose, onCreateAction, onSuppress]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && e.shiftKey && (e.key === 'h' || e.key === 'H')) {
        setDebugHitbox((v) => {
          const nv = !v;
          localStorage.setItem('hdb.sd.hitbox', nv ? '1' : '0');
          (window as DynamicSpeedDialWindow).__HDB_SD_HITBOX__ = nv;
          return nv;
        });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!debugHitbox) return;
    let raf = 0;
    let intervalId: number | undefined;
    const measure = () => {
      const root = containerRef.current;
      if (!root) return;
      const fab = root.querySelector('.MuiSpeedDial-fab') as HTMLElement | null;
      const actions = Array.from(root.querySelectorAll('.MuiSpeedDialAction-fab')) as HTMLElement[];
      const rectRoot = root.getBoundingClientRect();
      const rectFab = fab?.getBoundingClientRect();
      const rectActs = actions.map((a) => a.getBoundingClientRect());
      let topAtFab: string | undefined;
      if (rectFab) {
        const cx = rectFab.left + rectFab.width / 2;
        const cy = rectFab.top + rectFab.height / 2;
        const el = document.elementFromPoint(cx, cy);
        if (el) {
          const cls = (el as HTMLElement).className?.toString?.() || '';
          const id = (el as HTMLElement).id ? `#${(el as HTMLElement).id}` : '';
          const tn = el.nodeName.toLowerCase();
          topAtFab = `${tn}${id}${cls ? `.${cls.toString().split(' ').slice(0, 3).join('.')}` : ''}`;
        }
      }
      setHitboxes({ container: rectRoot, fab: rectFab, actions: rectActs, topAtFab });
    };
    const onScrollOrResize = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    intervalId = window.setInterval(measure, 300) as unknown as number;
    measure();
    return () => {
      if (raf) cancelAnimationFrame(raf);
      if (intervalId) window.clearInterval(intervalId);
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [debugHitbox]);

  const actionsPointerEvents = useMemo(() => (open ? 'auto' : 'none'), [open]);

  return {
    open,
    debugHitbox,
    hitboxes,
    useVM,
    vmItems,
    language,
    actionsPointerEvents,
    dialogOpen,
    containerRef,
    resolveIcon,
    translateWithFallback,
    handleClose,
    toggleOpen: () => setOpen((v) => !v),
    handleVMActionClick,
    transitionDuration: SPEED_DIAL_TRANSITION_MS,
  };
}
