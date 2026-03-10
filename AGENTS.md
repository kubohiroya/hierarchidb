## Primary Directive

- Think in English, interact with the user in Japanese.
- コードコメントと英語版ドキュメントは英語で記述する。
- `TASKS.md`（運用ハブ）は日本語で記述する。

## このファイルの運用

- 会話で繰り返し発生した指示は本ファイルに反映する。
- 常に圧縮・明確化を優先し、重複記述を残さない。
- 不具合報告では必ず「原因 / 発生範囲 / 修正方法 / 適用範囲」を示す。

## 高優先ルール（非交渉）

- 契約違反の隠蔽を禁止する（高優先）。
- 禁止: 丸め・clamp・デフォルト補完・互換フォールバック・曖昧な受け入れ分岐で処理継続。
- 必須: 契約違反は即時にエラー化し、失敗を可視化する。
- 例（progress）: `finite number` かつ `0..100` 以外はバグとして扱う。
- 例外: データ保全・セキュリティ・重大可用性の緊急回避で一時措置が必要な場合のみ、事前のユーザー承認と Issue/運用ログへの記録を必須とする。
- ユーザーの明示指示なしに後方互換や保険実装を追加しない。

## タスク管理（SSOT）

- SSOT は GitHub Issues + Project。
- `TASKS.md` は `Doing / Blocked / 今日の運用ログ` のみ記録。
- 詳細ルールは `docs/task-management.md`、Issue本文は `docs/templates/task-issue-template.md`。

## 実装着手ゲート（順番固定）

1. DoD を提示し、ユーザー承認を得る。
2. `gh issue create` で Issue を起票。
3. Issue を Project に追加し `Status=Doing` を設定。
4. ブランチ作成（`<type>/<scope>/<slug>`）。
5. `TASKS.md` の `Doing` に `#<issue> / branch / start` を1行記録。
6. ここまで完了後に、コード編集・検証コマンドを開始する。

## 起票失敗時の扱い

- `gh` 認証/権限/ネットワーク問題で起票不能なら `blocked` 扱いで停止。
- コード変更は行わず、失敗コマンド・エラー要約・解除条件を報告。
- `TASKS.md` の `Blocked` と `今日の運用ログ` に記録。

## 禁止事項

- Issue 未起票の実装・修正・コミット。
- Issue番号なし PR 作成。
- `TASKS.md` の台帳化（Done 詳細・検証本文の持ち込み）。
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

## 実装ルール（要点）

- 破壊的変更を避ける目的でも、契約違反の吸収はしない。
- 必須値（例: `nodeId`）は型で必須化し、`null/undefined` を黙認しない。
- 新規 `*.ts/*.tsx` は `docs/ts-file-naming-guideline.md` に従う。
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
2. オブジェクト・配列リテラルの直接依存: レンダーごとに新しい参照が生まれ無限ループになる。`useMemo` で安定化するか、プリミティブに分解する。
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
