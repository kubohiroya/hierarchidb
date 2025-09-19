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
  };
  const key = String(name).replace(/[^a-z0-9]/gi, '').toLowerCase();
  return map[key] || name;
}

export function muiIconsVirtualModule(): Plugin {
  const VIRTUAL_ID = 'virtual:mui-icon-map';
  const RESOLVED_ID = '\0' + VIRTUAL_ID;
  const logWarn = (message: string, error: unknown): void => {
    console.warn('[mui-icon-map]', message, error);
  };

  return {
    name: 'hdb-mui-icons-virtual',
    enforce: 'pre',
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID;
      return undefined;
    },
    load(id) {
      if (id !== RESOLVED_ID) return undefined;

      // Scan node-type plugin package.json files for hierarchidb.plugin.icon.mui
      const repoRoot = path.resolve(__dirname, '..');
      const nodeTypeDir = path.join(repoRoot, 'packages', 'node-type');
      const names = new Set<string>();
      try {
        const entries = fs.readdirSync(nodeTypeDir, { withFileTypes: true });
        for (const ent of entries) {
          if (!ent.isDirectory()) continue;
          const pkgJsonPath = path.join(nodeTypeDir, ent.name, 'package.json');
          if (!fs.existsSync(pkgJsonPath)) continue;
          try {
            const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8')) as NodeTypePackageJson;
            const muiRaw = pkg.hierarchidb?.plugin?.icon?.mui;
            const norm = normalizeMuiName(muiRaw);
            const pascal = toPascalCase(norm);
            if (pascal) names.add(pascal);
          } catch (error) {
            logWarn(`Failed to read icon metadata from ${pkgJsonPath}`, error);
          }
        }
      } catch (error) {
        logWarn(`Failed to scan node-type directory ${nodeTypeDir}`, error);
      }

      // Always include a minimal baseline we know we use widely
      ['Folder', 'Public', 'Hexagon', 'LocationOn', 'Route', 'Assessment', 'Palette', 'Extension', 'AccountTree']
        .forEach((n) => names.add(n));

      // Generate static imports map
      const imports: string[] = [];
      const entries: string[] = [];
      Array.from(names).sort().forEach((n, idx) => {
        const local = `I${idx}`;
        imports.push(`import { ${n} as ${local} } from '@mui/icons-material';`);
        entries.push(`  ${JSON.stringify(n)}: ${local}`);
      });

      const code = `// Auto-generated virtual module of MUI icons used by HierarchiDB (JS only)
${imports.join('\n')}
const iconMap = {
${entries.join(',\n')}
};
export { iconMap };
export default iconMap;
`;
      return code;
    },
  };
}

type NodeTypePackageJson = {
  hierarchidb?: {
    plugin?: {
      icon?: {
        mui?: string;
      };
    };
  };
};
