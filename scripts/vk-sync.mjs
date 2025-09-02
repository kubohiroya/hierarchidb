#!/usr/bin/env node
// Sync tasks from markdown docs (vk:task header) to vibe-kanban
// - HTTP mode: POST to VIBE_KANBAN_URL (/api/tasks) with VIBE_KANBAN_TOKEN
// - Filesystem fallback: write JSON to .vibe-kanban/tasks

import { promises as fs } from 'node:fs';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';

function parseArgs(argv) {
  const args = { dirs: [] };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dir' || a === '-d') {
      args.dirs.push(argv[++i]);
    } else if (a.startsWith('--')) {
      const [k, v] = a.includes('=') ? a.split(/=(.*)/, 2) : [a, argv[i + 1]?.startsWith('--') ? 'true' : argv[++i]];
      args[k.slice(2)] = v ?? 'true';
    } else {
      args.dirs.push(a);
    }
  }
  return args;
}

function slugify(s) {
  return String(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64);
}

function mapPriority(p) {
  if (!p) return 'normal';
  const k = String(p).toUpperCase();
  if (k === 'P0') return 'high';
  if (k === 'P1') return 'high';
  if (k === 'P2') return 'normal';
  if (k === 'P3') return 'low';
  return ['high', 'normal', 'low'].includes(p) ? p : 'normal';
}

function mapStatus(s) {
  if (!s) return 'todo';
  const k = String(s).toLowerCase();
  if (k === 'planning' || k === 'todo') return 'todo';
  if (k === 'in_progress' || k === 'doing') return 'in_progress';
  if (k === 'done' || k === 'completed') return 'done';
  return 'todo';
}

async function readFileSafe(p) {
  try { return await fs.readFile(p, 'utf8'); } catch { return ''; }
}

function extractHeader(line) {
  // Example: vk:task id=wc-spec-sync status=planning priority=P1 labels=worker,working-copy,docs
  if (!line.startsWith('vk:task')) return null;
  const out = {};
  const parts = line.replace(/^vk:task\s*/, '').split(/\s+/);
  for (const part of parts) {
    const m = part.match(/^(\w+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

function extractTitle(md, fallback) {
  const m = md.match(/^#\s+(.+)$/m);
  if (m) return m[1].trim();
  return fallback || 'Untitled Task';
}

function extractDescription(md) {
  // Take first ~400 chars after the header line(s)
  const body = md.replace(/^vk:.*$/gm, '').trim();
  const text = body.replace(/```[\s\S]*?```/g, '').replace(/<[^>]*>/g, '');
  return text.slice(0, 400).trim();
}

async function collectTasksFromDir(dir) {
  const abs = resolve(dir);
  const entries = await fs.readdir(abs, { withFileTypes: true });
  const tasks = [];
  for (const e of entries) {
    if (!e.isFile() || !e.name.endsWith('.md')) continue;
    const path = join(abs, e.name);
    const md = await readFileSafe(path);
    const firstLine = md.split(/\r?\n/, 2)[0] || '';
    if (!firstLine.startsWith('vk:task')) continue;
    const header = extractHeader(firstLine);
    const title = extractTitle(md, basename(e.name, '.md').replace(/[-_]/g, ' '));
    const description = extractDescription(md);
    const id = header.id || slugify(title);
    const labels = (header.labels || '').split(',').map((s) => s.trim()).filter(Boolean);
    const task = {
      id,
      title,
      description,
      labels,
      priority: mapPriority(header.priority),
      status: mapStatus(header.status),
      source: `vk-sync:${dir}`,
      path,
    };
    tasks.push(task);
  }
  return tasks;
}

async function postTaskHTTP(task) {
  const url = process.env.VIBE_KANBAN_URL || process.env.VK_URL || '';
  const token = process.env.VIBE_KANBAN_TOKEN || process.env.VK_TOKEN || '';
  if (!url) return false;
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
    return true;
  } catch (e) {
    console.warn(`HTTP post failed for ${task.id}: ${e?.message || e}`);
    return false;
  }
}

function writeTaskFS(task) {
  const outDir = resolve('.vibe-kanban', 'tasks');
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', 'Z');
  const fname = `${ts}_${slugify(task.title)}.json`;
  const fpath = join(outDir, fname);
  writeFileSync(fpath, JSON.stringify({
    title: task.title,
    description: task.description,
    labels: task.labels,
    priority: task.priority,
    createdAt: new Date().toISOString(),
    source: 'vk-sync',
    id: task.id,
    status: task.status,
  }, null, 2));
  console.log(`vk-sync: wrote ${fpath}`);
}

async function main() {
  const args = parseArgs(process.argv);
  const dirs = args.dirs.length ? args.dirs : ['packages/runtime-worker/worker/docs'];
  let all = [];
  for (const d of dirs) {
    const tasks = await collectTasksFromDir(d);
    all = all.concat(tasks);
  }
  if (!all.length) {
    console.log('vk-sync: no tasks found');
    return;
  }
  const useHTTP = Boolean(process.env.VIBE_KANBAN_URL || process.env.VK_URL);
  if (useHTTP) console.log(`vk-sync: HTTP mode to ${process.env.VIBE_KANBAN_URL || process.env.VK_URL}`);
  for (const t of all) {
    const ok = useHTTP ? await postTaskHTTP(t) : false;
    if (!ok) writeTaskFS(t);
  }
  console.log(`vk-sync: processed ${all.length} tasks from ${dirs.join(', ')}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

