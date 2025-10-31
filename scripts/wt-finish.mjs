#!/usr/bin/env node
// Finish worktree by task id (T-YYYY-NNN) or branch
// Usage:
//   node scripts/wt-finish.mjs <T-YYYY-NNN|branch> [--force]

import { spawnSync } from 'node:child_process';

function die(msg) { console.error(`Error: ${msg}`); process.exit(1); }

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

function listWorktrees() {
  const r = spawnSync('git', ['worktree', 'list', '--porcelain'], { encoding: 'utf8' });
  if (r.status !== 0) die('git worktree list failed');
  const items = [];
  let entry = {};
  for (const line of r.stdout.split('\n')) {
    if (!line.trim()) { if (entry.path) items.push(entry); entry = {}; continue; }
    const [k, v] = line.split(' ', 2);
    if (k === 'worktree') entry.path = v;
    if (k === 'branch') entry.branch = v.replace(/^refs\/heads\//, '');
  }
  return items;
}

function run(cmd, args, opts={}) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

function main() {
  const args = parseArgs(process.argv);
  const key = args._[0];
  if (!key) die('Usage: wt-finish.mjs <T-YYYY-NNN|branch> [--force]');
  const force = args.force === 'true' || args.force === true || args.f === 'true';

  const items = listWorktrees();
  const target = items.find((it) => it.branch?.includes(key) || it.branch === key);
  if (!target) die(`No worktree found for '${key}'`);

  const rmArgs = ['worktree', 'remove'];
  if (force) rmArgs.push('--force');
  rmArgs.push(target.path);
  run('git', rmArgs);
}

main();

