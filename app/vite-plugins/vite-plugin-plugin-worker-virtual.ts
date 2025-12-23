import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';
import { pluginRegistry } from '../../packages/plugin-registry/generated/registry.ts';

type WorkerEntryPaths = {
  src?: string;
  dist?: string;
};

const PLUGIN_SPEC_REGEX = /^@hierarchidb\/plugins\/([^/]+)\/(worker|dist\/worker\/index\.js)$/;

export function pluginWorkerVirtualModule(): Plugin {
  const entries = new Map<string, WorkerEntryPaths>();
  let command: 'serve' | 'build' | 'ssr' = 'serve';
  let rootDir = '';

  const resolveWorkerEntry = (nodeType: string): string | null => {
    const record = entries.get(nodeType);
    if (!record) return null;
    if (command === 'build') {
      return record.dist ?? record.src ?? null;
    }
    return record.src ?? record.dist ?? null;
  };

  const refreshEntries = () => {
    entries.clear();
    const repoRoot = path.resolve(rootDir, '..');

    const ensureEntryForNodeType = (nodeType: string, candidateDirs: string[]) => {
      let srcPath: string | undefined;
      let distPath: string | undefined;
      for (const dir of candidateDirs) {
        const workerSrc = path.join(dir, 'src', 'worker', 'index.ts');
        if (!srcPath && fs.existsSync(workerSrc)) {
          srcPath = workerSrc;
        }
        const workerDist = path.join(dir, 'dist', 'worker', 'index.js');
        if (!distPath && fs.existsSync(workerDist)) {
          distPath = workerDist;
        }
        if (srcPath && distPath) break;
      }
      if (srcPath || distPath) {
        entries.set(nodeType, { src: srcPath, dist: distPath });
      }
    };

    for (const entry of pluginRegistry) {
      const nodeType = entry.nodeType;
      const packageName = entry.packageName ?? '';
      const inferredDirNames = new Set<string>();
      inferredDirNames.add(`${nodeType}-plugin`);
      if (packageName.startsWith('@hierarchidb/')) {
        inferredDirNames.add(packageName.replace('@hierarchidb/', ''));
      }

      const candidateDirs = Array.from(inferredDirNames, (dir) =>
        path.join(repoRoot, 'plugins', dir)
      );
      ensureEntryForNodeType(nodeType, candidateDirs);
    }
  };

  return {
    name: 'hierarchidb-plugin-worker-virtual',
    enforce: 'pre',
    configResolved(resolved) {
      command = resolved.command;
      rootDir = resolved.root;
      refreshEntries();
    },
    resolveId(source) {
      const match = PLUGIN_SPEC_REGEX.exec(source);
      if (!match) {
        return null;
      }
      const nodeType = match[1];
      if (!nodeType) {
        return null;
      }
      const entryPath = resolveWorkerEntry(nodeType);
      if (!entryPath) {
        this.warn(
          `[plugin-worker-virtual] Unable to resolve worker module for "${nodeType}". Ensure the plugin is built (expected dist at plugins/${nodeType}-plugin/dist/worker/index.js).`
        );
        return null;
      }
      return entryPath;
    },
  };
}
