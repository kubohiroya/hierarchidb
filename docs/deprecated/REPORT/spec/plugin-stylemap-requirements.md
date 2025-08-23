# plugin-stylemap 要件定義書

## 概要

🟢 plugin-stylemap は、hierarchidb フレームワークにおいて、表形式データを地図可視化用のスタイル情報に変換するプラグインです。CSV/TSV ファイルからデータを読み込み、数値データに基づいてカラーマッピングを行う機能を提供します。この要件定義は、eria-cartograph プロジェクトの既存 stylemap 実装を詳細に分析して作成されています。

## 関連文書

- **ユーザストーリー**: [📖 plugin-stylemap-user-stories.md](plugin-stylemap-user-stories.md)
- **受け入れ基準**: [✅ plugin-stylemap-acceptance-criteria.md](plugin-stylemap-acceptance-criteria.md)

## 機能要件（EARS記法）

### 通常要件

- REQ-001: システムは CSV/TSV ファイルからテーブルデータを読み込みしなければならない 🟢
- REQ-002: システムは テーブルデータをキー・値ペアにマッピングしなければならない 🟢
- REQ-003: システムは 数値データに基づくカラーマッピング設定を管理しなければならない 🟢
- REQ-004: システムは StyleMapEntity として永続化しなければならない 🟢
- REQ-005: システムは MapLibre GL JS 対応のスタイルプロパティを生成しなければならない 🟢
- REQ-006: システムは ファイルコンテンツのSHA3ハッシュベースキャッシュを管理しなければならない 🟢
- REQ-007: システムは 作業コピー機能によるアンドゥ/リドゥ操作をサポートしなければならない 🟢

### 条件付き要件

- REQ-101: ファイルがアップロードされた場合、システムは 自動的にカラム構造を解析しなければならない 🟢
- REQ-102: 無効なファイル形式が選択された場合、システムは 適切なエラーメッセージを表示しなければならない 🟢
- REQ-103: 同一ファイルハッシュのデータが存在する場合、システムは キャッシュからデータを取得しなければならない 🟢
- REQ-104: フィルタルールが設定された場合、システムは データを動的にフィルタリングしなければならない 🟢
- REQ-105: カラーマッピング設定が変更された場合、システムは リアルタイムでプレビューを更新しなければならない 🟢

### 状態要件

- REQ-201: 編集モードにある場合、システムは 既存データを作業コピーとして読み込みしなければならない 🟢
- REQ-202: 作成モードにある場合、システムは 新規StyleMapエンティティを初期化しなければならない 🟢
- REQ-203: データが未保存状態にある場合、システムは ダイアログ終了時に確認ダイアログを表示しなければならない 🟢

### オプション要件

- REQ-301: システムは 複数のカラーアルゴリズム（線形、対数、分位数、カテゴリ）を提供してもよい 🟢
- REQ-302: システムは HSVとRGBカラー空間をサポートしてもよい 🟢
- REQ-303: システムは 正規表現ベースのフィルタリングを提供してもよい 🟢
- REQ-304: システムは カラムごとの詳細なメタデータを保持してもよい 🟡

### 制約要件

- REQ-401: システムは Worker レイヤーを通じてのみ IndexedDB にアクセスしなければならない 🟢
- REQ-402: システムは 相対インポートを使用せず、絶対インポートパスを使用しなければならない 🟢
- REQ-403: システムは TypeScript strict モードに準拠しなければならない 🟢
- REQ-404: システムは `any` 型の使用を禁止しなければならない 🟢
- REQ-405: システムは 非null断言演算子（`!`）の使用を禁止しなければならない 🟢

## 非機能要件

### パフォーマンス

- NFR-001: システムは 10万行以下のCSVファイルを5秒以内に処理しなければならない 🟡
- NFR-002: システムは カラーマッピングプレビューを500ms以内に更新しなければならない 🟡
- NFR-003: システムは ファイルキャッシュによりリロード時間を50%短縮しなければならない 🟡

### セキュリティ

- NFR-101: システムは ファイル読み込み時にXSS攻撃を防止しなければならない 🟡
- NFR-102: システムは 機密情報のログ出力を禁止しなければならない 🟢

### ユーザビリティ

- NFR-201: システムは アクセシビリティガイドライン（WCAG 2.1 AA）に準拠しなければならない 🟡
- NFR-202: システムは ステップ式UIによる直感的な操作性を提供しなければならない 🟢
- NFR-203: システムは マルチステップ間の状態永続化を提供しなければならない 🟢

### 互換性

- NFR-301: システムは MapLibre GL JS v3.x と互換性を保持しなければならない 🟢
- NFR-302: システムは Dexie v3.x のIndexedDBラッパーを使用しなければならない 🟢
- NFR-303: システムは React 19+ のコンポーネントシステムに対応しなければならない 🟢

## Edgeケース

### エラー処理

- EDGE-001: ファイル形式不正（非CSV/TSV）時の適切なエラーハンドリング 🟢
- EDGE-002: ファイルサイズ制限超過時の警告表示 🟡
- EDGE-003: ネットワーク切断時のローカルキャッシュフォールバック 🟡
- EDGE-004: Worker プロセス異常終了時の回復処理 🟡

### 境界値

- EDGE-101: 空のCSVファイル読み込み処理 🟢
- EDGE-102: 1列のみのデータファイル処理 🟢
- EDGE-103: 最大ファイルサイズ（100MB）での動作保証 🟡
- EDGE-104: Unicode文字列を含むファイル名・データの処理 🟢

### 並行処理

- EDGE-201: 複数ファイルの同時アップロード処理 🟡
- EDGE-202: 複数ブラウザタブでの同一リソース編集時の競合解決 🟡
- EDGE-203: Worker とUI間の通信エラー時のタイムアウト処理 🟡

