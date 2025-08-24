import * as path from 'path';
import * as fs from 'fs';
import { Plugin } from 'vite';

/**
 * Vite plugin to resolve tilde (~/) imports for packages
 */
export function tildeResolver(): Plugin {
  return {
    name: 'tilde-resolver',
    resolveId(source: string, importer?: string) {
      // Handle tilde imports
      if (source.startsWith('~/')) {
        // Skip if no importer
        if (!importer) return null;

        // Determine which package the import is from
        const normalizedImporter = path.normalize(importer);

        // Worker package
        if (normalizedImporter.includes('/worker/src/')) {
          const workerRoot = path.resolve(__dirname, '../worker/src');
          let resolved = path.resolve(workerRoot, source.slice(2));

          // Check if it's a directory and append openstreetmap-type.ts if needed
          try {
            const stat = fs.statSync(resolved);
            if (stat.isDirectory()) {
              const indexPath = path.join(resolved, 'openstreetmap-type.ts');
              if (fs.existsSync(indexPath)) {
                resolved = indexPath;
              }
            }
          } catch (e) {
            // Try adding .ts extension
            if (!resolved.endsWith('.ts') && !resolved.endsWith('.tsx')) {
              if (fs.existsSync(resolved + '.ts')) {
                resolved = resolved + '.ts';
              } else if (fs.existsSync(resolved + '.tsx')) {
                resolved = resolved + '.tsx';
              }
            }
          }

          return resolved;
        }

        // TreeConsole base package
        if (normalizedImporter.includes('/ui/treeconsole/base/src/')) {
          const treeConsoleRoot = path.resolve(__dirname, '../ui/treeconsole/base/src');
          let resolved = path.resolve(treeConsoleRoot, source.slice(2));

          // Check if it's a directory and append openstreetmap-type.ts if needed
          try {
            const stat = fs.statSync(resolved);
            if (stat.isDirectory()) {
              const indexPath = path.join(resolved, 'openstreetmap-type.ts');
              if (fs.existsSync(indexPath)) {
                resolved = indexPath;
              }
            }
          } catch (e) {
            // Try adding .ts extension
            if (!resolved.endsWith('.ts') && !resolved.endsWith('.tsx')) {
              if (fs.existsSync(resolved + '.ts')) {
                resolved = resolved + '.ts';
              } else if (fs.existsSync(resolved + '.tsx')) {
                resolved = resolved + '.tsx';
              }
            }
          }

          return resolved;
        }

        // TreeConsole other packages
        const treeConsoleMatch = normalizedImporter.match(/\/ui\/treeconsole\/([^/]+)\/src\//);
        if (treeConsoleMatch) {
          const packageName = treeConsoleMatch[1];
          const packageRoot = path.resolve(__dirname, `../ui/treeconsole/${packageName}/src`);
          const resolved = path.resolve(packageRoot, source.slice(2));
          return resolved;
        }

        // Other UI packages
        const uiMatch = normalizedImporter.match(/\/ui\/([^/]+)\/src\//);
        if (uiMatch) {
          const packageName = uiMatch[1];
          const packageRoot = path.resolve(__dirname, `../ui/${packageName}/src`);
          const resolved = path.resolve(packageRoot, source.slice(2));
          return resolved;
        }

        // Plugin packages
        const pluginMatch = normalizedImporter.match(/\/plugins\/([^/]+)\/src\//);
        if (pluginMatch) {
          const packageName = pluginMatch[1];
          const packageRoot = path.resolve(__dirname, `../plugins/${packageName}/src`);
          const resolved = path.resolve(packageRoot, source.slice(2));
          return resolved;
        }

        // App package (default)
        if (normalizedImporter.includes('/_app/src/')) {
          const appRoot = path.resolve(__dirname, './src');
          const resolved = path.resolve(appRoot, source.slice(2));
          return resolved;
        }
      }

      return null;
    },
  };
}
