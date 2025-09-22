import type { Plugin } from 'vite';
import * as fs from 'fs';
import * as path from 'path';

type PlugPkg = {
  name?: string;
  exports?: Record<string, unknown> | string;
  hierarchidb?: { plugin?: { nodeType?: string } };
};

function readJsonSafe<T>(p: string): T | null {
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')) as T; } catch { return null; }
}

function getNodeType(pkg: PlugPkg, fallback: string): string {
  return pkg?.hierarchidb?.plugin?.nodeType || fallback.replace(/-plugin$/, '');
}

function hasSubpathExport(pkg: PlugPkg, sub: string): boolean {
  const ex = pkg?.exports;
  if (!ex) return false;
  if (typeof ex === 'string') return false;
  return typeof ex === 'object' && ex !== null && sub in ex;
}

export function pluginRegistryPlugin(opts?: { rootDir?: string }): Plugin {
  const rootDir = opts?.rootDir || path.resolve(__dirname, '..');
  const NP_DIR = path.resolve(rootDir, 'packages', 'plugins');

  const ID_UI = 'virtual:plugin-registry-ui';
  const ID_WORKER = 'virtual:plugin-registry-worker';
  const RES_UI = '\0' + ID_UI;
  const RES_WORKER = '\0' + ID_WORKER;

  function collect(): Array<{ nodeType: string; pkgName: string; hasWorker: boolean; hasUI: boolean }>{
    const out: Array<{ nodeType: string; pkgName: string; hasWorker: boolean; hasUI: boolean }> = [];
    if (!fs.existsSync(NP_DIR)) return out;
    for (const dirent of fs.readdirSync(NP_DIR, { withFileTypes: true })) {
      if (!dirent.isDirectory()) continue;
      if (!/-plugin$/.test(dirent.name)) continue;
      const pkgJsonPath = path.join(NP_DIR, dirent.name, 'package.json');
      if (!fs.existsSync(pkgJsonPath)) continue;
      const pkg = readJsonSafe<PlugPkg>(pkgJsonPath);
      if (!pkg?.name) continue;
      // Only include real UI-loadable plugins that declare hierarchidb.plugin metadata
      if (!pkg?.hierarchidb?.plugin) continue;
      const nodeType = getNodeType(pkg, dirent.name.replace(/-plugin$/, ''));
      const hasWorker = hasSubpathExport(pkg, './worker');
      const hasUI = hasSubpathExport(pkg, './ui');
      out.push({ nodeType, pkgName: pkg.name, hasWorker, hasUI });
    }
    return out.sort((a,b)=> a.nodeType.localeCompare(b.nodeType));
  }

  function genUI(): string {
    const list = collect();
    const ents = list
      .map(({ nodeType, pkgName, hasUI }) => {
        if (hasUI) {
          // Prefer '/ui' but fall back to root if resolution fails at runtime
          return `  '${nodeType}': async () => { try { return await import('${pkgName}/ui'); } catch (e) { console.warn('[plugin-registry-ui] Fallback to root for ${nodeType}:', e?.message || e); return await import('${pkgName}'); } },`;
        }
        return `  '${nodeType}': () => import('${pkgName}'),`;
      })
      .join('\n');
    // Emit pure JS (no TS "as const") so Rollup/SSR parser doesn't choke
    return `export const pluginMapUI = Object.freeze({\n${ents}\n});\n`;
  }

  function genWorker(): string {
    const list = collect();
    const ents = list
      .map(({ nodeType, pkgName, hasWorker }) => {
        if (hasWorker) return `  '${nodeType}': () => import('${pkgName}/worker'),`;
        // No worker entry — expose a no-op module to keep shape stable
        return `  '${nodeType}': async () => ({ default: {} }),`;
      })
      .join('\n');
    // Emit pure JS (no TS assertion)
    return `export const pluginMapWorker = Object.freeze({\n${ents}\n});\n`;
  }

  return {
    name: 'vite-plugin-plugin-registry',
    enforce: 'pre',
    resolveId(id) {
      if (id === ID_UI) return RES_UI;
      if (id === ID_WORKER) return RES_WORKER;
      return null;
    },
    load(id) {
      if (id === RES_UI) return genUI();
      if (id === RES_WORKER) return genWorker();
      return null;
    },
    handleHotUpdate(ctx) {
      if (/packages\/plugins\/.*-plugin\/package\.json$/.test(ctx.file)) {
        const modUI = ctx.server.moduleGraph.getModuleById(RES_UI);
        const modW = ctx.server.moduleGraph.getModuleById(RES_WORKER);
        if (modUI) ctx.server.moduleGraph.invalidateModule(modUI);
        if (modW) ctx.server.moduleGraph.invalidateModule(modW);
        return [];
      }
    },
  };
}
