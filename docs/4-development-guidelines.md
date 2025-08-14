# 4. 開発ガイドライン

## 4.1 設計原則
- **KISS原則**：シンプルを最優先。複雑さを先回りで入れない。
- **YAGNI**：想定だけの機能は入れない。使われるまで実装しない。
- **早期リターン推奨**：ネストを浅く保つ。
```ts
// NG
if (cond) { /* 大処理 */ } else { return; }
// OK
if (!cond) return;
/* 大処理 */
```
- **単一責任**：関数・コンポーネントは1つの責務に絞る。200行/関数を超えない目安。
- **不変データ優先**：オブジェクトの再代入より新規生成（`{...o, x}`）を基本。
- **副作用分離**：IO（DB/通信/DOM）は境界に寄せ、純粋ロジックをテスト可能に。

## 4.2 TypeScript/型安全
- `any` 型は禁止。`unknown`→ナローイング、`never`で到達不能検知。
- 非null断言 `!` の原則禁止（`obj!.func()`は実行時落ちやすい）。代わりにガード関数を利用。
```ts
function assertNonNull<T>(v: T | null | undefined, msg='required'): asserts v is T {
  if (v == null) throw new Error(msg);
}
```
- `as`キャストは最小限。実データ検証には Zod/typia 等を使用。
- リテラル型・列挙型でバグをコンパイル時に発見。
- `readonly` の積極利用。関数引数は読み取り専用を基本。

## 4.3 文字列・定数・設定
- 魔法の文字列/数値禁止。必ず定数化または `as const`。
- キー名を直書きしない（Dexieテーブル名やイベント名は定数に）。
- 環境設定はconfig層に集約し、UI/Worker間で重複させない。

## 4.4 エラーハンドリング/ロギング
- 失敗は明示：返り値を `Result<T,E>` パターン、または例外に統一。
- ユーザ通知はUI層で一箇所に集約。
- ログに機微情報を残さない。開発ログはビルドで除去可能に。
- Comlink APIのエラーコードは列挙型で統一。

## 4.5 非同期/並列・状態管理
- 競合しやすい処理は直列化。Dexieトランザクション内でawaitの扱いに注意。
- タイマーやintervalは必ず解除。
- 入力による大量コマンド生成はデバウンス（300ms目安）で抑制。

## 4.6 UI（React/MUI/TanStack Table）
- 制御/非制御を混ぜない。フォームはreact-hook-form等で統一。
- アクセシビリティを確保（ラベル/ロール/キーボード操作）。
- 大量行は仮想化（Virtualizer）必須。
- CSS-in-JSは最小限。テーマトークンを利用し直値を避ける。

### 4.6.1 UIモジュールの分割構成
UIは機能別に以下のパッケージに分割されている：

- **@hierarchidb/ui-core**: 基本UIコンポーネント
  - Material UI（MUI）コンポーネント
  - テーマシステムと共通スタイル
  - 通知システム（Toast、Notification）
  - アイコンとアニメーション

- **@hierarchidb/ui-auth**: 認証関連
  - OAuth2/OIDC認証コンポーネント
  - 認証コンテキストとフック
  - ユーザー情報表示

- **@hierarchidb/ui-routing**: ルーティング
  - React Routerベースのナビゲーション
  - ルート定義とURLヘルパー

- **@hierarchidb/ui-i18n**: 国際化
  - i18next設定と言語切り替え
  - 翻訳リソース管理

- **@hierarchidb/ui**: 統合UI
  - 上記モジュールを統合
  - アプリケーション固有のUIロジック

この分割により、必要な機能のみを選択的に使用でき、バンドルサイズの最適化と独立した開発が可能になる。

## 4.7 Worker/DB（Dexie/Comlink）
- トランザクション境界は物理コマンド単位で明確化。UIからDBへ直接アクセス禁止。
- インデックス必須。フルスキャン禁止。
- `updatedAt`はWorkerで採時。
- Comlink APIは後方互換を保つ。破壊的変更はバージョンアップ。

## 4.8 命名/可読性/スタイル
- CamelCase（変数/関数）、PascalCase（型/クラス）、UPPER_SNAKE_CASE（定数）。
- 肯定条件で書く。否定条件は早期リターンで解消。
- コメントは「なぜ」を書く。処理内容は型と名前で表現。
- import順序をeslint-plugin-importで統一。

## 4.9 テスト（Vitest/Playwright）
- ユニットテスト優先。DB/Comlinkは薄い統合テストで補完。
- ゴール駆動E2E：作成→編集→削除→Undo/Redoの一連動作を必須カバー。
- テストデータは固定化。識別子は擬似UUIDで安定化。
- フレーク防止のため状態待ちを使用。

## 4.10 ドキュメント/レビュー/ブランチ
- 公開API関数はJSDoc必須。
- 設計変更はADRで記録。
- コミットはConventional Commits準拠。
- PRはレビュー30分以内で終わる単位に分割。

## 4.11 セキュリティ/プライバシ
- 外部API未使用時は認証不要（完全オフライン）。
- 入力バリデーションはUIとWorkerの両方で実施。
- 依存パッケージは `pnpm audit` で定期監査。
- **設定値管理方針**：
    - クライアントIDやリダイレクトURLなどの非機密値は `.env` ファイルで管理し、`.gitignore` に登録する。
    - クライアントシークレットや署名鍵などの機密値は Cloudflare Secrets（`wrangler secret put`）で登録し、Worker内で参照する。

## 4.12 パフォーマンス
- 計測ポイントを用意（レンダリング時間/DBクエリ時間）。
- 大配列再生成回避のためuseMemo/useCallback活用。
- Deep copyは必要箇所のみ。

## 4.13 国際化/i18n
- UIテキストは辞書化（直書き禁止）。
- 日時/数値フォーマットはIntl API利用。

## 4.14 破壊的変更ポリシー
- core型・api契約の破壊的変更禁止。やむを得ない場合はメジャーバージョンアップ。
- 廃止は段階的に行い、@deprecatedを付与して警告期間を設ける。

---

### 付録：よくあるNG → OK例

**非null断言**
```ts
// NG
const name = node!.name;

// OK
if (!node) return;
const { name } = node;
```

**魔法の文字列**
```ts
// NG
db.table('nodes').where('parentTreeNodeId')

// OK
const TABLE_NODES = 'nodes' as const;
const IDX_PARENT = 'parentTreeNodeId' as const;
db.table(TABLE_NODES).where(IDX_PARENT)
```

**巨大条件分岐**
```ts
// NG
if (a) { ... } else if (b) { ... } else if (c) { ... }

// OK
const handlers = { a: handleA, b: handleB, c: handleC } as const;
handlers[kind]?.();
```
