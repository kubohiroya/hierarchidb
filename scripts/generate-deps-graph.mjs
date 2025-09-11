#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SOURCES = ['packages', 'app'];

function* walk(dir) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return;
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(p);
    } else if (entry.name === 'package.json') {
      yield p;
    }
  }
}

const pkgs = [];
for (const src of SOURCES) for (const pkgPath of walk(src)) {
  const dir = path.dirname(pkgPath);
  const json = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  if (!json.name) continue;
  pkgs.push({ name: json.name, dir, json });
}

const names = new Set(pkgs.map(p => p.name));

const groupOf = (dir) => {
  const parts = dir.split(path.sep);
  if (parts[0] === 'packages') return parts[1] || 'packages';
  return parts[0]; // 'app', etc.
};

const nodes = new Map();
const edges = []; // [from, to]
for (const p of pkgs) {
  nodes.set(p.name, { group: groupOf(p.dir), dir: p.dir });
  const deps = { ...(p.json.dependencies || {}), ...(p.json.peerDependencies || {}), ...(p.json.optionalDependencies || {}) };
  for (const d of Object.keys(deps)) {
    if (names.has(d)) edges.push([p.name, d]);
  }
}

// Build adjacency for SCC detection
const adj = new Map();
for (const n of nodes.keys()) adj.set(n, []);
for (const [u,v] of edges) adj.get(u).push(v);

// Tarjan SCC
let index = 0;
const indices = new Map();
const lowlink = new Map();
const onstack = new Map();
const stack = [];
const sccs = [];

function strongconnect(v){
  indices.set(v, index);
  lowlink.set(v, index);
  index++;
  stack.push(v);
  onstack.set(v, true);
  for(const w of adj.get(v)){
    if(!indices.has(w)){
      strongconnect(w);
      lowlink.set(v, Math.min(lowlink.get(v), lowlink.get(w)));
    } else if (onstack.get(w)){
      lowlink.set(v, Math.min(lowlink.get(v), indices.get(w)));
    }
  }
  if(lowlink.get(v) === indices.get(v)){
    const comp=[];
    while(true){
      const w = stack.pop();
      onstack.set(w,false);
      comp.push(w);
      if(w===v) break;
    }
    sccs.push(comp);
  }
}
for(const v of nodes.keys()) if(!indices.has(v)) strongconnect(v);

const cyclicNodes = new Set();
for (const comp of sccs) {
  if (comp.length > 1) comp.forEach(n => cyclicNodes.add(n));
  if (comp.length === 1) {
    const n = comp[0];
    if (adj.get(n).includes(n)) cyclicNodes.add(n);
  }
}

// Assign IDs for Mermaid
const idOf = new Map();
let i=0; for (const n of nodes.keys()) idOf.set(n, `N${i++}`);

// Grouping
const groups = new Map();
for (const [name, meta] of nodes) {
  const g = meta.group;
  if (!groups.has(g)) groups.set(g, []);
  groups.get(g).push(name);
}

const header = [
  '# Package Dependency Graph',
  '',
  `Generated on: ${new Date().toISOString()}`,
  '',
  '- Scope: workspace internal dependencies only',
  '- Arrows point from depender → dependency',
  '- Groups reflect top-level folders under `packages/` and `app/`',
  cyclicNodes.size ? `- Cycles detected: ${cyclicNodes.size} node(s) across ${sccs.filter(c=>c.length>1).length} SCC(s)` : '- Cycles detected: none',
  '',
  '```mermaid',
  'graph LR',
  '  %% Node classes for highlighting',
  '  classDef cyclic fill:#ffe5e5,stroke:#ff4d4f,stroke-width:2px;',
  '  classDef app fill:#e6f7ff,stroke:#1890ff,stroke-width:1px;',
  '  classDef appdep fill:#fff7e6,stroke:#fa8c16,stroke-width:1px;',
  '  classDef plugin fill:#f6ffed,stroke:#52c41a,stroke-width:2px;',
];

const body = [];
// Subgraphs
for (const [g, namesArr] of groups) {
  body.push(`  subgraph ${g}`);
  for (const n of namesArr) {
    const id = idOf.get(n);
    const label = n.replaceAll('"','\\"');
    body.push(`    ${id}["${label}"]`);
  }
  body.push('  end');
}
// Edges
for (const [u,v] of edges) body.push(`  ${idOf.get(u)} --> ${idOf.get(v)}`);
// Classes
for (const n of cyclicNodes) body.push(`  class ${idOf.get(n)} cyclic;`);
for (const [n, meta] of nodes) if (meta.group === 'app') body.push(`  class ${idOf.get(n)} app;`);

// Highlight direct dependencies of app packages
const appNames = [...nodes.entries()].filter(([,meta])=>meta.group==='app').map(([n])=>n);
const appDeps = new Set();
for (const [u,v] of edges) if (appNames.includes(u)) appDeps.add(v);
// Detect plugin packages (*-plugin)
const pluginNames = new Set([...nodes.keys()].filter(n => /-plugin$/.test(n)));
// Apply classes: plugin wins over appdep to avoid conflicting fills
for (const n of pluginNames) body.push(`  class ${idOf.get(n)} plugin;`);
for (const n of appDeps) if (!appNames.includes(n) && !pluginNames.has(n)) body.push(`  class ${idOf.get(n)} appdep;`);

const footer = ['```', '', '## Notes', '- Cyclic nodes are highlighted in red.', '- The app package is highlighted in blue, its direct dependencies in orange, and *-plugin packages in green.'];

const md = [...header, ...body, ...footer].join('\n');
fs.mkdirSync(path.join(ROOT,'docs'), { recursive: true });
fs.writeFileSync(path.join(ROOT,'docs','package-dependencies.md'), md);
console.log('Wrote docs/package-dependencies.md');
