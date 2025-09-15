import type { Plugin } from 'vite';
import * as fs from 'fs';
import * as path from 'path';

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
  const include = opts?.include || /packages\/node-type\/.*-plugin\/package\.json$/;

  function collectIconNames(): string[] {
    const nodeTypeDir = path.resolve(rootDir, 'packages', 'node-type');
    let icons = new Set<string>();
    try {
      const entries = fs.readdirSync(nodeTypeDir, { withFileTypes: true });
      for (const ent of entries) {
        if (!ent.isDirectory() || !/-plugin$/.test(ent.name)) continue;
        const pkgPath = path.join(nodeTypeDir, ent.name, 'package.json');
        if (!fs.existsSync(pkgPath)) continue;
        const txt = fs.readFileSync(pkgPath, 'utf-8');
        try {
          const json = JSON.parse(txt) as any;
          const icon = json?.hierarchidb?.plugin?.icon || {};
          const raw = icon.muiIconName || icon.mui || '';
          const pascal = normalizeMuiName(raw);
          if (pascal) icons.add(pascal);
        } catch {
          // ignore malformed package.json
        }
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
      // Regenerate when any plugin package.json changes
      if (include.test(ctx.file)) {
        ctx.server.moduleGraph.invalidateModule(ctx.server.moduleGraph.getModuleById(RESOLVED)!);
        return [];
      }
    },
  };
}
