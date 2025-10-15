# Working Copy Refactor Plan

最終更新: 2025-10-06

## 現状整理

- `WorkingCopyBase<TEntity>` は `draft: Partial<TEntity>` を保持しつつ、`WorkingCopyDraft<TEntity>` が `WorkingCopyBase<TEntity> & Partial<TEntity>` という型合成になっている。
- `markWorkingCopyUpdated` は `draft` とトップレベルの両方に同じフィールドを展開するため、利用側では `workingCopy.name` と `workingCopy.draft.name` が併存する。
- UI/handler で `workingCopy.foo` を直接参照している箇所が多数存在し、UI 状態が WorkingCopy へ紛れ込む温床になっている。
- `draft` のみを正とする設計に移行することで、Working Copy 内に保持する値を明確にし、UI 状態を切り離しやすくする狙い。

### 既存使用状況（一部）

| プラグイン | 主なフィールド参照 | 備考 |
| --- | --- | --- |
| location | `workingCopy.selectionMatrix`, `workingCopy.dataSource`, `workingCopy.licenseAgreement`, `workingCopy.concurrentDownloads` | TanStack Router 移行済み。UI はトップレベル参照依存。 |
| route | `workingCopy.name`, `workingCopy.routeType`, `workingCopy.transportModes`, `workingCopy.version`, `workingCopy.waypoints` など | ダイアログ各ステップと handler が直接参照。 |
| basemap | handler と tests で `workingCopy.name` 等を直接利用。 | |
| shape | ステップ UI / worker API / handler / utils が `workingCopy.checkboxState`, `workingCopy.dataSourceName` 等を参照。 |
| resolver | handler が `workingCopy.draft` とトップレベル両方を混在利用。 |
| folder (仕様書) | ドキュメント内サンプルがトップレベル参照。 |

## 改修方針

1. **型定義の見直し**
   - `WorkingCopyDraft<TEntity>` を `WorkingCopyBase<TEntity>` のみとし、トップレベルに `Partial<TEntity>` を展開しない。
   - 代替として `createWorkingCopyProxy`（仮）など、`draft` を透過的に扱いたい場合は getter を提供する方向を検討。

2. **ヘルパーの更新**
   - `createDraftWorkingCopyBase` は変わらず `draft` とメタ情報を返す。
   - `markWorkingCopyUpdated` は `draft` のみを更新し、戻り値も `WorkingCopyBase<TEntity>` を返すよう変更。
   - 既存コードが `markWorkingCopyUpdated(wc, updates)` 後にトップレベルを参照しているケースが多いため、後述の移行ステップで徐々に置き換える。

3. **移行戦略**
   1. **基盤更新前の棚卸し**（本ドキュメント）…完了
   2. **プラグイン別のトップレベル参照を `draft` 参照へ置換**
      - まず Location/Route/Basemap/Shape/Resolver 主要５プラグインから着手。
      - UI 側は Hook やコンポーネントで `const { draft } = workingCopy` を展開するラッパーを導入予定。
   3. **テスト＆ドキュメント更新**
      - `WorkingCopyDraft` 参照サンプル（README や docs）を `draft.*` パターンに書き換え。
   4. **基盤更新**
      - `WorkingCopyDraft` とヘルパーの型を切り替え、型エラーで残存箇所を洗い出す。

## 影響範囲サマリ

| プラグイン/モジュール | 主な対応内容 | 備考 |
| --- | --- | --- |
| `@hierarchidb/location-plugin` | `workingCopy.x` -> `workingCopy.draft.x` へ置換。TanStack Router 移行済みのため比較的少ない。 | ステップ UI と handler の両方を更新予定。 |
| `@hierarchidb/route-plugin` | ステップ UI 全体で `workingCopy.*` を `draft.*` に置換。バリデーションロジック更新。 | `useWorkingCopy` hook との整合性確認が必要。 |
| `@hierarchidb/plugins/shape-plugin` | UI/Worker/API/Docs 全域に `draft` 化が必要。 | バッチセッション連携あり、影響大。 |
| `@hierarchidb/plugins/basemap-plugin` | Handler と tests の `workingCopy` 参照が多いため、先に共通ユーティリティで `draft` を参照するヘルパーを導入予定。 | |
| `@hierarchidb/plugins/resolver-plugin` | Handler が `draft` を既に併用しているため、置換規模は小さめ。 | |
| Runtime Worker | `WorkingCopyTreeNodeOperations` などで `workingCopy.version` を参照しており、`draft` へ統一する必要あり。 |
| Docs/Spec | Folder/Shape の仕様書などにあるサンプルコードを `draft` パターンに修正。 | |

## 今後のタスク案

1. Location プラグイン: `LocationWorkingCopy` を `draft` 中心に再定義し、UI/handler の参照を置換。
2. Route プラグイン: ダイアログ Steps／Handler の `workingCopy.*` → `draft.*` 置換とバリデーション調整。
3. Shape プラグイン: `checkboxState` や `processingConfig` を `draft` から参照するよう統一し、Worker API への影響を洗い出し。
4. Basemap/Resolver プラグイン: Handler 内の `workingCopy` 依存を `draft` に寄せる。
5. Runtime Worker サービス: `WorkingCopyTreeNodeOperations` 等で `draft` へのアクセスへ統一。
6. Docs 更新: `docs/plugins/working-copy-baseline.md` などのサンプルコード更新。
7. 基盤更新: `WorkingCopyDraft` 型とヘルパーの実装変更、テスト修正。

## メモ

- `useWorkingCopy` hook（runtime-ui/plugin-dialog）に `getDraftSelector` を用意し、UI からは基本的に `draft` を直接扱う方針へ誘導できる。
- `markWorkingCopyUpdated` の戻り値が変わるため、基盤更新時には `const next = markWorkingCopyUpdated(wc, patch);` 後の `next.field` 参照が型エラーで顕在化する。先に全参照箇所を `draft` 化しておくことで移行が容易になる。
- Worker 側で `workingCopy.batchSessionId` などを参照している箇所は、`WorkingCopyBase` に `meta` もしくは `draft` へアクセスするよう調整が必要。
