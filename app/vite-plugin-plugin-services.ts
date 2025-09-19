import type { Plugin } from 'vite';
import * as fs from 'fs';
import * as path from 'path';
import {
  discoverNodeTypePlugins,
  pickPreferredServiceSubpath,
} from '@hierarchidb/tools-plugin-registry-utils';

export function pluginServicesRegistry(opts?: { rootDir?: string }): Plugin {
  const rootDir = opts?.rootDir || path.resolve(__dirname, '..');
  const ID = 'virtual:plugin-registry-services';
  const RES = '\0' + ID + '.js';

  const logPluginWarn = (message: string, error: unknown): void => {
    console.warn(`[vite-plugin-plugin-services] ${message}`, error);
  };

  const toImportSuffix = (exportKey: string): string => {
    if (exportKey === '.') return '';
    return `/${exportKey.replace(/^\.\//, '')}`;
  };

  function collect(): Array<{ nodeType: string; pkgName: string; sub: string }> {
    const plugins = discoverNodeTypePlugins({ rootDir });
    return plugins
      .map((info) => {
        const preferred = pickPreferredServiceSubpath(info);
        const sub = preferred ? toImportSuffix(preferred.exportKey) : '';
        return { nodeType: info.nodeType, pkgName: info.packageName, sub };
      })
      .sort((a, b) => a.nodeType.localeCompare(b.nodeType));
  }

  function generate(): string {
    const list = collect();
    const debugMode = process.env.HDB_SERVICES_DEBUG_MODE || '';
    if (debugMode === 'one') {
      const first = list.find(Boolean);
      const pkgName = first?.pkgName || '@hierarchidb/node-type-basemap-plugin';
      const sub = first?.sub || '/database';
      const code = `export const pluginServices = Object.freeze({ basemap: () => import('${pkgName}${sub}') });\n`;
      try {
        const outDir = path.resolve(rootDir, 'app/.debug');
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
        fs.writeFileSync(path.join(outDir, 'plugin-registry-services.generated.js'), code, 'utf-8');
      } catch (error) {
        logPluginWarn('Failed to write debug plugin services registry', error);
      }
      return code;
    }

    const ents = list
      .map(({ nodeType, pkgName, sub }) => {
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
    } catch (error) {
      logPluginWarn('Failed to write plugin registry snapshot', error);
    }
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
