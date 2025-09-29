import type { Plugin } from 'vite';
import * as fs from 'fs';
import * as path from 'path';
import { loadPluginManifestFromFile } from '../tools/plugin-manifest-loader.js';

function toPascalCase(name?: string): string {
  if (!name) return '';
  const trimmed = String(name).trim();
  if (/^[A-Z][A-Za-z0-9]*$/.test(trimmed)) return trimmed;
  const parts = trimmed
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
  return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join('');
}

function normalizeMuiName(name?: string): string | undefined {
  if (!name) return undefined;
  const map: Record<string, string> = {
    locationpin: 'LocationOn',
    location: 'LocationOn',
    mapmarker: 'Place',
    basemap: 'Public',
    project: 'AccountTree',
    spreadsheet: 'Assessment',
    resolver: 'Extension',
    styler: 'Palette',
    timeline: 'AccessTime',
  };
  const key = String(name).replace(/[^a-z0-9]/gi, '').toLowerCase();
  const val = map[key] || name;
  return toPascalCase(val);
}

export function muiIconMapPlugin(opts?: { rootDir?: string; include?: RegExp }): Plugin {
  const VIRTUAL_ID = 'virtual:mui-icon-map';
  const RESOLVED = '\0' + VIRTUAL_ID;
  const rootDir = opts?.rootDir || path.resolve(__dirname, '..');
  const include = opts?.include || /packages\/plugins\/.*-plugin\/src\/extension\/plugin-manifest\.ts$/;

  function collectIconNames(): string[] {
    const nodeTypeDir = path.resolve(rootDir, 'packages', 'plugins');
    let icons = new Set<string>();
    try {
      const entries = fs.readdirSync(nodeTypeDir, { withFileTypes: true });
      for (const ent of entries) {
        if (!ent.isDirectory() || !/-plugin$/.test(ent.name)) continue;
        const manifestPath = path.join(nodeTypeDir, ent.name, 'src', 'extension', 'plugin-manifest.ts');
        const manifest = loadPluginManifestFromFile(manifestPath, { silent: true });
        if (!manifest) continue;
        const icon = manifest.icon as Record<string, unknown> | undefined;
        const raw = (icon?.muiIconName ?? icon?.mui ?? '') as string;
        const pascal = normalizeMuiName(raw);
        if (pascal) icons.add(pascal);
      }
    } catch {
      // ignore FS errors
    }
    // Ensure commonly used icons are present
    const common = ['Folder', 'Public', 'Hexagon', 'LocationOn', 'Route', 'Assessment', 'Palette', 'Extension', 'AccountTree', 'AccessTime'];
    for (const c of common) icons.add(c);
    return Array.from(icons).sort();
  }

  function generateModule(): string {
    const names = collectIconNames();
    const imports = `import { ${names.map((n) => `${n} as ${n}Icon`).join(', ')} } from '@mui/icons-material';\n`;
    const mapEntries = names.map((n) => `'${n}': ${n}Icon`).join(', ');
    const body = `const iconMap = { ${mapEntries} };\nexport default iconMap;\n`;
    return imports + body;
  }

  return {
    name: 'vite-plugin-mui-icon-map',
    enforce: 'pre',
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED;
      return null;
    },
    load(id) {
      if (id === RESOLVED) {
        return generateModule();
      }
      return null;
    },
    handleHotUpdate(ctx) {
      // Regenerate when any plugin manifest changes
      if (include.test(ctx.file)) {
        ctx.server.moduleGraph.invalidateModule(ctx.server.moduleGraph.getModuleById(RESOLVED)!);
        return [];
      }
    },
  };
}
