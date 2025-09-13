import type { Plugin, ViteDevServer } from 'vite';
import * as fs from 'fs';
import * as path from 'path';

export type DevHealthStatus = {
  lockfilePath: string | null;
  lockfileMtime: number | null;
  nodeModulesMarker: string | null;
  nodeModulesMtime: number | null;
  needsInstall: boolean;
  missingDeps: string[];
  checkedAt: string;
  gitBranch: string | null;
  repoUrl: string | null;
  serverStartMs: number;
};

const VIRTUAL_ID = 'virtual:dev-health';
const RESOLVED_ID = '\u0000dev-health';

function statMtime(p?: string | null): number | null {
  if (!p) return null;
  try {
    const st = fs.statSync(p);
    return st.mtimeMs;
  } catch {
    return null;
  }
}

function readJSON<T = any>(p: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8')) as T;
  } catch {
    return null;
  }
}

function resolveUpwards(startDir: string, ...segments: string[]): string | null {
  let cur = startDir;
  for (let i = 0; i < 5; i++) {
    const p = path.resolve(cur, ...segments);
    if (fs.existsSync(p)) return p;
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  return null;
}

function resolveGitDir(root: string): string | null {
  const gitEntry = resolveUpwards(root, '.git');
  if (!gitEntry) return null;
  try {
    const st = fs.statSync(gitEntry);
    if (st.isDirectory()) return gitEntry;
    // worktree: .git is a file containing "gitdir: <path>"
    const content = fs.readFileSync(gitEntry, 'utf-8');
    const m = content.match(/gitdir:\s*(.*)\s*/i);
    if (!m || !m[1]) return null;
    const gitdir = (m[1] as string).trim();
    return path.isAbsolute(gitdir)
      ? gitdir
      : path.resolve(path.dirname(gitEntry), gitdir as string);
  } catch {
    return null;
  }
}

function readGitBranchAndUrl(root: string): { branch: string | null; url: string | null } {
  const gitDir = resolveGitDir(root);
  if (!gitDir) return { branch: null, url: null };
  let branch: string | null = null;
  let url: string | null = null;
    const headPath = path.resolve(gitDir, 'HEAD');
    const head = fs.readFileSync(headPath, 'utf-8').trim();
    const refMatch = head.match(/^ref:\s*(.*)$/);
    if (refMatch && refMatch[1]) {
      const ref = refMatch[1] as string;
      const last = ref.split('/').pop();
      branch = (last ?? '').length > 0 ? (last as string) : null;
    } else if (/^[0-9a-fA-F]{7,40}$/.test(head)) {
      branch = `detached@${head.slice(0, 7)}`;
    }
    const cfgPath = path.resolve(gitDir, 'config');
    const cfg = fs.readFileSync(cfgPath, 'utf-8');
    // naive INI scan: find [remote "origin"] block and read url
    const lines = cfg.split(/\r?\n/);
    let inOrigin = false;
    for (const line of lines) {
      const sec = line.match(/^\s*\[(.+)]/);
      if (sec && typeof sec[1] === 'string') {
        inOrigin = /remote\s+"origin"/i.test(sec[1] as string);
        continue;
      }
      if (inOrigin) {
        const m = line.match(/^\s*url\s*=\s*(.+)\s*$/i);
        if (m && m[1]) {
          url = (m[1] as string).trim();
          break;
        }
      }
    }

  return { branch, url };
}

function normalizeIgnore(ignore?: Array<string | RegExp>): RegExp[] {
  if (!ignore || ignore.length === 0) return [];
  return ignore.map((it) => (typeof it === 'string' ? new RegExp('^' + it.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') : it));
}

function detectMissingDeps(root: string, includeDevDeps: boolean, ignore?: Array<string | RegExp>): string[] {
  const pkgPath = path.resolve(root, 'package.json');
  const pkg = readJSON<{ dependencies?: Record<string, string>; devDependencies?: Record<string, string> }>(pkgPath) || {};
  const all = new Set<string>([
    ...Object.keys(pkg.dependencies || {}),
    ...(includeDevDeps ? Object.keys(pkg.devDependencies || {}) : []),
  ]);
  const missing: string[] = [];
  const ignoreMatchers = normalizeIgnore(ignore);
  for (const dep of all) {
    if (ignoreMatchers.some((re) => re.test(dep))) continue;
    const spec = (pkg.dependencies?.[dep] || pkg.devDependencies?.[dep] || '').toString();
    if (spec.startsWith('workspace:')) continue; // ignore workspace protocol to reduce noise
    try {
      // Prefer resolving package.json to avoid failures when main points to unbuilt dist
      require.resolve(`${dep}/package.json`, { paths: [root, path.resolve(root, '..')] });
    } catch {
      try {
        // Fallback to module entry
        require.resolve(dep, { paths: [root, path.resolve(root, '..')] });
      } catch {
        missing.push(dep);
      }
    }
  }
  return missing;
}

export type DevHealthOptions = { includeDevDeps?: boolean; ignore?: Array<string | RegExp> };

const SERVER_START_MS = Date.now();

export function devHealthPlugin(options: DevHealthOptions = {}): Plugin {
  const includeDevDeps = !!options.includeDevDeps;
  const ignoreList = options.ignore || [];
  let server: ViteDevServer | null = null;
  let root = process.cwd();
  let cached: DevHealthStatus | null = null;

  const compute = (): DevHealthStatus => {
    const lockfilePath =
      resolveUpwards(root, 'pnpm-lock.yaml') ||
      resolveUpwards(root, 'yarn.lock') ||
      resolveUpwards(root, 'package-lock.json');
    const nodeModulesMarker =
      resolveUpwards(root, 'node_modules/.modules.yaml') ||
      resolveUpwards(root, 'node_modules/.pnpm') ||
      resolveUpwards(root, 'node_modules');

    const lockfileMtime = statMtime(lockfilePath);
    const nodeModulesMtime = statMtime(nodeModulesMarker);

    const missingDeps = detectMissingDeps(root, includeDevDeps, ignoreList);
    const git = readGitBranchAndUrl(root);

    const needsInstall = !!(
      lockfileMtime && nodeModulesMtime && lockfileMtime > nodeModulesMtime + 1
    );

    return (cached = {
      lockfilePath,
      lockfileMtime: lockfileMtime ?? null,
      nodeModulesMarker,
      nodeModulesMtime: nodeModulesMtime ?? null,
      needsInstall: needsInstall || missingDeps.length > 0,
      missingDeps,
      checkedAt: new Date().toISOString(),
      gitBranch: git.branch ?? null,
      repoUrl: git.url ?? null,
      serverStartMs: SERVER_START_MS,
    });
  };

  const sendUpdate = () => {
    if (!server) return;
    const payload = compute();
    const mod = server.moduleGraph.getModuleById(RESOLVED_ID);
    if (mod) server.moduleGraph.invalidateModule(mod);
    server.ws.send({ type: 'custom', event: 'dev-health:update', data: payload });
  };

  return {
    name: '@hierarchidb/tools-vite-plugin-dev-health',
    apply: 'serve',
    configResolved(cfg) {
      root = cfg.root;
      compute();
    },
    configureServer(s) {
      server = s;
      const lock =
        resolveUpwards(root, 'pnpm-lock.yaml') ||
        resolveUpwards(root, 'yarn.lock') ||
        resolveUpwards(root, 'package-lock.json');
      const modulesYaml = resolveUpwards(root, 'node_modules/.modules.yaml');
      const appPkg = path.resolve(root, 'package.json');
      const watchList = [lock, modulesYaml, appPkg].filter(Boolean) as string[];
      if (watchList.length) server.watcher.add(watchList);
      server.watcher.on('change', (file) => {
        if (watchList.some((w) => file.endsWith(w))) sendUpdate();
      });
    },
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID;
      return null;
    },
    load(id) {
      if (id !== RESOLVED_ID) return null;
      const payload = cached ?? compute();
      return `export const status = ${JSON.stringify(payload)}; export default status;`;
    },
  };
}

export default devHealthPlugin;
