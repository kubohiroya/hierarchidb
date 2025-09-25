# AGENTS.md — 作業ルール（必読）

## 0. 会話・ドキュメント記述に用いる言語

* ユーザーとの対話に用いる言語は、丁寧な明瞭な日本語で行うこととしてください。短縮語を使うときには事前の定義をしてください。
* ソースコード内のメッセージやインラインドキュメント、README.mdなどの記述で使用する言語は、特に指定がない限りは英語で行うこととしてください。

このリポジトリでエージェント（AI/自動化）が機能追加や不具合修正を行う際の運用ルールです。以後の作業では本ドキュメントを最優先で順守してください（ユーザー/開発者の明示指示がある場合はそれを最優先）。

## 1. 完了報告前のビルド/型検証（必須）
- 変更を加えたパッケージごとに、完了報告前に必ず以下を実行してグリーンであることを確認すること。
  - `pnpm -C <package> typecheck`
  - `pnpm -C <package> build`（ビルド定義が存在する場合）
- 変更が複数パッケージに跨る、または影響範囲が不明な場合は、ワークスペース全体での検証も行う。
  - `pnpm -w typecheck`
  - `pnpm -w build`（必要に応じて）
- 失敗があれば、原因を特定して修正し、再度すべてが通ることを確認してから完了報告すること。

## 2. 実行結果の明示
- 完了報告時は、どのコマンドをどのパッケージに対して実行し、結果がグリーンであったかを簡潔に記載すること。
- もし環境制約（サンドボックス/権限/ネットワーク）で実行できない場合は、その理由を明記し、代替の検証（局所 `tsc --noEmit` など）を行ったうえで、ユーザーに承認/実行を依頼すること。原則として「未検証のまま完了報告」は不可。

## 3. 変更単位と記録
- 小さな差分を心掛け、不要な無関連変更は避けること。
- 伴うドキュメントや型の更新も同一変更単位に含めること。

## 4. その他
- 既存の `TASKS.md` / `TASKS.csv` / `mrtask` 運用がある場合は、そちらの個別ルールを優先する（SSOT）。
- リポジトリ内の他の AGENTS.md がより深い階層に存在する場合、そのスコープ内ではそちらを優先する。
- コンテキストウィンドウの残りが15%以下になったときには、自動的に /compact を実行する。

Motto: "Small, clear, safe steps — always grounded in real docs."

## Principles

* Keep changes minimal, safe, and reversible.
* Prefer clarity over cleverness; simplicity over complexity.
* Avoid new dependencies unless necessary; remove when possible.

## Knowledge & Libraries
## Testing Notes

- **WFL (Worker-FIDB Loop)**: UI 統合テストで WorkerAPIClient を経由し、Worker 側の Fake IndexedDB (fake-indexeddb) 上で動作を検証する仕組み。従来の Worker テストと区別する用途で名称を統一。

* Use context7 (MCP server) to fetch current docs before coding.
* Call resolve-library-id, then get-library-docs to verify APls.
* If uncertain, pause and request clarification.

## Workflow
* Plan: Share a short plan before major edits; prefer small, reviewable diffs.
* Read: Identify and read all relevant files fully before changing anything.
* Verify: Confirm external APIs/assumptions against docs; after edits, re-read affected code to ensure syntax/indentation is valid.
* Implement: Keep scope tight; write modular, single-purpose files.
* Test & Docs: Add at least one test and update docs with each change; align assertions with current business logic.
* Reflect: Fix at the root cause; consider adjacent risks to prevent regressions.

## 依存管理
* ブランチ切り替えやリモート更新後は必ず `pnpm install --frozen-lockfile` または `pnpm -w install --frozen-lockfile` を実行して `pnpm-lock.yaml` と `node_modules` を同期させる。単一パッケージの変更でもルートでの再インストールを推奨する。
* ネットワーク制約が想定される環境では、事前に `pnpm fetch` でグローバルストアを温め、再同期時は `pnpm install --offline --frozen-lockfile`（または `--prefer-offline`）で差分展開して依存取得の待ち時間を抑制する。

## Code Style & Limits
* Files ≤ 300 LOC; keep modules single-purpose.
* Comments: Add a brief header at the top of every file (where, what, why). Prefer clear, simple explanations; comment non-obvious logic.
* Commenting habit: Err on the side of more comments; include rationale, assumptions, and trade-offs.
* Configuration: Centralize runtime tunables in config-py; avoid magic numbers in code and tests. Pull defaults from config when wiring dependencies.
* Simplicity: Implement exactly what's requested —no extra features.

## Collaboration & Accountability
* Escalate when requirements are ambiguous, security-sensitive, or when UX/API contracts would change.
* Tell me when you are not confident about your code, plan, or fix. Ask questions or help, when your confidence level is below 80%
* Assume that you get -4 points for wrong code and/or breaking changes. +1 point for successful changes. O point when you honestly tell me you're uncertain.
* Value correctness over speed (a wrong change costs more than a small win).
