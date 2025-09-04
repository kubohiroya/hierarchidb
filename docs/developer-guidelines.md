# HierarchiDB Developer Guidelines (Plugins & Packages)

本ガイドラインは、開発時の判断を「MUST（厳守・例外なし）/ SHOULD（努力義務）/ MAY（裁量）」で明確に分類します。
定義は以下の通りです。

- MUST / MUST NOT: 例外なく遵守／禁止（逸脱はバグとして扱う）
- SHOULD / SHOULD NOT: 強く推奨／非推奨（合理的理由がある場合のみ逸脱可、PR で根拠を明記）
- MAY / MAY NOT: 状況に応じて選択可／不可（プロダクト都合での裁量）

## Dependencies and Packaging

MUST
- `workspace:*` で隣接パッケージを参照する。`tsconfig` で他パッケージの `dist/*` を path-map しない。
- すべての公開ライブラリで `d.ts` を出力する。打開策としての `dts: false` は禁止。型を直すか公開面を狭める。
- 実行時にアプリ側の単一インスタンスに結合するライブラリは `peerDependencies` に置く（ローカル開発のために同一バージョンを `devDependencies` にも置く）。
  - Database/Storage: `dexie`
  - React stack: `react`, `react-dom`
  - UI frameworks: `@mui/material`, `@mui/icons-material`
- 上記 peer を `dependencies` に入れない（重複インストールや型の競合を確実に防止）。

SHOULD
- 内部実装に閉じた小規模ユーティリティは `dependencies` に置く（ホスト統合不要の場合）。
- ライブラリとして配布するパッケージでは、React/MUI/Map/DB 等の大物は `tsup` の `external` に指定（バンドルしない）。

MAY
- 一時的に公開面を `./shared` に限定する・不安定サブパスを `exports` から外す（下記「Public API Design」参照）。

### Peer vs Dependency decision table

- Database / UI frameworks / React / Map エンジン: peerDependency（MUST）
- 低レベル純ユーティリティ（実装に閉じる）: dependency（SHOULD）
- 型専用（`@types/*` など）: devDependency（SHOULD）

## Type Strictness

MUST
- `any` を使わない。サードパーティに型が無い場合は、最小限で明示的な `.d.ts` shim を追加する（プロパティ名/型を具体化）。
- 公開 API に `unknown` を使わない。曖昧なら専用のインターフェースを定義する。
- 外部レジストリ等の境界はドメイン固有の明確な契約で表現する（例: `ShapePeerStore<T>`）。
- `@hierarchidb/common-type` の Branded ID（`NodeId`/`EntityId`）を厳守し、相互キャストを行わない。必要ならマッピング関数を導入。
- Dexie 型は具体化する：`protected table: Table<TEntity, EntityId>`、`applyAdditionalSearchCriteria(query: Collection<TEntity, …>, …)`。

SHOULD
- ホスト提供の UI 契約（例: `@hierarchidb/ui-map`）は module augmentation で型を拡張し、呼び出し側の緩和を避ける。

## tsconfig and Build

MUST
- `tsconfig` で他パッケージの `dist` を参照しない。`workspace:*` とローカル `src/*` のみを許可。
- すべてのパッケージで `d.ts` 生成を有効に保つ。不安定な場合は公開面を狭めて解決する。
- ライブラリのバンドラ（`tsup`）では React/MUI/Map/DB を external 指定。

SHOULD
- UI/Worker が型未安定なら、ひとまず `shared` のみを公開し、安定次第サブパスを再公開する。

## Public API Design

MUST
- ルートの公開面は安定・文書化済みの型/関数に限定する。

SHOULD
- サブパス（`./shared`, `./worker`, `./ui`）で公開面を段階管理し、不安定な領域は一時的に `exports` から外すことで `d.ts` を保つ。

## Temporary Workarounds Policy

MUST NOT
- `dts` を一時的に無効化しない。

MUST（優先順位順の代替策）
1) 公開面を絞る（exports を限定）
2) 明示的なローカル shim を追加（最小・具体的な契約）
3) ホスト側パッケージの module augmentation を追加
4) コア型を緩めるのではなく境界に型付きアダプタを挿入

## PR Checklist (Mandatory)

- [ ] Uses `workspace:*` for internal deps; peers are in `peerDependencies`.
- [ ] No `any`/`unknown` in public types. Local shims are explicit.
- [ ] `d.ts` generation enabled and passing.
- [ ] Tables/Collections typed with Dexie v4 types.
- [ ] Public API exports are stable; unstable areas hidden or under subpaths.
- [ ] Bundler `external` configured for React/MUI/Map/DB.

## MUI and Material Icons

MUST
- ライブラリ/プラグインでは `@mui/material` と `@mui/icons-material` を peerDependencies に置く（devDependencies にも同バージョンを追加）。バンドルしない。

## Dexie

MUST
- モノレポ全体で Dexie v4 を使用し、型を統一する。
- Dexie は peerDependencies（devDependencies に同一バージョン）に置く。
- Dexie の利用は `Table<TEntity, EntityId>` / `Collection<TEntity, …>` を明示。暗黙の any を禁止。