## データ構造要件

### StyleMapEntity 構造

```typescript
🟢 interface StyleMapEntity extends PrimaryResourceEntity {
  cacheKey?: string;              // Cache API キー
  downloadUrl?: string;           // ダウンロード元URL
  filename?: string;              // ファイル名
  tableMetadataId?: UUID;         // テーブルメタデータ参照
  keyColumn?: string;             // キーカラム名
  valueColumn?: string;           // 値カラム名
  filterRules?: FilterRule[];     // フィルタルール配列
  styleMapConfig?: StyleMapConfig; // カラーマッピング設定
}
```

### StyleMapConfig 構造

```typescript
🟢 interface StyleMapConfig {
  algorithm: "linear" | "logarithmic" | "quantile" | "categorical";
  colorSpace: "rgb" | "hsv";
  mapping: {
    min: number;
    max: number;
    hueStart: number;    // 0-1
    hueEnd: number;      // 0-1
    saturation: number;  // 0-1
    brightness: number;  // 0-1
  };
  targetProperty: MapLibreStyleProperty;
}
```

### FilterRule 構造

```typescript
🟢 interface FilterRule {
  id: string;
  action: "Include" | "Exclude" | "IncludePattern" | "ExcludePattern";
  keyColumn: string;
  matchValue: string;
}
```

## プラグイン統合要件

### NodeTypeDefinition

- REQ-501: システムは NodeTypeDefinition パターンに従ってプラグインを定義しなければならない 🟢
- REQ-502: システムは EntityHandler による CRUD 操作を実装しなければならない 🟢
- REQ-503: システムは ライフサイクルフック（afterCreate, beforeDelete等）を提供しなければならない 🟢
- REQ-504: システムは UI コンポーネント（dialogComponent, panelComponent）を登録しなければならない 🟢

### Worker API 拡張

- REQ-505: システムは Worker 層での stylemap 専用 API を提供しなければならない 🟢
- REQ-506: システムは クライアント側での stylemap 管理 API を提供しなければならない 🟢
- REQ-507: システムは Comlink RPC によるシリアライゼーション対応を保証しなければならない 🟢

## テクニカル要件

### ファイル処理

- TECH-001: CSV/TSV パーサーは RFC 4180 準拠でなければならない 🟢
- TECH-002: ファイルハッシュ計算は SHA3-256 を使用しなければならない 🟢
- TECH-003: キャッシュ有効期限は 24時間 でなければならない 🟡

### データベース設計

- TECH-004: テーブル参照は UUID ベースの外部キーを使用しなければならない 🟢
- TECH-005: データ正規化により重複ファイル格納を防止しなければならない 🟢
- TECH-006: インデックス設計により検索性能を最適化しなければならない 🟡

### UI/UX 要件

- TECH-007: ステップ式ダイアログは非線形ナビゲーションをサポートしなければならない 🟢
- TECH-008: リアルタイムプレビューは debounce（300ms）を適用しなければならない 🟡
- TECH-009: エラー状態は視覚的に明確に表示しなければならない 🟢

## アーキテクチャ要件

### 4層アーキテクチャ準拠

- ARCH-001: UI層は Worker層とのみ Comlink RPC で通信しなければならない 🟢
- ARCH-002: Worker層は CoreDB/EphemeralDB への独占アクセス権を持たなければならない 🟢
- ARCH-003: プラグインは AOP ノードシステムに準拠しなければならない 🟢
- ARCH-004: 作業コピーパターンにより編集操作を実装しなければならない 🟢

### パッケージ構造

- ARCH-005: `/packages/plugins/stylemap/` 配下に実装しなければならない 🟡
- ARCH-006: 型定義は `/packages/core/` で共有しなければならない 🟡
- ARCH-007: API契約は `/packages/api/` で定義しなければならない 🟡
- ARCH-008: UI コンポーネントは `/packages/ui-plugins/` で実装しなければならない 🟡

## 互換性マトリックス

### MapLibre スタイルプロパティサポート

🟢 **Fill Properties:**
- `fill-color` (カラーマッピング対象)
- `fill-opacity` (数値マッピング対象)
- `fill-outline-color` (カラーマッピング対象)

🟢 **Line Properties:**
- `line-color` (カラーマッピング対象)
- `line-opacity` (数値マッピング対象)
- `line-width` (数値マッピング対象)

🟢 **Circle Properties:**
- `circle-color` (カラーマッピング対象)
- `circle-opacity` (数値マッピング対象)
- `circle-radius` (数値マッピング対象)
- `circle-stroke-color` (カラーマッピング対象)
- `circle-stroke-opacity` (数値マッピング対象)
- `circle-stroke-width` (数値マッピング対象)

### ファイル形式サポート

🟢 **サポート対象:**
- CSV (RFC 4180準拠)
- TSV (タブ区切り)
- UTF-8 エンコーディング

🔴 **サポート対象外:**
- Excel ファイル (.xlsx, .xls)
- JSON ファイル
- XML ファイル

## 移行・展開要件

### 既存システムからの移行

- MIG-001: eria-cartograph からの設計パターン継承 🟢
- MIG-002: hierarchidb アーキテクチャへの適応 🟡
- MIG-003: 既存データフォーマットとの後方互換性保持 🟡

### 段階的実装

- DEP-001: フェーズ1: 基本的なCSVインポート・カラーマッピング機能 🟡
- DEP-002: フェーズ2: 高度なフィルタリング・複数アルゴリズム対応 🟡
- DEP-003: フェーズ3: パフォーマンス最適化・大容量ファイル対応 🟡