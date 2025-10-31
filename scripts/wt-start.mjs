#!/usr/bin/env node
// Auto worktree start: minimal human input
// Usage:
//   node scripts/wt-start.mjs <repo-dir> [--type feat|fix|refactor|chore|docs] [--base origin/main] [--wt-base ../wt-<repo>]
// Example:
//   node scripts/wt-start.mjs packages/runtime-worker --type feat

import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';

function die(msg) {
  console.error(`Error: ${msg}`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [k, v] = a.includes('=') ? a.split(/=(.*)/, 2) : [a, argv[i + 1]?.startsWith('--') ? 'true' : argv[++i]];
      args[k.slice(2)] = v ?? 'true';
    } else {
      args._.push(a);
    }
  }
  return args;
}

function repoRoot() {
  const r = spawnSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' });
  if (r.status !== 0) die('Not inside a git repository');
  return r.stdout.trim();
}

function repoName(root) {
  return root.split('/').filter(Boolean).slice(-1)[0];
}

function readPkgName(dir) {
  const pkgJson = join(dir, 'package.json');
  if (!existsSync(pkgJson)) return null;
  try {
    const j = JSON.parse(readFileSync(pkgJson, 'utf8'));
    return typeof j.name === 'string' ? j.name : null;
  } catch {
    return null;
  }
}

function collectExistingIds() {
  const ids = new Set();
  const ref = spawnSync('git', ['for-each-ref', '--format=%(refname:short)', 'refs/heads', 'refs/remotes'], { encoding: 'utf8' });
  if (ref.status === 0) {
    const re = /T-(\d{4})-(\d{3})/g;
    for (const line of ref.stdout.split('\n')) {
      let m;
      while ((m = re.exec(line))) ids.add(`T-${m[1]}-${m[2]}`);
    }
  }
  try {
    const tasks = readFileSync('TASKS.md', 'utf8');
    const re = /T-(\d{4})-(\d{3})/g;
    let m;
    while ((m = re.exec(tasks))) ids.add(`T-${m[1]}-${m[2]}`);
  } catch {}
  return Array.from(ids);
}

function nextId(existing) {
  const year = new Date().getFullYear();
  const re = new RegExp(`^T-${year}-(\\d{3})$`);
  let max = 0;
  for (const id of existing) {
    const m = id.match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  const n = (max + 1).toString().padStart(3, '0');
  return `T-${year}-${n}`;
}

function sanitizePathPart(s) {
  return String(s).replace(/[^A-Za-z0-9._/-]+/g, '-');
}

function makeBranch(type, pkgOrMulti, id) {
  const scopePath = pkgOrMulti.startsWith('@') ? pkgOrMulti.slice(1) : pkgOrMulti;
  return `${type}/${sanitizePathPart(scopePath)}__${id}`;
}

function defaultBaseBranch() {
  for (const r of [ ['show-ref','--verify','--quiet','refs/remotes/origin/main','origin/main'], ['show-ref','--verify','--quiet','refs/heads/main','main'], ['show-ref','--verify','--quiet','refs/heads/master','master'] ]) {
    const chk = spawnSync('git', r.slice(0, -1), { encoding: 'utf8' });
    if (chk.status === 0) return r[r.length - 1];
  }
  return 'HEAD';
}

function run(cmd, args, opts={}) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

async function main() {
  const args = parseArgs(process.argv);
  const repoDir = args._[0];
  if (!repoDir) die('Usage: wt-start.mjs <repo-dir> [--type feat] [--base origin/main] [--wt-base ../wt-<repo>]');

  const type = (args.type || 'feat').toString();
  const base = (args.base || defaultBaseBranch()).toString();
  const root = repoRoot();
  const name = readPkgName(repoDir);

  if (!existsSync(repoDir)) die(`Directory not found: ${repoDir}`);
  if (!name) console.warn(`[wt] Warning: ${repoDir}/package.json not found or has no name; branch scope will use directory path.`);

  const existing = collectExistingIds();
  const id = nextId(existing);
  const scope = name || repoDir.replace(/^\.\/?/, '');
  const branch = makeBranch(type, name ? name : scope, id);

  const wtBase = (args['wt-base'] || `../wt-${repoName(root)}`).toString();
  // Delegate to wt.sh for actual add; it will place under <wt-base>/<repoDir>/<branch>
  const sh = join(root, 'scripts', 'wt.sh');
  run('bash', [sh, 'start', repoDir, branch, '--base', base, '--wt-base', wtBase], { cwd: root });
  console.log(`[wt] id: ${id}`);
  console.log(`[wt] branch: ${branch}`);
}

main();

