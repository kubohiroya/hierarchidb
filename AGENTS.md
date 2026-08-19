## Primary Directive

- Think in English, interact with the user in Japanese.
- コードコメントと英語版ドキュメントは英語で記述する。

## このファイルの運用

- 会話で繰り返し発生した指示は本ファイルに反映する。
- 常に圧縮・明確化を優先し、重複記述を残さない。
- 不具合報告では必ず「原因 / 発生範囲 / 修正方法 / 適用範囲」を示す。

## 仕様書の更新ルール（必須）

- 実装上の判断（設計変更・仕様の解釈確定・矛盾解消）が会話またはコードで確定したら、対応する `docs/` 配下の仕様書を**同じタイミングで**更新する。
- 仕様書の更新を後回しにすることを禁止する。「あとで直す」は仕様書と実装の乖離を生む。
- 仕様書に矛盾を発見した場合は、実装に着手する前にユーザーに報告し、仕様書を修正してから実装する。

## 高優先ルール（非交渉）

- 契約違反の隠蔽を禁止する（高優先）。
- 禁止: 丸め・clamp・デフォルト補完・互換フォールバック・曖昧な受け入れ分岐で処理継続。
- 必須: 契約違反は即時にエラー化し、失敗を可視化する。
- 例（progress）: `finite number` かつ `0..100` 以外はバグとして扱う。
- 例外: データ保全・セキュリティ・重大可用性の緊急回避で一時措置が必要な場合のみ、事前のユーザー承認と GitHub Issue への記録を必須とする。
- ユーザーの明示指示なしに後方互換や保険実装を追加しない。

## タスク管理（SSOT）

- SSOT は GitHub Issues + Project。
- ローカル Markdown のタスク台帳は作成・更新しない。進捗、阻害要因、検証結果、ロールバック情報は対象 Issue と Project に記録する。
- 詳細ルールは `docs/task-management.md`、Issue本文は `docs/templates/task-issue-template.md`。

## GitHub GraphQL / Project API の利用効率（必須）

- GitHub Project v2 の query / mutation は、複数 agent で作業する場合も root agent が集約する。サブエージェントは明示的に委譲された場合を除き、Project の一覧取得、field discovery、item追加、Status更新を実行しない。
- 通常運用で Project 全itemを走査しない。`gh project item-list ... --limit 1000`、同等の全件pagination、同じProject schemaの反復取得を禁止する。
- 1件または少数のIssueを扱う場合は、Issue番号を起点に `issue.projectItems(first: 10)` で対象itemだけを取得する。少数の既知Issueをまとめる場合はalias付きqueryでbatchし、Project全体の列挙へ切り替えない。
- Project ID、Status field ID、option ID、item IDは同一作業中に再利用する。Project schemaは未取得または変更を確認した場合だけ1回取得し、各Issueごとに再取得しない。
- Issue / PR / Actions等、RESTまたはGitHub connectorで取得できる情報にGraphQLを使わない。GraphQLはProject v2固有のfield/item操作に限定する。
- `--jq`や取得後のlocal filterはresponseを絞るだけで、GraphQLのquery costを削減しない。query側のfield、`first`、対象Issueを最小化する。
- Project操作の前にRESTの`rate_limit`でGraphQL残量とreset時刻を確認する。`remaining <= 500`では新規のschema discoveryや列挙を停止し、既知IDに対する当該タスク必須操作だけに絞る。`remaining <= 100`ではProject GraphQL操作を停止し、reset後に再開する。
- GraphQL残量の監視にGraphQLをpollingしない。別token、別account、ブラウザ操作、別経路への切替でrate limitを迂回しない。枯渇時はreset時刻とblocked理由を報告する。

## 実装着手ゲート（順番固定）

1. **仕様書・設計書の確認（必須）**: 対象コンポーネント・機能に関連する `docs/` 配下の仕様書・設計書を必ず読む。仕様書が存在するにもかかわらず参照せずに実装・修正を行うことを禁止する。仕様書と実装の乖離を発見した場合は、修正前にユーザーに報告する。
2. DoD を提示し、ユーザー承認を得る。
3. `gh issue create` で Issue を起票。
4. Issue を Project に追加し `Status=In Progress` を設定。
5. ブランチ作成（`<type>/<scope>/<slug>`）。
6. ここまで完了後に、コード編集・検証コマンドを開始する。

## 起票失敗時の扱い

- `gh` 認証/権限/ネットワーク問題で起票不能なら `blocked` 扱いで停止。
- コード変更は行わず、失敗コマンド・エラー要約・解除条件を報告。
- 既存 Issue が更新可能なら阻害要因と解除条件をコメントする。Project に `Blocked` があれば設定し、なければ `In Progress` のまま Issue 上で blocked を明示する。GitHub へ記録できない場合はローカル台帳へフォールバックせず、ユーザーへ報告して停止する。

## 禁止事項

