#!/usr/bin/env node
// Minimal task creator for vibe-kanban.
// Works in two modes:
// 1) HTTP: POST to VIBE_KANBAN_URL (/api/tasks) with optional VIBE_KANBAN_TOKEN
// 2) Filesystem fallback: write JSON to .vibe-kanban/tasks/

/*
Usage examples:
  node scripts/vk-task.mjs --title "Group repo changes into commits" \
    --description "Inspect changes, group by work type, and commit sequentially with messages." \
    --labels repo,git,automation --priority high

  node scripts/vk-task.mjs --preset grouped-commits
*/

import { mkdirSync, writeFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [k, v] = a.includes('=') ? a.split(/=(.*)/, 2) : [a, argv[i + 1]?.startsWith('--') ? 'true' : argv[++i]];
      args[k.slice(2)] = v ?? 'true';
    } else if (!args._) {
      args._ = [a];
    } else {
      args._.push(a);
    }
  }
  return args;
}

function slugify(s) {
  return String(s)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function nowISO() {
  return new Date().toISOString();
}

const PRESETS = {
  'grouped-commits': {
    title: 'Group repo changes and create sequential commits',
    description: [
      '- Inspect current working tree changes',
      '- Group diffs by work type (refactor, move, docs, new plugin-loader)',
      '- Create ordered commits with Conventional Commit messages',
      '- Verify build/tests; adjust messages if needed',
    ].join('\n'),
    labels: ['repo', 'git', 'automation'],
    priority: 'high',
  },
};

async function main() {
  const args = parseArgs(process.argv);

  const preset = args.preset && PRESETS[args.preset];
  const title = args.title || preset?.title;
  const description = args.description || preset?.description || '';
  const labels = (args.labels || preset?.labels || '')
    .toString()
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const priority = (args.priority || preset?.priority || 'normal').toString();
  const project = (args.project || '').toString() || undefined;
  const assignee = (args.assignee || args.assign || '').toString() || undefined;

  if (!title) {
    console.error('Error: --title is required (or use --preset grouped-commits)');
    process.exit(1);
  }

  const task = {
    title,
    description,
    labels,
    priority,
    project,
    assignee,
    createdAt: nowISO(),
    source: 'hierarchidb/vk-task',
  };

  const url = process.env.VIBE_KANBAN_URL || process.env.VK_URL || '';
  const token = process.env.VIBE_KANBAN_TOKEN || process.env.VK_TOKEN || '';

  if (url) {
    try {
      const r = await fetch(String(url).replace(/\/$/, '') + '/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(task),
      });
      if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
      const data = await r.json().catch(() => ({}));
      console.log(`vibe-kanban: task created via HTTP: ${data.id || '(no id returned)'}`);
      return;
    } catch (e) {
      console.warn(`HTTP mode failed (${e?.message || e}); falling back to filesystem.`);
    }
  }

  // Filesystem fallback
  const outDir = join(process.cwd(), '.vibe-kanban', 'tasks');
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }
  const ts = new Date()
    .toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .replace('Z', 'Z');
  const fname = `${ts}_${slugify(title) || 'task'}.json`;
  const fpath = join(outDir, fname);
  writeFileSync(fpath, JSON.stringify(task, null, 2));
  console.log(`vibe-kanban: task written to ${fpath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

