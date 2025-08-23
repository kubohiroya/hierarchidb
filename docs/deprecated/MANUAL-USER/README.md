# HierarchiDB 利用者マニュアル

## ⚠️ 重要なお知らせ

このアプリケーションは現在開発段階にあり、多くの機能が未実装または部分的な実装となっています。

## 📚 ドキュメント構成

### 現在の実装状況を反映した最新版
- **[00-getting-started-revised.md](./00-getting-started-revised.md)** - 利用開始ガイド（実装済み機能のみ）
- **[01-basic-operations-revised.md](./01-basic-operations-revised.md)** - 基本操作（実際に動作する機能）

### 将来的な機能を含む参考資料
以下のドキュメントには未実装の機能が含まれています：
- [02-project-management.md](./02-project-management.md) - プロジェクト管理（計画中）
- [03-map-features.md](./03-map-features.md) - 地図機能（部分実装）
- [04-spreadsheet-features.md](./04-spreadsheet-features.md) - 表データ管理（UI未実装）

## 🚀 実装済み機能

### ✅ 利用可能
- **TreeConsole**: 階層ツリーの表示と基本操作
- **データ永続化**: IndexedDBによる自動保存
- **基本CRUD**: ノードの作成・読取・更新・削除
- **ゴミ箱**: ソフト削除と復元機能

### 🚧 部分実装
- **BaseMapプラグイン**: 地図表示のみ（MapLibre GL）
- **プラグインシステム**: 基盤のみ（UIは大部分が未実装）

### ❌ 未実装
- プラグインの編集UI
- Import/Export機能
- 高度な検索・フィルタリング
- 表計算機能
- 地理データ処理

## 🎯 現在利用可能なデモ

### アクセス可能なルート
```
/treeconsole-simple   - シンプルなTreeConsoleデモ
/treeconsole-demo     - 完全版TreeConsoleデモ
/t/{treeId}/{nodeId}  - ツリーナビゲーション（実験的）
```

## 📋 動作要件

### 必須
- モダンブラウザ（Chrome 100+、Firefox 100+、Safari 15+、Edge 100+）
- JavaScript有効
- Web Worker対応
- IndexedDB対応

### 非対応
- Internet Explorer
- プライベートブラウジングモード（一部機能）

## 🔧 開発環境での起動

```bash
# 依存関係のインストール
pnpm install

# 開発サーバー起動
pnpm dev

# ブラウザでアクセス
http://localhost:5173/treeconsole-simple
```

## ⚠️ 既知の問題

1. **プラグインUI未実装**: BaseMap以外のプラグインはUIがほぼ未実装
2. **エラーハンドリング**: 一部の操作でエラーが発生する可能性
3. **パフォーマンス**: 大量データでの動作は未検証

## 📝 フィードバック

問題や要望がある場合は、開発チームまでご連絡ください。

## 🔍 詳細情報

### 開発者向け
- [技術仕様](../MANUAL/INDEX.md)
- [開発レポート](../REPORT/INDEX.md)

### ソースコード
- [GitHub Repository](#)（リンク要更新）

---

**最終更新**: 2025年1月
**バージョン**: 0.1.0-dev（開発版）