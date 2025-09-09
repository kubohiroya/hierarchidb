import React, { useEffect, useMemo, useState } from 'react';

type Status = 'unknown' | 'starting' | 'ready' | 'error';

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

  useEffect(() => {
    let mounted = true;
    const update = async () => {
      try {
        const mod = await import('../WorkerAPIClient');
        const initMod = await import('../client');
        const clientReady = mod.WorkerAPIClient.isReady();
        const hasInstance = !!mod['WorkerAPIClient'] && (mod as any)['WorkerAPIClient']['getRawWorkerInstance']?.() != null;
        const workerState = (mod as any)['WorkerAPIClient']?.['state'] ?? 'unknown';
        const initCompleteFlag = typeof (initMod as any)?.isWorkerInitCompleted === 'function' ? Boolean((initMod as any).isWorkerInitCompleted()) : false;
        if (!mounted) return;
        setState(s => ({
          ...s,
          clientReady,
          workerHasInstance: hasInstance,
          // state is private; mirror via isReady/hasInstance into coarse state
          workerState: clientReady ? 'initialized' : (hasInstance ? 'initializing' : 'uninitialized'),
          initCompleteFlag,
          route: location.pathname + location.search,
        }));
      } catch {
      }
    };
    update();
    const id = window.setInterval(update, 400);
    const onEvt = () => setState(s => ({
      ...s,
      lastInitEventTs: Date.now(),
      channelMessageCount: s.channelMessageCount + 1,
    }));
    try {
      window.addEventListener('hierarchidb-worker-init-complete', onEvt as any);
    } catch {
    }
    return () => {
      mounted = false;
      window.clearInterval(id);
      try {
        window.removeEventListener('hierarchidb-worker-init-complete', onEvt as any);
      } catch {
      }
      ;
    };
  }, []);

  const badge: Status = useMemo(() => {
    if (state.clientReady) return 'ready';
    if (state.workerHasInstance || state.initCompleteFlag) return 'starting';
    return 'unknown';
  }, [state.clientReady, state.workerHasInstance, state.initCompleteFlag]);

  const color = badge === 'ready' ? '#16a34a' : badge === 'starting' ? '#f59e0b' : '#6b7280';

  const forceEvent = () => {
    try {
      window.dispatchEvent(new Event('hierarchidb-worker-init-complete'));
    } catch {
    }
  };

  const ping = async () => {
    const { WorkerAPIClient } = await import('../WorkerAPIClient');
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
    } catch {
    }
    try {
      sessionStorage.clear();
    } catch {
    }
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
    } catch {
    }
    try {
      // Some browsers expose indexedDB.databases() as a function; feature-detect safely
      const hasDatabasesFn = typeof (indexedDB as any)?.databases === 'function';
      if (indexedDB && hasDatabasesFn) {
        const dbs = await (indexedDB as any).databases();
        for (const db of dbs) {
          try {
            if (db.name) indexedDB.deleteDatabase(db.name);
          } catch {
          }
        }
      }
    } catch {
    }
    console.log('[InitInspector] caches cleared. Reloading…');
    location.replace(location.pathname + '?nocache=' + Date.now());
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: 10,
      right: 10,
      zIndex: 2147483647,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    }}>
      <div style={{
        background: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
        padding: 10,
        minWidth: 280,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
          <span style={{
            display: 'inline-block',
            width: 8,
            height: 8,
            borderRadius: 9999,
            background: color,
            marginRight: 8,
          }} />
          <strong style={{ fontSize: 12 }}>Init Inspector</strong>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: '#6b7280' }}>{state.version}</span>
        </div>
        <div style={{ fontSize: 12, lineHeight: 1.5 }}>
          <div>Worker: {state.workerState} / hasInstance: {String(state.workerHasInstance)}</div>
          <div>Client ready: {String(state.clientReady)} / INIT_COMPLETE: {String(state.initCompleteFlag)}</div>
          <div>Event count: {state.channelMessageCount} /
            last: {state.lastInitEventTs ? new Date(state.lastInitEventTs).toLocaleTimeString() : '-'}</div>
          <div>Route: {state.route}</div>
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <button onClick={ping} style={{
            fontSize: 11,
            padding: '4px 8px',
            borderRadius: 6,
            border: '1px solid #d1d5db',
            background: '#f3f4f6',
          }}>Ping
          </button>
          <button onClick={forceEvent} style={{
            fontSize: 11,
            padding: '4px 8px',
            borderRadius: 6,
            border: '1px solid #d1d5db',
            background: '#f3f4f6',
          }}>Dispatch INIT
          </button>
          <button onClick={clearCaches} style={{
            fontSize: 11,
            padding: '4px 8px',
            borderRadius: 6,
            border: '1px solid #fecaca',
            background: '#fee2e2',
            color: '#b91c1c',
          }}>Clear Caches
          </button>
        </div>
        <div style={{ marginTop: 6, fontSize: 11, color: '#6b7280' }}>Add ?debug=init to toggle.</div>
      </div>
    </div>
  );
};
