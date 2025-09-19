// Dev-only: surface Vite build errors and dependency drift
if (import.meta.env.DEV && typeof window !== 'undefined') {
  import('./version.js');
  let banner: HTMLDivElement | null = null;
  let errorActive = false;
  let lastBuildLocal = '';
  (async () => {
    const mod = await import('./version.js');
    const buildTime = typeof mod.BUILD_TIME === 'string' ? mod.BUILD_TIME : undefined;
    if (buildTime) lastBuildLocal = new Date(buildTime).toLocaleString();
  })();
  type OverlayOpts = {
    position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | { x: number; y: number };
    storageKey?: string;
    draggable?: boolean;
  };
  const opts: OverlayOpts = {
    position: window.__DEV_HEALTH_OVERLAY__?.position ?? 'bottom-right',
    storageKey: window.__DEV_HEALTH_OVERLAY__?.storageKey ?? 'dev-health-banner-pos',
    draggable: window.__DEV_HEALTH_OVERLAY__?.draggable ?? true,
  };

  const ensureBanner = () => {
    if (banner) return banner;
    banner = document.createElement('div');
    banner.id = 'dev-health-banner';
    banner.style.cssText = [
      'position:fixed',
      // position is applied below based on saved/opts
      'z-index:2147483647',
      'padding:8px 12px',
      'border-radius:6px',
      'font:12px/1.4 system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Arial, sans-serif',
      'background:#212529',
      'color:#fff',
      'box-shadow:0 2px 12px rgba(0,0,0,0.35)',
      'display:none',
      'max-width: min(420px, 90vw)',
      opts.draggable ? 'cursor:grab' : '',
      'user-select:none',
    ].filter(Boolean).join(';');
    document.body.appendChild(banner);

    // Apply initial position (saved > opts)
    const saved = localStorage.getItem(opts.storageKey!);
    if (saved) {
      const { x, y } = JSON.parse(saved) as { x: number; y: number };
      banner.style.left = `${Math.max(0, x)}px`;
      banner.style.top = `${Math.max(0, y)}px`;
    } else {
      // Apply from option keyword or coordinates
      const pad = 8;
      const applyCorner = (corner: string) => {
        banner!.style.removeProperty('left');
        banner!.style.removeProperty('top');
        banner!.style.removeProperty('right');
        banner!.style.removeProperty('bottom');
        switch (corner) {
          case 'top-left':
            banner!.style.left = `${pad}px`;
            banner!.style.top = `${pad}px`;
            break;
          case 'top-right':
            banner!.style.right = `${pad}px`;
            banner!.style.top = `${pad}px`;
            break;
          case 'bottom-left':
            banner!.style.left = `${pad}px`;
            banner!.style.bottom = `${pad}px`;
            break;
          case 'bottom-right':
          default:
            banner!.style.right = `${pad}px`;
            banner!.style.bottom = `${pad}px`;
            break;
        }
      };
      if (typeof opts.position === 'string') {
        applyCorner(opts.position);
      } else if (opts.position && typeof opts.position === 'object') {
        banner.style.left = `${Math.max(0, opts.position.x)}px`;
        banner.style.top = `${Math.max(0, opts.position.y)}px`;
      } else {
        applyCorner('bottom-right');
      }
    }

    if (opts.draggable) {
      let dragging = false;
      let startX = 0;
      let startY = 0;
      let startLeft = 0;
      let startTop = 0;
      const getPoint = (ev: MouseEvent | TouchEvent): { clientX: number; clientY: number } | null => {
        if ('touches' in ev) {
          const t = ev.touches?.[0] || (ev as TouchEvent).changedTouches?.[0];
          return t ? { clientX: t.clientX, clientY: t.clientY } : null;
        }
        const m = ev as MouseEvent;
        return { clientX: m.clientX, clientY: m.clientY };
      };
      const onDown = (ev: MouseEvent | TouchEvent) => {
        dragging = true;
        banner!.style.cursor = 'grabbing';
        const point = getPoint(ev);
        if (!point) return;
        startX = point.clientX;
        startY = point.clientY;
        // Convert any corner-based position to left/top for free drag
        const rect = banner!.getBoundingClientRect();
        startLeft = rect.left;
        startTop = rect.top;
        banner!.style.left = `${startLeft}px`;
        banner!.style.top = `${startTop}px`;
        banner!.style.removeProperty('right');
        banner!.style.removeProperty('bottom');
        ev.preventDefault();
      };
      const onMove = (ev: MouseEvent | TouchEvent) => {
        if (!dragging) return;
        const point = getPoint(ev);
        if (!point) return;
        const dx = point.clientX - startX;
        const dy = point.clientY - startY;
        const nextLeft = Math.max(0, startLeft + dx);
        const nextTop = Math.max(0, startTop + dy);
        banner!.style.left = `${nextLeft}px`;
        banner!.style.top = `${nextTop}px`;
      };
      const onUp = () => {
        if (!dragging) return;
        dragging = false;
        banner!.style.cursor = 'grab';
        // persist
        const rect = banner!.getBoundingClientRect();
        const data = { x: Math.round(rect.left), y: Math.round(rect.top) };
        localStorage.setItem(opts.storageKey!, JSON.stringify(data));
      };
      banner.addEventListener('mousedown', onDown, { passive: false });
      banner.addEventListener('touchstart', onDown, { passive: false });
      window.addEventListener('mousemove', onMove, { passive: true });
      window.addEventListener('touchmove', onMove, { passive: true });
      window.addEventListener('mouseup', onUp, { passive: true });
      window.addEventListener('touchend', onUp, { passive: true });
    }
    return banner;
  };

  const show = (msg: string) => {
    const el = ensureBanner();
    el.textContent = msg;
    el.style.display = 'block';
  };
  const showHtml = (html: string) => {
    const el = ensureBanner();
    el.innerHTML = html;
    el.style.display = 'block';
  };
  const hide = () => {
    if (banner && !errorActive) banner.style.display = 'none';
  };

  const fmtTime = (ms: number | null) => (ms ? new Date(ms).toLocaleTimeString() : 'n/a');

  // 1) Listen to Vite HMR error/success to signal stale runtime
  // @ts-ignore — Vite HMR event typings are not public
  import.meta.hot?.on('vite:error', (e: any) => {
    errorActive = true;
    console.error('[dev-health] Vite build error — HMR stalled', e);
    const labelStyle = 'color:#FFD166;font-weight:600';
    const valueStyle = 'color:#B2F5EA';
    const buildPart = lastBuildLocal
      ? ` <span style="${labelStyle}">Build:</span> <span style="${valueStyle}">${lastBuildLocal}</span>`
      : '';
    showHtml(`<span>HMR stalled due to build error. See console.</span>${buildPart}`);
  });
  // @ts-ignore
  import.meta.hot?.on('vite:afterUpdate', () => {
    errorActive = false;
    hide();
  });

  // 2) Watch dependency health via virtual module + custom event
  const updateFromStatus = (status: any) => {
    const needsInstall = !!status?.needsInstall;
    const missing = Array.isArray(status?.missingDeps) ? status.missingDeps : [];
    const lock = fmtTime(status?.lockfileMtime ?? null);
    const mods = fmtTime(status?.nodeModulesMtime ?? null);
    const branch = status?.gitBranch ? String(status.gitBranch) : '';
    const repoUrl = status?.repoUrl ? String(status.repoUrl) : '';
    const serverStartMs: number = typeof status?.serverStartMs === 'number' ? status.serverStartMs : 0;
    const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] as string));
    const labelStyle = 'color:#FFD166;font-weight:600';
    const valueStyle = 'color:#B2F5EA';
    const kv = (k: string, v: string) => `<span style="${labelStyle}">${esc(k)}</span> <span style="${valueStyle}">${esc(v)}</span>`;
    const repoInfo = branch || repoUrl
      ? ` ${kv('Repo:', `${branch || 'unknown'}`)} ${repoUrl ? kv('URL:', repoUrl) : ''}.`
      : '';
    const buildPart = lastBuildLocal ? ` ${kv('Build:', lastBuildLocal)}.` : '';

    const mustRestart = (status?.lockfileMtime ?? 0) > serverStartMs;
    if (needsInstall || missing.length > 0 || mustRestart) {
      const head = needsInstall ? 'Dependency drift detected' : 'Missing dependencies detected';
      const tip = 'Run: pnpm i';
      const restart = mustRestart ? ` ${kv('Action:', 'Restart dev server')}.` : '';
      const miss = missing.length ? ` Missing: ${esc(missing.slice(0, 4).join(', '))}${missing.length > 4 ? '…' : ''}.` : '';
      const html = [
        `<span>${esc(head)}.</span>`,
        kv('Lockfile:', lock),
        kv('node_modules:', mods) + '.',
        `<span>${esc(tip)}.</span>`,
        miss,
        restart,
        repoInfo,
        buildPart,
      ].filter(Boolean).join(' ');
      // Strong warning styling when restart is required
      if (mustRestart && banner) {
        banner.style.background = '#8B0000';
      }
      showHtml(html);
      if (missing.length > 0) console.error('[dev-health] Missing deps:', missing);
      if (branch || repoUrl) console.info('[dev-health] Repo:', { branch: branch || null, repoUrl: repoUrl || null });
    } else if (!errorActive) {
      hide();
    }
  };

  // initial import
  // @ts-expect-error: virtual module is provided by Vite plugin in dev
  import('virtual:dev-health')
    .then((m: any) => updateFromStatus(m?.default ?? m?.status))
    .catch(() => {});

  // push updates from server
  // @ts-ignore
  import.meta.hot?.on('dev-health:update', (payload: any) => updateFromStatus(payload));
}