- 仕様書・設計書を参照せずに実装・修正を行うこと（`docs/` 配下に関連文書が存在する場合）。
- 仕様書と実装の乖離をユーザーに報告せずに放置・隠蔽すること。
- Issue 未起票の実装・修正・コミット。
- Issue番号なし PR 作成。
- ローカル Markdown によるタスク台帳の作成・運用。
- `src` 配下への `*.js` / `*.js.map` 生成（出力先は `dist` のみ）。
- non-null assertion（`!`）の使用。
- 互換目的の型混在・フォールバック分岐。
- Git操作でのエディタ待機（Kiro環境では別画面で見えないため）。
- `react-i18next` の直接 import（`@hierarchidb/ui-i18n` 経由を必須とする。例外: `packages/ui/i18n` 内部の re-export 元のみ）。

## Git操作ルール（Kiro環境対応）

- 必須: `git merge --no-edit` または `git merge -m "message"` を使用。
- 必須: `git commit -m "message"` を使用（メッセージ未指定禁止）。
- 禁止: エディタ起動を伴うGit操作（`git merge`, `git commit`, `git rebase -i` 等のメッセージ未指定）。
- 理由: Kiro環境ではエディタが別画面で開かれ、ユーザーに見えずUI混乱を招く。

## shapeビルドのSSOT原則（非交渉）

- shapeビルドセッションの状態は **SSOT状態木（jotai atomツリー）を唯一の真実の源** とする。
- SSOT状態木はブラウザのメモリ上にタブごとに1つだけ存在し、nodeIdごとに1セッションしか存在しない。
- 禁止: React state / ref / モジュールスコープ変数でビルドセッション状態を二重管理すること。
- 禁止: 「複数インスタンスが競合するかもしれない」という誤った前提に基づく過剰設計（例: activePipelines Set、activePipelineRuns Map）。
- 許容: JSランタイムハンドル（AbortController等）はシリアライズ不可のため、SSOT状態木の対応エントリ（PauseState等）に直接フィールドとして持たせる。

## 実装ルール（要点）

- 破壊的変更を避ける目的でも、契約違反の吸収はしない。
- 必須値（例: `nodeId`）は型で必須化し、`null/undefined` を黙認しない。
- 新規 `*.ts/*.tsx` は `docs/ts-file-naming-guideline.md` に従う（`.tsx` の Container/Presentational 分離・View サフィックス規約を含む）。
- 再エクスポート禁止（例外: `src/index.ts` と export エントリ対応のトップ `index.ts`）。
- テスト（`__tests__`）は原則相対 import を使い、`~/*` を避ける。

## Hook整理（4分類）

- 分類: 共用/特定 × 親/子孫。
- 配置:
  - 共用+親: `src/ui/hooks/useX.ts`
  - 共用+子孫: `src/ui/hooks/useX/`
  - 特定+親: `src/ui/components/<Component>/useY.ts`
  - 特定+子孫: `src/ui/components/<Component>/y/`
- コンポーネントは親フックのみ直接 import する。
- 2箇所以上で使う親フックは `src/ui/hooks` へ昇格する。

## React Hooks 依存配列ルール（必須）

- 背景: LLM はフック依存配列を誤りやすい。欠落は stale closure、過剰は無限ループを招く。biome の `correctness/useExhaustiveDependencies` は CI で検出するが、生成段階で正しく書くことを最優先とする。

### 原則

- `useEffect` / `useMemo` / `useCallback` の依存配列は、クロージャ内で参照する全てのリアクティブ値（props・state・派生変数）を過不足なく列挙する。
- 「動けばいい」で `// eslint-disable` や空配列 `[]` を使わない。意図的に初回のみ実行する場合はコメントで理由を明記する。

### 禁止パターン

1. 依存配列の省略・空配列での誤魔化し: クロージャ内で参照する値があるのに `[]` を指定して stale closure を作る。
2. オブジェクト・配列リテラルの直接依存: レンダーごとに新しい参照が生まれ、不要な再実行や無限ループの原因となる。`useMemo` で安定化するか、プリミティブに分解する。
3. コールバック関数の非安定参照: 依存配列に含める関数は `useCallback` で安定化する。親から受け取る関数 prop も同様に扱う。
4. setState 関数の不要な依存登録: `setState` / `dispatch` は React が安定性を保証するため依存配列に含めない。
5. ref.current の依存登録: `useRef` の `.current` はリアクティブではないため依存配列に含めない（変更を検知できない）。

### セルフチェック手順

- フックを書いた/変更した後、クロージャ内の全変数を洗い出し、依存配列と突合する。
- 依存配列に含めた値がレンダーごとに新しい参照を生むかを確認し、必要なら `useMemo` / `useCallback` で安定化する。
- 「この effect はいつ再実行されるべきか」を自然言語で述べ、依存配列がその意図と一致するか検証する。

## ビルド/型チェック運用（要点）

- JS バンドルは `tsdown` を基本とする。
- 他パッケージ `.d.ts` 依存は Turbo/`prebuild:*` で順序保証する。
- `tsdown` の `clean:true` 上書きは禁止（必要時は `pnpm clean && turbo run clean`）。
- 個別検証は原則 Turbo 経由:
  - `pnpm -w turbo run <task> --filter @hierarchidb/<pkg>`

