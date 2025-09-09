# Contributing Guide (CI/Types Stability – Short Guide)

This repository prioritizes prebuild typecheck stability and consistent CI results. Follow these MUSTs for any package (UI, runtime-ui, node-type, features, tools).

- Types at source: package.json must set `types` and `exports.types` to `src/index.ts`.
- Public TSX return types: exported TSX must return `JSX.Element` (or `JSX.Element | null`).
- No tsconfig paths in public source: do not use `~/` or custom paths – use relative imports.
- Do not bundle React/MUI: put them in `peerDependencies` and mark them `external` in tsup.
- No `../src` deep imports across packages: import the public entry or d.ts only.
- Browser env: do not use `process.env`; use `import.meta.env` (`VITE_*`).
- Backend (Workers/Hono): use TypeScript 5 with `moduleResolution: bundler` for typecheck.
- CI hygiene: checkout PR head sha; `pnpm store prune` + `pnpm install --force`; remove `dist` and `*.tsbuildinfo` before typecheck.
- Local reproducibility: use `pnpm ci:clean`, `ci:install`, `ci:typecheck:local`, or `ci:all:local`.

Further details are duplicated in:
- `packages/ui/README.md` (UI libraries)
- `packages/runtime-ui/README.md` (app integration packages)
- `packages/node-type/README.md` (plugin system packages)

---

# Shared Batch Execution (Plugins)

This repository consolidates plugin batch execution on a shared architecture:

- Execution: use `@hierarchidb/batch` `BatchService.mapChunks` for parallel work.
- Session abstraction: extend `runtime-shared/AbstractBatchSession` and delegate pause/resume/cancel and progress updates.
- Download: use `runtime-shared/batch-processor/downloadAdapter` (`createSharedDownloadService()` for GET; `postJson()` for POST).
- Progress types: adopt `@hierarchidb/common-type` `ProgressEvent` across plugins; UI wires via injected emitter/store.
- Lane control: when external API concurrency must be capped (e.g., OSRM), gate calls with a semaphore per lane in addition to mapChunks concurrency.

Minimal template (TS):
```ts
class FooBatchSession extends AbstractBatchSession<Config, Task, void> {
  constructor(id: string, nodeId: NodeId, cfg: Config, private tasks: Task[], private sink?: (e: ProgressEvent)=>void) { super(id, nodeId, cfg); }
  protected async processBatch() {
    const batch = new BatchService();
    let completed = 0;
    await batch.mapChunks(this.tasks, async (t) => { await this.processOne(t); completed++; this.updateProgress({ total: this.tasks.length, completed, currentStage: t.stage, currentTask: t.taskId }); }, { concurrency: 4 });
  }
  protected onProgressUpdate() { const p = this.getProgress(); this.sink?.({ sessionId: this['sessionId'] as any, stage: p.currentStage||'processing', total: p.total, completed: p.completed, failed: p.failed, percentage: Math.round(p.percentage), currentTask: p.currentTask||'' }); }
}
```
## Task Management
- Tasks are managed with mrtask (this is the single source of truth).
- Do not edit PLAN.md or TASKS.md; use `mrtask add|done|cancel|list` instead.
- Preferred flow: one task = one branch = one git worktree created by `mrtask add`.
- Bulk import: provide `TASKS.csv` with headers `branch,slug,description,dir1,dir2,...` and use `mrtask add -t TASKS.csv:<lineNo>`.
