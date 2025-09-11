# Repository Guidelines

## Project Structure & Module Organization
- Monorepo managed by pnpm/turbo. Key roots:
  - `app/` runtime UI app
  - `packages/` feature, UI, worker, and node-type plugins
  - `packages/runtime-worker/worker/` worker-side platform
  - `packages/node-type/*-plugin/` plugin packages (e.g., shape, route, location)
  - `e2e/`, `docs/`, `.turbo/`, and config files at repo root
- Source lives in `src/`; compiled output goes to `dist/` (tsup). Tests sit alongside code as `*.test.ts(x)`.

## Build, Test, and Development Commands
- Install: `pnpm i`
- Build all: `pnpm -w build` (tsup per package)
- Typecheck all: `pnpm -w typecheck` (tsc, dist-only imports enforced)
- Test (root, coverage): `pnpm -w vitest run --coverage`
- Test a single package (recommended): `pnpm -C packages/node-type/shape-plugin test:run`
- Storybook (if applicable): `pnpm -C app storybook`

## Coding Style & Naming Conventions
- Language: TypeScript (strict). Prefer explicit types.
- Formatting/Lint: Prettier config at root; ESLint present; keep imports ordered. Indent 2 spaces.
- Import policy: use public entrypoints (dist-only). Avoid deep imports like `@…/pkg/src/*`. Example: `import { useBatchProgress } from '@hierarchidb/ui-core'` (✅) not `@hierarchidb/ui-core/src/*` (❌).
- DB naming: use `getDBName('kebab-suffix')`; do not hardcode database names.
- Filenames: kebab-case for files, PascalCase for React components.

## Testing Guidelines
- Framework: Vitest (+ jsdom). Many packages pin `pool: 'threads', max/minThreads: 1` to avoid sandbox issues—run tests per package when possible.
- Test names: `*.test.ts` or `*.test.tsx`; colocate near source.
- Coverage: collected via root vitest config; no hard threshold enforced unless specified in package.

## Commit & Pull Request Guidelines
- Commits: short, imperative subject; include scope when helpful (e.g., `shape-plugin: fix unified batch adapter`). Reference issues like `#123`.
- PRs: clear description, rationale, screenshots/logs for UI/worker changes, and checklists for build, typecheck, tests. Link related issues and note any migration or config impacts.

## Architecture & Agent Tips
- Batch orchestration uses “adapters” to prefer runtime-worker; avoid adding new direct WorkerPool usages.
- When adding paths or aliases, keep dist-only resolution in `tsconfig.base.json` and per-package tsconfig/vitest configs.
- Prefer adding new shared logic under `packages/runtime-shared/*` or `packages/util/` over duplicating code in plugins.

---

## mrtask 運用ポリシー（タスク管理 / Git worktree）

本リポジトリでは、タスク管理の単一情報源（SSOT）として `mrtask` を使用します。`TASKS.md` は参照のみとし、既存タスクは `TASKS.csv` をもとに段階的に `mrtask` へ移行します。

- 基本原則
  - SSOT: `.mrtask/*.yml`（`mrtask add|list|pr|done|cancel` で管理）。
  - ブランチ命名: `<type>/<scope>/<slug>`（例: `feat/worker/envelope-v1`）。
  - 対象ディレクトリ: 原則パッケージ単位（`app`, `packages/**`）。複数パッケージ横断は複数 `dir` 指定、プロジェクトルートを含めてもよい。
  - まず `--dry-run` で YAML/差分/操作内容を必ず目視確認する。

- 代表コマンド（`npx` 推奨）
  - `npx mrtask add -t TASKS.csv:<lineNo>`（CSV行から作成）
  - `npx mrtask add <branch> <slug> <dir...> -d "desc" --sparse`（明示引数）
  - `npx mrtask list`
  - `npx mrtask pr <id> --dry-run` → 問題なければ `--push --draft --open`
  - `npx mrtask done <id>` / `npx mrtask cancel <id>`

- ガード/検証
  - 作成直後、作業用 worktree で `pnpm run guards:pre-commit` を実行。
  - PR 前に `typecheck/test/lint` を通す（必要に応じて対象パッケージに限定）。

- サンドボックス/権限について
  - `mrtask add` は `git branch/worktree` の書き込みを行うため、CI/サンドボックス環境では拒否される場合があります（例: `.git/refs/heads/*` 書き込み不可）。その場合はローカルで実行するか、明示的な承認付きで実行します。

- 失敗時の取り扱い
  - 異常があれば `mrtask cancel <id>`（痕跡保持）または `mrtask remove <id>`（完全削除）。
  - 手動復旧: `git worktree remove <path>` と `git branch -D <name>`。

- 移行フロー（既存 `TASKS.csv` から）
  1) `pnpm run task:add -- -t TASKS.csv:<行番号> --dry-run` で出力確認。
  2) 問題なければ `--dry-run` を外して実行し、YAML と worktree を生成。
  3) guards/ビルド/テスト→ `mrtask pr`（必要なら `--push --draft --open`）。
  4) マージ後に `mrtask done <id>` で安全クリーンアップ。

- 使い勝手フィードバック/改善提案（継続）
  - `add --from-csv --dry-run` で git 操作を完全抑止する挙動の明確化。
  - upstream 設定コマンドの安定化（`git branch <new> <start-point>` への統一）。
  - `dirs` の存在検証と `--sparse` の自動化（列挙パターンから生成）。
  - これらの提案は運用中に観測した事実をもとに随時更新する。
