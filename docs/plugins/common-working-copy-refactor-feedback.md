# Working Copy / Entity 共通設計フィードバック (2025-10-05)

Location プラグインのリファクタリングを通じて得られた知見を、全プラグイン共通の設計ガイドラインとして取りまとめる。Base / Folder / Shape / Resolver など既存プラグインの再整備時、必ず本ドキュメントの項目を適用すること。

## 1. WorkingCopyDraft 構造の厳格化
- `WorkingCopyDraft<TEntity>` は `draft: Partial<TEntity>` とメタ情報のみで構成し、トップレベルにエンティティフィールドを展開しない。
- UI 一時状態や派生値は `draft` に含めない。`isDraft` / `modifiedFields` などの補助フラグも禁止。
- `markWorkingCopyUpdated` は `draft` の更新＋メタ更新のみ行う API とし、キャストで Partial を top-level に混在させないよう base-plugin を拡張する。

## 2. Entity ↔ WorkingCopy アダプタの共通化
- Entity から WorkingCopy への変換、WorkingCopy から Entity への差分適用ロジックを base-plugin に集約したアダプタとして提供する。
- UI 側では Jotai の派生 atom を用いた `checkboxState` 等の再計算パターンを標準とし、WorkingCopy へ派生結果を書き戻さない。
- Worker / UI / Extension で同じ変換ロジックを 3 重に持たないよう、アダプタを注入して再利用する。

## 3. BaseEntityHandler のタイムスタンプ更新
- `updatedAt` は常に `Date.now()` を利用し、`+1` など人工的な増分を廃止する。
- version increment は BaseEntityHandler が保証し、各プラグインの handler では重複実装しない。
- 実タイムスタンプ運用を前提にログ／復旧手順を更新する。

## 4. UI 向け EntityHandler の共通 Adapter 化
- Dexie を持たない UI テスト用 handler は base-plugin の in-memory Adapter を利用し、同じ初期化ロジックを複製しない。
- Folder / Shape など既存の UI handler を Adapter への薄いラッパーに差し替え、WorkingCopy の扱いを統一する。

## 5. Wizard state の保存ポリシー明文化
- `docs/plugins/working-copy-baseline.md` と base-plugin README に「Wizard state は UI (React state / URL param / jotai atom) に閉じ込め、WorkingCopy へ保存しない」旨を追記する。
- Location / Shape の事例をサンプルとして掲載し、導線を整える。

## 6. 共通ガイドの整備
- 上記 1〜5 をまとめた設計ガイド（本ドキュメント）を base-plugin から参照できるよう README にリンクする。
- プラグインごとの README / docs に適用ステータスを記載し、横展開の進捗を可視化する。

## 今後の適用手順
1. base-plugin で WorkingCopy/Handler の API 拡張とドキュメント更新を行う。
2. Folder / Shape / Resolver / その他プラグインで WorkingCopy 実装の再整備を行う。
3. UI 向け handler を Adapter パターンへ移行し、Jotai 派生 atom による UI state 管理を標準化する。
4. TASKS 系ドキュメントで各プラグインの適用状況をトラッキングする。
