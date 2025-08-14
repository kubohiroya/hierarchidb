# hierarchiidb

高汎用性フレームワーク：ツリー構造データをブラウザ環境で効率的に管理・操作

## 概要

**hierarchiidb** は、ツリー構造をもつデータをブラウザ環境で効率的かつ一貫性を保ちながら管理・操作するための高汎用性フレームワークです。UI層とWorker層を明確に分離し、Dexieを用いたIndexedDB永続化とComlink経由の非同期通信を組み合わせることで、堅牢かつ拡張性の高い構造を実現しています。

## 技術スタック

- **Frontend**: React, Material-UI, TanStack Table
- **State Management**: Dexie (IndexedDB)
- **Worker Communication**: Comlink
- **Build Tools**: Vite, Turborepo
- **Package Manager**: pnpm
- **Backend Services**: Cloudflare Workers (BFF, CORS Proxy)
- **Testing**: Vitest, Playwright

## プロジェクト構造

```
hierarchiidb/
├── packages/
│   ├── core/        # 基本データモデル・型定義
│   ├── api/         # UI-Worker間インターフェース
│   ├── commons/     # 共通ユーティリティ
│   ├── worker/      # Worker層実装
│   ├── ui/          # React UI層
│   ├── bff/         # OAuth認証サービス (Cloudflare Worker)
│   └── cors-proxy/  # CORSプロキシ (Cloudflare Worker)
├── app/             # メインアプリケーション
└── docs/            # 仕様書・ドキュメント
```

## セットアップ

### 前提条件

- Node.js >= 20.0.0
- pnpm >= 9.0.0

### インストール

```bash
# 依存関係のインストール
pnpm install

# ビルド
pnpm build

# 開発サーバー起動
pnpm dev
```

### 環境変数の設定

1. `.env.example` を `.env` にコピー
2. 必要な環境変数を設定

```bash
cp .env.example .env
```

### Cloudflare Workers のセットアップ

#### BFF (Backend for Frontend)

```bash
cd packages/bff

# wrangler.toml を作成
cp wrangler.toml.template wrangler.toml

# シークレットの設定
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put JWT_SECRET

# デプロイ
pnpm deploy
```

#### CORS Proxy

```bash
cd packages/cors-proxy

# wrangler.toml を作成
cp wrangler.toml.template wrangler.toml

# シークレットの設定
wrangler secret put BFF_JWT_SECRET

# デプロイ
pnpm deploy
```

## 開発

### 開発サーバー

```bash
# 全パッケージの開発サーバーを起動
pnpm dev

# 特定パッケージのみ
pnpm --filter @hierarchidb/core dev
```

### テスト

```bash
# 単体テスト
pnpm test

# E2Eテスト
pnpm e2e
```

### Lint & Format

```bash
# Lint
pnpm lint

# Format
pnpm format
```

## アーキテクチャ

### 4層構造

1. **UI層**: React Router / Material UI / TanStack Table
2. **Worker層**: コマンド処理、Undo/Redo、購読管理
3. **CoreDB**: 長命データ (TreeEntity, TreeNodeEntity, TreeRootStateEntity)
4. **EphemeralDB**: 短命データ (WorkingCopyEntity, TreeViewStateEntity)

### データフロー

```
UI → Comlink → Worker → EphemeralDB → CoreDB
                 ↓
            差分検出 → UI更新
```

## ライセンス

MIT

## 作者

Hiroya Kubo <hiroya@cuc.ac.jp>