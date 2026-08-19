# `src/**/*.ts` / `src/**/*.tsx` ファイル命名指針

本ドキュメントは、リポジトリ全体の `src` 配下にある `*.ts` / `*.tsx` ファイル名を、役割から一意に推測できる状態へ揃えるための指針です。

## 対象範囲

- `app/src/**/*.ts`, `app/src/**/*.tsx`
- `packages/*/src/**/*.ts`, `packages/*/src/**/*.tsx`
- `plugins/*-plugin/src/**/*.ts`, `plugins/*-plugin/src/**/*.tsx`

除外:

- `dist/**` など生成物
- `*.d.ts`（型宣言ポリシーは `docs/developer-guidelines.md` を参照）
- `__tests__/**`
- `*.test.ts`, `*.test.tsx`, `*.spec.ts`, `*.spec.tsx`

テストファイルはテスト対象との対応を示す命名を優先するため、主エクスポート名や
Container/Presentational 構成を検査する Naming Audit の対象外とする。配置場所に
よって判定を変えず、`__tests__/` 配下と co-located test の両方を除外する。

## Naming Audit の実行モード

通常のローカル実行はリポジトリ全体を検査し、既存分を含む全違反を表示する。
error が1件以上あれば終了コード `1` とする。

```bash
pnpm tsx scripts/naming-audit.ts
```

Pull Request のCIでは、base SHAから追加・変更・コピー・renameされた監査対象
ファイルだけに、同じAuditコードとルールをbase revisionとhead revisionの両方で
適用する。headの違反を表示した上で、厳密に一致するbase側errorを既存分として
差し引き、新規または悪化したerrorがある場合だけ終了コード `1` とする。変更範囲内
の既存error解消数とwarning数の変化もCIログへ表示する。削除済みファイルは解析しない。

監査スクリプトまたはNaming Audit workflow自体を変更した場合は、規則変更の影響を
確認するためbase/headの全対象ファイルを解析する。CLIで
`--changed-since <base-ref>`を指定しない場合も全対象ファイルを解析する。

base側レポートはJSON schemaを厳密に検証する。base commitの取得失敗、レポートの
欠落・破損、schema不一致は成功扱いにせず終了コード `2` とする。incremental scanで
変更対象が0件になることは正常系とするが、full scanで対象が0件なら終了コード `2`
とする。不正なbase refをfull scanへフォールバックさせない。

CI内部ではbase側のJSON生成に次のreport-onlyモードを使う。このモードは違反を
無視する一般的な成功フォールバックではなく、base/head比較用データを生成する
場合に限って使用する。

```bash
pnpm tsx scripts/naming-audit.ts --root <base-worktree> --changed-since <base-sha> --format json --report-only
pnpm tsx scripts/naming-audit.ts --ci --changed-since <base-sha> --baseline <base-report.json>
```

## `app/src` への適用注記

本ガイドは `app/src` にも適用する。ただし、フレームワークやルーターの解決規約がある領域では、その規約を優先する。

| 領域 | 適用方針 | 補足 |
| --- | --- | --- |
| `app/src/router/**` | ルーター規約を優先（本ガイドの例外） | ルート解決に必要なファイル名は変更しない。`*Route.js` / `*.route.js` などルート規約に準拠した命名は「主エクスポート一致」より優先。 |
| `app/src/contexts/**` | 共通ルールを適用 | Provider/context の実体名とファイル名を一致させる。 |
| `app/src/**/hooks/**` | 共通ルールを適用 | Hook は `use*.ts` を必須とし、`use*.tsx` は禁止。 |
| `app/src/components/**`（非ルート解決対象） | 共通ルールを適用 | 汎用名を避け、主責務が推測できる名前にする。 |

注記:

- `app/src/router/**` で命名変更が必要な場合は、まずルーティング仕様への影響を確認してから実施する。
- ルーター規約が優先されるファイルでも、可能な範囲で責務が推測しやすい語彙を採用する。

## 命名の基本原則

1. ファイル名だけで「主責務」を推測できること。
2. 1ファイル1主役（primary export）を原則とし、ファイル名と主役シンボル名を一致させること。
3. 汎用名（`helper.ts`, `common.ts`, `misc.ts`, `temp.ts`）を禁止すること。
4. 省略語はドメインで定着したものだけ許可し、任意短縮を避けること。

## 必須ルール

### 1. 主エクスポート一致

- 主エクスポートが関数/クラス/オブジェクトなら、`camelCase` または `PascalCase` でシンボル名と同名にする。
- 例: `useShapeBuildCacheActions` を主に export するなら `useShapeBuildCacheActions.ts`。

### 2. Hook ファイル

- Hook は必ず `use*.ts` とする。
- `use*.tsx` は禁止（JSX を hook に持ち込まない）。
- Hook の配下ロジックは `useXxx/` ディレクトリに分割し、親 hook からのみ公開する。

### 3. 役割サフィックス

- 型定義の集約: `types.ts`
- 定数の集約: `constants.ts`
- 純関数ユーティリティ: `utils.ts`
- バリデーション: `validators.ts`

補足:

- `types.ts` / `utils.ts` / `constants.ts` は「そのディレクトリ境界内で責務が明確」な場合のみ許可する。
- 境界が曖昧になる場合は、`<domain>Types.ts` などドメイン名を付与する。