## vitest 実行ルール（必須）

- `vitest run` は一回実行して終了するコマンドのため、`executeBash` で直接実行する。
- 禁止: `controlBashProcess` 経由での vitest 起動（ウォッチモードで動き続け、終了を検知できない）。
- 正しい実行例:
  - パッケージ全体: `pnpm -w turbo run test --filter @hierarchidb/<pkg>`（turbo 経由・推奨）
  - 直接実行: `executeBash` で `pnpm vitest run` を `cwd` 指定で実行、`timeout` を適切に設定する。

## Vite optimizeDeps（再発防止・必須）

- 背景: workspace パッケージは dev モードで `optimizeDeps.exclude` に入るため、Vite はそれらの推移的依存を事前クロールできない。`optimizeDeps.include` に登録しても、`app/package.json` に依存がなければ pnpm の隔離により resolve 失敗する。結果、初回アクセス時に依存が逐次発見されブラウザが繰り返しリロードされる。
- 新しいサードパーティパッケージを `import` に追加した場合、以下を同時に行うこと:
  1. `app/package.json` の `dependencies` にそのパッケージを追加（pnpm workspace では app から直接 resolve できないと `optimizeDeps.include` が機能しない）。
  2. `app/vite.config.ts` の `optimizeDeps.include` にパッケージ名（deep import パス含む）を追加。
  3. `pnpm install` を実行して resolve 可能であることを確認。
- 対象: `app/src/`・`plugins/`・`packages/` 配下の `*.ts/*.tsx` から import される、`node_modules` 由来の全パッケージ（deep import パス `@mui/icons-material/Xxx` 等を含む）。
- 禁止: 上記を忘れたまま PR をマージすること（開発サーバ初回アクセス時のリロードループの原因になる）。
- MUI アイコンは個別パス（`@mui/icons-material/<IconName>`）を1つずつ登録する（バレル `@mui/icons-material` だけでは不十分）。
- `@emotion/react/jsx-dev-runtime` のような内部 deep path も検出されたら追加する。

## 検証と完了報告

- 変更後は必要な `pnpm install / build / typecheck / test` を実行し、exit code を確認する。
- 完了報告には実行コマンド・終了コード・要点を記載する。
- 未検証項目があれば理由と次アクションを明示する。

## 参照先（詳細）

- `docs/task-management.md`
- `docs/templates/task-issue-template.md`
- `docs/ts-file-naming-guideline.md`
- `docs/draft-dialog-hosting.md`
- `PLANS.md`（大規模変更時の ExecPlan）

## 仕様書・設計書の所在（shape plugin）

実装・修正・調査の際は以下を最初に参照すること。

- `docs/build-session-spec.md` — ビルドセッションライフサイクル・タスクステータス・ステージ進行規則
- `docs/build-session-worker-ui-event-spec.md` — Worker→UI イベントの正規仕様（イベント型・ペイロード契約・UI atom 更新規則）
- `docs/build-session-worker-ui-event-design.md` — 同仕様の設計詳細
- `docs/shape-build-session-ssot-execplan.md` — SSOT リファクタの ExecPlan
- `docs/vt-shape-pipeline-design.md` — shape パイプライン設計

## Git ワークツリー運用（並列作業・標準手順）

### 原則
- Issue 1件 = ブランチ 1本 = ワークツリー 1つ。
- PR の main へのマージは必ず GitHub 側（Web UI または gh pr merge）で行う。
- ローカルのワークツリー・ブランチ削除は PR push 完了後に即実施してよい（マージ待ち不要）。

### 着手時（Issue 起票後）

```bash
# ワークツリーとブランチを同時作成
git worktree add ../hierarchidb-wt/<slug> -b <type>/<scope>/<slug>

# 例
git worktree add ../hierarchidb-wt/fix-1030 -b fix/shape-plugin/task-failure-error-message
```

- 配置先: リポジトリ親ディレクトリ直下 `../hierarchidb-wt/<slug>/`
- `pnpm install` はワークツリーディレクトリ内で別途実行する。

### 完了時（PR push 後）

```bash
# 1. リモートに push
git -C ../hierarchidb-wt/<slug> push -u origin <branch-name>

# 2. PR 作成
gh pr create --head <branch-name> --title "..." --body "..."

# 3. ローカルのワークツリーを削除（マージ前でも可）
git worktree remove ../hierarchidb-wt/<slug>

# 4. ローカルブランチを削除（マージ前でも可）
git branch -d <branch-name>
```

### 不要参照のクリーンアップ

```bash
git worktree prune   # 削除済みワークツリーの参照を一括除去
```

### 注意
- 同一ブランチを複数ワークツリーで同時チェックアウト不可。
- Turbo キャッシュ（`.turbo/cache/`）はリポジトリ共通で共有される。
- Kiro IDE でワークツリーを開く場合は別ウィンドウで対象ディレクトリを開く。
