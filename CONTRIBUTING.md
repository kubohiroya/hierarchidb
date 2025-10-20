# Contributing Guide (CI/Types Stability – Short Guide)

This repository prioritizes prebuild typecheck stability and consistent CI results. Follow these MUSTs for any package (UI, runtime-ui, node-type, features, tools).

- Types at source: package.json must set `types` and `exports.types` to `src/RuntimeWorkerService.ts`.
- Public TSX return types: exported TSX must return `JSX.Element` (or `JSX.Element | null`).
- No tsconfig paths in public source: do not use `~/` or custom paths – use relative imports.
- `@hierarchidb/*` のパス解決は `tsconfig.base.json` に集約済みです。各パッケージやアプリ側で `dist/` を指す paths を追加しないでください。
- Do not bundle React/MUI: put them in `peerDependencies` and mark them `external` in tsup.
- No `../src` deep imports across packages: import the public entry or d.ts only.
- Browser env: do not use `process.env`; use `import.meta.env` (`VITE_*`).
- Backend (Workers/Hono): use TypeScript 5 with `moduleResolution: bundler` for typecheck.
- CI hygiene: checkout PR head sha; `pnpm store prune` + `pnpm install --force`; remove `dist` and `*.tsbuildinfo` before typecheck.
- Local reproducibility: use `pnpm ci:clean`, `ci:install`, `ci:typecheck:local`, or `ci:all:local`.

Further details are duplicated in:
- `packages/ui/README.md` (UI libraries)
- `packages/runtime-ui/README.md` (app integration packages)
- `packages/plugins/README.md` (plugin system packages)

## File / Export Naming

### 基本ルール
- ディレクトリ名・パッケージ名は従来どおり kebab-case を維持し、ファイル名だけ CamelCase（UpperCamel / lowerCamel）へ統一します。
- 原則「1 ファイル = 1 主要 export」。公開クラス・関数・型などの主要 export 名とファイル名は完全一致させ（大文字・小文字含む）、常に CamelCase で揃えます。
  - クラスや interface など UpperCamelCase の識別子は、同じ綴りのファイル名（例: `LocationEntitiesDB.ts` ↔ `export class LocationEntitiesDB {}`）にします。
  - 先頭小文字の関数・フック・ファクトリは lowerCamelCase で統一し、ファイル名も同じ綴りにします（例: `createLocationGroupStoreDexie.ts` ↔ `export function createLocationGroupStoreDexie()`).
- ドット区切りやスネークケースを混在させたファイル名（`locationGroupStore.dexie.ts` など）は不可。必要な語句は CamelCase に織り込みます。
- 例外は `RuntimeWorkerService.ts` / `index.tsx` のみ。バレル export が必要な場合は index ファイルで明示し、その他のファイルは単一 export に揃えます。

### 例外と補足
- ユーティリティ集は `fooBarUtil.ts` のように lowerCamelCase で命名し、同名の関数が存在しなくても構いません。ただしファイルの責務はファイル名に沿って最小限に保ちます。
- 複数 export が不可避な場合は、TASKS.md や PR 説明で理由と主要 export を明確化し、命名の衝突を避けます。可能であればファイル分割を優先し、どうしても束ねる場合は static class などで意図を明示します。
- Plain オブジェクト（`export const Foo = { … }`）による命名空間化はアクセス制御ができず規約から外れるため原則禁止です。必要になった場合はレビューで合意を得てください。

### 型公開ファイルについて
- 型定義のみを提供するファイルも CamelCase 命名を維持し、公開する主要 type alias / interface 名と一致させます（例: `ProjectEntityTypes.ts` ↔ `export type ProjectEntityTypes = …`).
- 抽象的な `plugin-definition.ts` のような名前は避け、内容が変わっても耐えられる固有名（`ProjectEntityContract.ts` など）を付けてください。
- パッケージ公開時は `package.json` の `types` が指す `dist/index.d.ts` を単一エントリとし、型専用モジュールを追加する場合もビルド結果に取り込まれるよう tsup/tsconfig を調整します。

### ツールによる整合性チェック
命名規約の維持には ts-node + ts-morph ベースのスクリプトを利用してください。

#### レポート生成（Phase 1）
- `pnpm ts-node --esm scripts/naming/report-export-alignment.ts --verbose` を実行すると、ファイル名と主要 export 名の不整合を解析し `reports/naming/export-alignment-phase1.json` を更新します。
  - `--out <path>` で出力先を変更できます。
  - `--include-tests` でテスト・Story を含める/除外することができます。
- レポートの `classification` 欄（`case-mismatch` や `no-matching-export` など）をレビューし、リネーム候補を策定した上で `reports/naming/export-alignment-plan.json` に反映します。

#### リネーム適用（Phase 2）
- `reports/naming/export-alignment-plan.json` に `from` / `to` のペアを列挙し、必要に応じて `--filter <regex>` で対象を絞り込みます。
- Dry-run: `pnpm ts-node --esm scripts/naming/apply-export-alignment.ts --plan reports/naming/export-alignment-plan.json`
  - 参照している import/export の更新内容を一覧化し、実行前に確認できます。
- 実行: `pnpm ts-node --esm scripts/naming/apply-export-alignment.ts --plan reports/naming/export-alignment-plan.json --apply`
  - ts-morph がファイルリネームと相対 import の `.js` 拡張子更新を自動で行います。
  - Case-only リネームにも対応していますが、終了後に `git status` と `pnpm typecheck` を必ず確認してください。
- スクリプトは再実行可能なため、部分的な適用→レビュー→残タスク整理のループを安全に回せます。

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
