import type { Plugin } from 'vite';
import * as fs from 'fs';
import * as path from 'path';

export function pluginServicesRegistry(opts?: { rootDir?: string }): Plugin {
  const rootDir = opts?.rootDir || path.resolve(__dirname, '..');
  const NP_DIR = path.resolve(rootDir, 'packages', 'node-type');
  const ID = 'virtual:plugin-registry-services';
  const RES = '\0' + ID + '.js';

  function readJsonSafe(p: string): any | null {
    try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return null; }
  }

  function collect(): Array<{ nodeType: string; pkgName: string; sub: string, srcPath?: string }>{
    const out: Array<{ nodeType: string; pkgName: string; sub: string, srcPath?: string }> = [];
    if (!fs.existsSync(NP_DIR)) return out;
    for (const dirent of fs.readdirSync(NP_DIR, { withFileTypes: true })) {
      if (!dirent.isDirectory() || !/-plugin$/.test(dirent.name)) continue;
      const pkgPath = path.join(NP_DIR, dirent.name, 'package.json');
      if (!fs.existsSync(pkgPath)) continue;
      const pkg = readJsonSafe(pkgPath) as any;
      const pkgName = pkg?.name as string;
      if (!pkgName) continue;
      const nodeType = (pkg?.hierarchidb?.plugin?.nodeType as string) || dirent.name.replace(/-plugin$/, '');
      const ex = pkg?.exports || {};
      const has = (k: string) => typeof ex === 'object' && !!ex[k];
      const sub = has('./services') ? '/services' : has('./database') ? '/database' : has('./shared') ? '/shared' : has('.') ? '' : '';
      // Prefer src during dev if available (ensures resolution even when dist missing)
      let srcPath: string | undefined;
      if (sub) {
        const subDir = sub.replace(/^\//, '');
        const candidate = path.join(NP_DIR, dirent.name, 'src', subDir, 'index.ts');
        if (fs.existsSync(candidate)) srcPath = candidate;
      }
      out.push({ nodeType, pkgName, sub, srcPath });
    }
    return out.sort((a,b)=> a.nodeType.localeCompare(b.nodeType));
  }

  function generate(): string {
    const list = collect();
    const debugMode = process.env.HDB_SERVICES_DEBUG_MODE || '';
    if (debugMode === 'one') {
      const first = list.find(Boolean);
      const pkgName = first?.pkgName || '@hierarchidb/basemap-plugin';
      const sub = first?.sub || '/database';
      const code = `export const pluginServices = Object.freeze({ basemap: () => import('${pkgName}${sub}') });\n`;
      try {
        const outDir = path.resolve(rootDir, 'app/.debug');
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
        fs.writeFileSync(path.join(outDir, 'plugin-registry-services.generated.js'), code, 'utf-8');
      } catch {}
      return code;
    }

    const ents = list
      .map(({ nodeType, pkgName, sub, srcPath }) => {
        if (sub) {
          return (
            `  '${nodeType}': () => import('${pkgName}${sub}')` +
            `.catch(e => { console.warn('[plugin-registry-services] Fallback to root for ${nodeType}:', _msg(e)); return import('${pkgName}')` +
            `.catch(_e2 => ({ default: {} })); }),`
          );
        }
        return `  '${nodeType}': () => Promise.resolve({ default: {} }),`;
      })
      .join('\n');
    // Emit pure JS that Rollup/Vite can parse (no TS/JSX/optional chaining)
    // NOTE: To diagnose build-import-analysis parsing issues, you can switch to a
    // minimal stub via env flag. This keeps the module syntactically trivial.
    const minimal = process.env.HDB_MINIMAL_PLUGIN_SERVICES === '1';
    const code = minimal
      ? `export const pluginServices = Object.freeze({});\n`
      : `function _msg(e){ try { return (e && e.message) || String(e); } catch(_) { return String(e); } }\nexport const pluginServices = Object.freeze({\n${ents}\n});\n`;
    try {
      const outDir = path.resolve(rootDir, 'app/.debug');
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(path.join(outDir, 'plugin-registry-services.generated.js'), code, 'utf-8');
    } catch {}
    return code;
  }

  return {
    name: 'vite-plugin-plugin-services-registry',
    enforce: 'pre',
    resolveId(id) { return id === ID ? RES : null; },
    load(id) { return id === RES ? generate() : null; },
    handleHotUpdate(ctx) {
      if (/packages\/node-type\/.*-plugin\/package\.json$/.test(ctx.file)) {
        const m = ctx.server.moduleGraph.getModuleById(RES);
        if (m) ctx.server.moduleGraph.invalidateModule(m);
        return [];
      }
    },
  };
}
