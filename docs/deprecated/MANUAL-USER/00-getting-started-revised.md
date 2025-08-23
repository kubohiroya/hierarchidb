# HierarchiDB 利用開始ガイド（現在の実装状況）

## HierarchiDBとは

HierarchiDBは、階層構造データをブラウザ内で管理するWebアプリケーションフレームワークです。現在は開発段階にあり、基本的な階層データ管理機能が実装されています。

## 現在の実装状況

### ✅ 実装済み機能
- **TreeConsole**: 階層ツリー表示と基本操作
- **Worker/データベース**: IndexedDBによるデータ永続化
- **基本CRUD**: ノードの作成・読取・更新・削除
- **ゴミ箱**: ソフト削除と復元
- **プラグイン基盤**: プラグインシステムの基本構造

### 🚧 部分的実装
- **BaseMapプラグイン**: 基本的な地図表示のみ
- **Spreadsheetプラグイン**: データ構造のみ（UIなし）
- **StyleMap/Shapeプラグイン**: 登録のみ（機能未実装）

### ❌ 未実装
- プラグインの完全なUI
- Import/Export機能
- 高度な検索・分析機能

## 動作環境

### 必須要件
- **モダンブラウザ**: Chrome 100+、Firefox 100+、Safari 15+、Edge 100+
- **JavaScript有効**
- **Web Worker対応**
- **IndexedDB対応**

### 推奨環境
- **RAM**: 4GB以上
- **安定したインターネット接続**（初回読み込み時）

## アクセス方法

### 開発環境での起動
```bash
# リポジトリのクローン
git clone [repository-url]
cd hierarchidb

# 依存関係のインストール（pnpm必須）
pnpm install

# 開発サーバーの起動
pnpm dev
```

### 利用可能なルート
- `/treeconsole-simple` - シンプルなTreeConsoleデモ
- `/treeconsole-demo` - 完全なTreeConsoleデモ
- `/t/[treeId]/[pageNodeId]` - ツリーナビゲーション

## 実際の画面構成

### TreeConsole画面（実装済み）
```
┌─────────────────────────────────────────────────────┐
│  TreeConsole Simple Demo                            │
├─────────────────────────────────────────────────────┤
│  パンくずリスト: Root > Current Location            │
├─────────────────────────────────────────────────────┤
│  ツールバー                                         │
│  [🔍 Search] [Refresh] [Expand] [Collapse]         │
├─────────────────────────────────────────────────────┤
│  TreeTableView                                      │
│  ▼ Root                                            │
│    ▼ Folder1                                       │
│      ・Node1                                       │
│      ・Node2                                       │
│    ▶ Folder2                                       │
│    🗑️ Trash                                        │
├─────────────────────────────────────────────────────┤
│  Footer: 2 selected | 10 total                     │
└─────────────────────────────────────────────────────┘

[+] SpeedDial（右下の追加ボタン）
```

### 主要コンポーネント
- **TreeConsoleBreadcrumb**: 現在位置の表示
- **TreeTableToolbar**: 検索と操作ボタン
- **TreeTableView**: 階層データの表示
- **TreeTableFooter**: 選択状態の表示
- **SpeedDial**: 新規作成メニュー

## 基本的な使い方

### 1. ツリーの操作
- フォルダの展開/折りたたみ: 矢印アイコンをクリック
- ノードの選択: 行をクリック
- 複数選択: Ctrl/Cmdキーを押しながらクリック

### 2. 新規作成
1. 右下の「+」ボタン（SpeedDial）をクリック
2. 作成したいタイプを選択:
   - Create Folder（フォルダ）
   - Create BaseMap（地図設定）※UI未完成
   - Create StyleMap（スタイル）※UI未完成
   - Create Shape（地理データ）※UI未完成
   - Create Spreadsheet（表データ）※UI未完成

### 3. 検索
- ツールバーの検索ボックスに入力
- リアルタイムでフィルタリング

## 注意事項

### 開発段階の制限
1. **機能の不完全性**: 多くのプラグイン機能はUIが未実装
2. **エラーの可能性**: 予期しないエラーが発生する可能性
3. **データの扱い**: 重要なデータの保存には使用しないでください

### ブラウザの要件
- プライベートブラウジングモードでは動作しない可能性
- IndexedDBの容量制限に注意

## トラブルシューティング

### Worker初期化エラー
```
Failed to initialize WorkerAPIClient
```
**解決方法:**
- ブラウザのJavaScriptが有効か確認
- Web Worker対応ブラウザか確認
- ブラウザコンソールで詳細エラーを確認

### データが表示されない
**確認事項:**
- IndexedDBが有効か（開発者ツール > Application > IndexedDB）
- ブラウザのストレージ容量
- コンソールにエラーが出ていないか

### プラグイン機能が動作しない
**現状:**
- ほとんどのプラグインUIは未実装
- 基本的なノード作成のみ可能
- 詳細な編集機能は開発中

## 開発者向け情報

詳細な技術情報については以下を参照：
- [開発レポート](../REPORT/INDEX.md)
- [APIリファレンス](../MANUAL/03-api-reference.md)
- [ソースコード](https://github.com/[repository])

## 次のステップ

現在実装済みの機能を試すには：
1. [基本操作（実装済み機能）](./01-basic-operations-revised.md)を参照
2. TreeConsoleデモページで実際の動作を確認
3. 開発者ツールのコンソールで内部動作を観察