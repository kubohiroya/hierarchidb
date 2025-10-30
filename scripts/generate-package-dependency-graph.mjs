#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, relative, sep } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = dirname(__dirname);

const WORKSPACES_JSON = process.env.WORKSPACES_JSON || '/tmp/workspaces.json';
const OUTPUT_MD = process.env.OUTPUT_MD || `${repoRoot}/docs/package-dependencies.md`;

const workspaceData = JSON.parse(readFileSync(WORKSPACES_JSON, 'utf8'));

const packages = new Map();

function computeGroup(relPath) {
  const parts = relPath.split(sep);
  if (!parts.length) return 'root';
  if (parts[0] === 'app') {
    if (parts[1] === 'vite-plugins') {
      return 'app/vite-plugins';
    }
    return 'app';
  }
  if (parts[0] === 'packages') {
    if (parts.length >= 3 && parts[1] === 'ui' && parts[2] === 'treeconsole') {
      return 'packages/ui/treeconsole';
    }
    if (parts.length >= 3 && parts[1] === 'runtime' && parts[2] !== 'worker') {
      return `packages/runtime/${parts[2]}`;
    }
    if (parts.length >= 2) {
      return `packages/${parts[1]}`;
    }
    return 'packages';
  }
  if (parts[0] === 'plugins') {
    return 'plugins';
  }
  return parts[0];
}

function ensurePackage(pkg) {
  if (!packages.has(pkg.name)) {
    const relPath = relative(repoRoot, pkg.path);
    packages.set(pkg.name, {
      name: pkg.name,
      path: relPath,
      deps: new Set(),
      group: computeGroup(relPath),
    });
  }
  return packages.get(pkg.name);
}

// collect workspace package names first
for (const pkg of workspaceData) {
  if (!pkg.name || !pkg.path) continue;
  if (pkg.name === 'hierarchidb' || pkg.path === repoRoot) continue;
  ensurePackage(pkg);
}

function addWorkspaceDeps(pkgRecord, deps) {
  if (!deps) return;
  for (const [depName, details] of Object.entries(deps)) {
    if (!packages.has(depName)) continue;
    const version = details?.version ?? '';
    if (typeof version === 'string' && (version.startsWith('link:') || version.startsWith('workspace:'))) {
      pkgRecord.deps.add(depName);
    }
  }
}

for (const pkg of workspaceData) {
  if (!pkg.name || !pkg.path) continue;
  if (pkg.name === 'hierarchidb' || pkg.path === repoRoot) continue;
  const record = ensurePackage(pkg);
  addWorkspaceDeps(record, pkg.dependencies);
  addWorkspaceDeps(record, pkg.devDependencies);
  addWorkspaceDeps(record, pkg.peerDependencies);
  addWorkspaceDeps(record, pkg.optionalDependencies);
}

// build edges and detect cycles
const edges = [];
for (const record of packages.values()) {
  for (const depName of record.deps) {
    edges.push([record.name, depName]);
  }
}

const cyclePaths = [];
const tempMark = new Set();
const permMark = new Set();
const stack = [];

function visit(node) {
  if (tempMark.has(node)) {
    const cycleStart = stack.indexOf(node);
    if (cycleStart !== -1) {
      cyclePaths.push([...stack.slice(cycleStart), node]);
    }
    return;
  }
  if (permMark.has(node)) {
    return;
  }
  tempMark.add(node);
  stack.push(node);
  const deps = packages.get(node)?.deps ?? [];
  for (const dep of deps) {
    visit(dep);
  }
  stack.pop();
  tempMark.delete(node);
  permMark.add(node);
}

for (const name of packages.keys()) {
  if (!permMark.has(name)) {
    visit(name);
  }
}

const cyclesText = cyclePaths.length === 0 ? 'none' : cyclePaths.map((cycle) => cycle.join(' → ')).join('; ');

// prepare groups
const groups = new Map();
for (const record of packages.values()) {
  const group = record.group ?? 'other';
  if (!groups.has(group)) {
    groups.set(group, []);
  }
  groups.get(group).push(record);
}

const sortedGroups = Array.from(groups.entries())
  .map(([group, nodes]) => [group, nodes.sort((a, b) => a.name.localeCompare(b.name))])
  .sort((a, b) => a[0].localeCompare(b[0]));

const nodeIds = new Map();
let idx = 0;
for (const [group, nodes] of sortedGroups) {
  for (const record of nodes) {
    const nodeId = `N${idx++}`;
    nodeIds.set(record.name, nodeId);
    record.nodeId = nodeId;
  }
}

function sanitizeGroupId(label) {
  return `G_${label.replace(/[^A-Za-z0-9_]/g, '_')}`;
}

const mermaidLines = [];
mermaidLines.push('```mermaid');
mermaidLines.push('graph LR');
for (const [group, nodes] of sortedGroups) {
  const groupId = sanitizeGroupId(group);
  mermaidLines.push(`  subgraph ${groupId}["${group}"]`);
  for (const record of nodes) {
    mermaidLines.push(`    ${record.nodeId}["${record.name}"]`);
  }
  mermaidLines.push('  end');
}

const sortedEdges = edges
  .map(([from, to]) => [nodeIds.get(from), nodeIds.get(to)])
  .filter(([fromId, toId]) => fromId && toId)
  .sort(([aFrom, aTo], [bFrom, bTo]) => (aFrom === bFrom ? aTo.localeCompare(bTo) : aFrom.localeCompare(bFrom)));

for (const [fromId, toId] of sortedEdges) {
  mermaidLines.push(`  ${fromId} --> ${toId}`);
}

mermaidLines.push('```');

const headerLines = [];
headerLines.push('# Package Dependency Graph');
headerLines.push('');
headerLines.push(`Generated on: ${new Date().toISOString()}`);
headerLines.push('');
headerLines.push('- Scope: workspace internal dependencies only');
headerLines.push('- Arrows point from depender → dependency');
headerLines.push('- Groups reflect top-level folders under `packages/`, `app/`, and `plugins/`');
headerLines.push(`- Cycles detected: ${cyclesText}`);
headerLines.push('');

const content = `${headerLines.join('\n')}${mermaidLines.join('\n')}`;

writeFileSync(OUTPUT_MD, `${content}\n`, 'utf8');