### 4. `index.ts` の例外

- `index.ts` は再エクスポート専用入口としてのみ許可する。
- 実ロジックを `index.ts` に書かない。

### 5. 実装詳細ファイルの扱い

- `*.internal.ts`: 同一ディレクトリ内 private 実装であることを明示する場合のみ使用可。
- `*.impl.ts`: インターフェース実装差し替え点を表す場合のみ使用可。
- `*.core.ts`: アルゴリズム中核を切り出す場合のみ使用可。

上記サフィックスは乱用禁止。理由なく使う場合は、より具体的なドメイン名へ改名する。

## 禁止パターン

- 意味が広すぎる名前: `common.ts`, `shared.ts`, `helper.ts`, `util.ts`, `tmp.ts`
- 役割と不一致な名前: `formatDate.ts` に stateful 処理や I/O を含める
- 逆方向依存を隠す名前: 実態が UI 専用なのに `core.ts` と命名する

## Good / Bad 例

### packages 配下

- Good: `packages/runtime-worker/src/services/buildSessionBroadcast.ts`
  - 理由: ドメイン（build session）と責務（broadcast）が明確。
- Bad: `packages/runtime-worker/src/services/helper.ts`
  - 理由: 何を補助する helper なのか判別できず、責務が推測できない。

- Good: `packages/plugin-registry/src/index.ts`
  - 理由: 入口ファイルであることが明確で、`index.ts` 例外ルールに一致。
- Bad: `packages/plugin-registry/src/common.ts`
  - 理由: 利用範囲が肥大化しやすく、責務が不明瞭。

### plugins 配下

- Good: `plugins/shape-plugin/src/ui/hooks/useShapeBuildCacheActions.ts`
  - 理由: plugin 固有ドメイン + hook 名が一致している。
- Bad: `plugins/shape-plugin/src/ui/hooks/useCache.ts`
  - 理由: キャッシュ種別・責務境界が不明。

- Good: `plugins/location-plugin/src/common/hooks/useLocationProgress.ts`
  - 理由: レイヤ（common/hooks）と責務（location progress）が明確。
- Bad: `plugins/location-plugin/src/worker/internal.ts`
  - 理由: 実体を示さず、検索性が低い。

## 改名の判断基準

次を1つでも満たすなら改名候補とする。

1. ファイル名から主エクスポートを推測できない。
2. ファイル名と実装責務が一致しない。
3. `utils.ts` など汎用名が複数ドメインの処理を抱えている。
4. `internal/impl/core` サフィックスが「理由なし」で使われている。

## 改名手順（運用）

1. 変更前に Issue へ対象ファイルと改名理由を記載する。
2. `git mv` で rename し、同一PRで import を全更新する。
3. 旧名ファイルを残さない（段階移行しない）。
4. `pnpm lint && pnpm typecheck && pnpm test`（必要フィルタ付き）で回帰確認する。
5. PR には「命名理由」と「ロールバック方法（rename 戻し）」を明記する。

## `.tsx` ファイル命名規約

### コンポーネントファイル

- コンポーネントファイルは PascalCase: `ComponentName.tsx`
- ファイル名と主エクスポートのコンポーネント名を一致させる。

### View サフィックス（Presentational コンポーネント）

- Presentational コンポーネント（props のみに依存し、hooks を使用しない）には `*View.tsx` サフィックスを付与する。
- 例: `CacheManagementSectionView.tsx`

### Container/Presentational 分離パターン

分離が必要なコンポーネントは以下の3ファイル構成（パターン A）を標準とする:

```
ComponentName/
  ComponentName.tsx              → Container（hook 呼び出し + View 組み立て）
  ComponentNameView.tsx          → Presentational（React.memo 適用、hooks なし）
  useComponentNameState.ts       → State hook（Container ロジック抽出）
```

- Container は State hook を呼び出し、戻り値を View の props として渡す。
- Presentational には `React.memo` を適用し、`displayName` を設定する。
- re-export のみのラッパーファイル（パターン B）は禁止。実体ファイルを直接参照する。

### 分離判断基準

以下のいずれかを満たすコンポーネントは分離を推奨する:

- JSX 行数 > 50
- hooks 呼び出し数 > 2

上記を満たさない小規模コンポーネントは分離せず、`React.memo` のみ適用する。分離しない場合はコードコメントで理由を明記する。

### `.tsx` の禁止パターン

- `use*.tsx`: Hook に JSX を持ち込まない（`use*.ts` を使用する）。
- re-export のみの `.tsx` ラッパーファイル: 実体ファイルを直接参照する。

## レビュー観点（チェックリスト）

- [ ] ファイル名と主エクスポート名は一致しているか
- [ ] 汎用名ファイルに責務が混在していないか
- [ ] `index.ts` に実装ロジックが入っていないか
- [ ] `use*.ts` 以外の hook 命名違反がないか
- [ ] `internal/impl/core` の使用理由が説明可能か
- [ ] Presentational コンポーネント（hooks なし）に `*View.tsx` サフィックスが付いているか
- [ ] 分離閾値（JSX > 50行 or hooks > 2）を超えるコンポーネントが Container/Presentational 分離されているか
- [ ] re-export のみの `.tsx` ラッパーファイルが残っていないか
