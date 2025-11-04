import { Dialog, DialogContent, DialogTitle } from '@mui/material';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type Status = 'unknown' | 'starting' | 'ready' | 'error';
const WORKER_INIT_EVENT = 'hierarchidb-worker-init-complete' as const;

type IndexedDBWithDatabases = IDBFactory & {
  databases?: () => Promise<Array<{ name?: string | null }>>;
};

export const InitInspector: React.FC = () => {
  const [state, setState] = useState({
    clientReady: false,
    workerHasInstance: false,
    workerState: 'uninitialized' as 'uninitialized' | 'initializing' | 'initialized' | 'error',
    initCompleteFlag: false,
    lastInitEventTs: 0,
    channelMessageCount: 0,
    version: 'v1.0.0-05Sep1442PM',
    route: typeof location !== 'undefined' ? location.pathname + location.search : '',
  });

  const logDevWarning = useCallback((message: string, error?: unknown) => {
    if (typeof console === 'undefined') return;
    if (typeof error === 'undefined') {
      console.warn(`[InitInspector] ${message}`);
    } else {
      console.warn(`[InitInspector] ${message}`, error);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const update = async () => {
      try {
        const [{ WorkerAPIClient }, { isWorkerInitCompleted }] = await Promise.all([
          import('../WorkerAPIClient.ts'),
          import('../client.ts'),
        ]);
        const clientReady = WorkerAPIClient.isReady();
        const hasInstance = WorkerAPIClient.getRawWorkerInstance() != null;
        const initCompleteFlag = isWorkerInitCompleted();
        if (!mounted) return;
        setState((s) => ({
          ...s,
          clientReady,
          workerHasInstance: hasInstance,
          // state is private; mirror via isReady/hasInstance into coarse state
          workerState: clientReady ? 'initialized' : hasInstance ? 'initializing' : 'uninitialized',
          initCompleteFlag,
          route: location.pathname + location.search,
        }));
      } catch (error) {
        logDevWarning('Failed to refresh worker init state', error);
      }
    };
    update();
    const id = window.setInterval(update, 400);
    const onEvt = () =>
      setState((s) => ({
        ...s,
        lastInitEventTs: Date.now(),
        channelMessageCount: s.channelMessageCount + 1,
      }));
    try {
      window.addEventListener(WORKER_INIT_EVENT, onEvt);
    } catch (error) {
      logDevWarning('Failed to register worker init event listener', error);
    }
    return () => {
      mounted = false;
      window.clearInterval(id);
      try {
        window.removeEventListener(WORKER_INIT_EVENT, onEvt);
      } catch (error) {
        logDevWarning('Failed to remove worker init event listener', error);
      }
    };
  }, [logDevWarning]);

  const badge: Status = useMemo(() => {
    if (state.clientReady) return 'ready';
    if (state.workerHasInstance || state.initCompleteFlag) return 'starting';
    return 'unknown';
  }, [state.clientReady, state.workerHasInstance, state.initCompleteFlag]);

  const color = badge === 'ready' ? '#16a34a' : badge === 'starting' ? '#f59e0b' : '#6b7280';

  const forceEvent = () => {
    try {
      window.dispatchEvent(new Event('hierarchidb-worker-init-complete'));
    } catch (error) {
      logDevWarning('Failed to dispatch synthetic init event', error);
    }
  };

  const ping = async () => {
    const { WorkerAPIClient } = await import('../WorkerAPIClient.ts');
    try {
      await WorkerAPIClient.initialize();
      const client = WorkerAPIClient.getSingleton();
      const res = await client.ping();
      console.log('[InitInspector] ping:', res);
    } catch (e) {
      console.warn('[InitInspector] ping failed', e);
    }
  };

  const clearCaches = async () => {
    try {
      localStorage.clear();
    } catch (error) {
      logDevWarning('Failed to clear localStorage', error);
    }
    try {
      sessionStorage.clear();
    } catch (error) {
      logDevWarning('Failed to clear sessionStorage', error);
    }
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch (error) {
      logDevWarning('Failed to purge Cache Storage entries', error);
    }
    try {
      // Some browsers expose indexedDB.databases() as a function; feature-detect safely
      const indexedDBWithExtras = indexedDB as IndexedDBWithDatabases;
      const hasDatabasesFn = typeof indexedDBWithExtras?.databases === 'function';
      if (indexedDB && hasDatabasesFn && indexedDBWithExtras.databases) {
        const dbs = await indexedDBWithExtras.databases();
        for (const db of dbs) {
          try {
            if (db.name) indexedDB.deleteDatabase(db.name);
          } catch (error) {
            logDevWarning(`Failed to delete IndexedDB database ${db.name ?? '<unknown>'}`, error);
          }
        }
      }
    } catch (error) {
      logDevWarning('Failed to enumerate IndexedDB databases for cleanup', error);
    }
    console.log('[InitInspector] caches cleared. Reloading…');
    location.replace(`${location.pathname}?nocache=${Date.now()}`);
  };

  // Draggable position state (translate from initial bottom-right)
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const posStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const paperRef = useRef<HTMLDivElement | null>(null);

  const onMouseDownTitle = (e: React.MouseEvent) => {
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    posStartRef.current = { ...pos };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    e.preventDefault();
  };
  const onMouseMove = (e: MouseEvent) => {
    if (!dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPos({ x: posStartRef.current.x + dx, y: posStartRef.current.y + dy });
  };
  const onMouseUp = () => {
    dragStartRef.current = null;
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  };

  return (
    <Dialog
      open
      hideBackdrop
      keepMounted
      PaperProps={{
        ref: paperRef,
        sx: {
          position: 'fixed',
          right: 10,
          bottom: 10,
          transform: `translate(${pos.x}px, ${pos.y}px)`,
          border: '1px solid #e5e7eb',
          borderRadius: 2,
          boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
          minWidth: 280,
          fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          zIndex: 2147483647,
          m: 0,
        },
      }}
    >
      <DialogTitle
        onMouseDown={onMouseDownTitle}
        sx={{
          cursor: 'move',
          display: 'flex',
          alignItems: 'center',
          py: 1,
          '& .statusDot': {
            display: 'inline-block',
            width: 8,
            height: 8,
            borderRadius: '9999px',
            background: color,
            mr: 1,
          },
          '& .version': { ml: 'auto', fontSize: 11, color: '#6b7280' },
          fontSize: 12,
        }}
      >
        <span className="statusDot" />
        <strong style={{ fontSize: 12 }}>Init Inspector</strong>
        <span className="version">{state.version}</span>
      </DialogTitle>
      <DialogContent dividers sx={{ p: 1.25 }}>
        <div style={{ fontSize: 12, lineHeight: 1.5 }}>
          <div>
            Worker: {state.workerState} / hasInstance: {String(state.workerHasInstance)}
          </div>
          <div>
            Client ready: {String(state.clientReady)} / INIT_COMPLETE:{' '}
            {String(state.initCompleteFlag)}
          </div>
          <div>
            Event count: {state.channelMessageCount} / last:{' '}
            {state.lastInitEventTs ? new Date(state.lastInitEventTs).toLocaleTimeString() : '-'}
          </div>
          <div>Route: {state.route}</div>
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <button
            type="button"
            onClick={ping}
            style={{
              fontSize: 11,
              padding: '4px 8px',
              borderRadius: 6,
              border: '1px solid #d1d5db',
              background: '#f3f4f6',
            }}
          >
            Ping
          </button>
          <button
            type="button"
            onClick={forceEvent}
            style={{
              fontSize: 11,
              padding: '4px 8px',
              borderRadius: 6,
              border: '1px solid #d1d5db',
              background: '#f3f4f6',
            }}
          >
            Dispatch INIT
          </button>
          <button
            type="button"
            onClick={clearCaches}
            style={{
              fontSize: 11,
              padding: '4px 8px',
              borderRadius: 6,
              border: '1px solid #fecaca',
              background: '#fee2e2',
              color: '#b91c1c',
            }}
          >
            Clear Caches
          </button>
        </div>
        <div style={{ marginTop: 6, fontSize: 11, color: '#6b7280' }}>
          Add ?debug=init to toggle.
        </div>
      </DialogContent>
    </Dialog>
  );
};
