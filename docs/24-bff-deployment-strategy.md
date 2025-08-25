# BFF Deployment Strategy for HierarchiDB

## 現在の状況

HierarchiDBプロジェクトは現在、eria-cartograph用のBFFを借用していますが、独立したBFFをデプロイする必要があります。

## デプロイ戦略

### オプション1: 新規BFFデプロイ（推奨）✅

**理由**：
- eria-cartographプロジェクトへの影響を避ける
- HierarchiDB専用の設定とセキュリティポリシー
- 独立したOAuth App管理
- 将来的な拡張性

**手順**：

#### 1. 新しいOAuth Appの作成

**Google OAuth**:
```
1. Google Cloud Consoleで新しいプロジェクト作成
   - プロジェクト名: HierarchiDB
   
2. OAuth 2.0 Client ID作成
   - 名前: HierarchiDB Web Client
   - リダイレクトURI:
     - https://hierarchidb-bff.kubohiroya.workers.dev/auth/callback
     - https://hierarchidb-bff.kubohiroya.workers.dev/auth/google/callback
```

**GitHub OAuth**:
```
1. GitHub Developer Settingsで新しいOAuth App作成
   - アプリ名: HierarchiDB
   - コールバックURL: https://hierarchidb-bff.kubohiroya.workers.dev/auth/github/callback
```

#### 2. wrangler.hierarchidb.tomlの更新

```bash
cd packages/backend/bff

# 新しいClient IDを設定
vi wrangler.hierarchidb.toml
# GOOGLE_CLIENT_ID = "新しいGoogle Client ID"
# GITHUB_CLIENT_ID = "新しいGitHub Client ID"
```

#### 3. シークレットの設定

```bash
# Google Client Secret
wrangler secret put GOOGLE_CLIENT_SECRET --config wrangler.hierarchidb.toml --env production
# 新しいGoogle Client Secretを入力

# GitHub Client Secret  
wrangler secret put GITHUB_CLIENT_SECRET --config wrangler.hierarchidb.toml --env production
# 新しいGitHub Client Secretを入力

# JWT Secret（新規生成）
wrangler secret put JWT_SECRET --config wrangler.hierarchidb.toml --env production
# openssl rand -base64 32 で生成した値を入力
```

#### 4. KVネームスペースの作成（オプション）

```bash
# レート制限用
wrangler kv:namespace create "RATE_LIMIT" --config wrangler.hierarchidb.toml
# 出力されたIDをwrangler.tomlに追加

# 監査ログ用
wrangler kv:namespace create "AUDIT_LOG" --config wrangler.hierarchidb.toml
# 出力されたIDをwrangler.tomlに追加

# セッション管理用
wrangler kv:namespace create "SESSION" --config wrangler.hierarchidb.toml
# 出力されたIDをwrangler.tomlに追加
```

#### 5. デプロイ

```bash
# 本番環境へデプロイ
wrangler deploy --config wrangler.hierarchidb.toml --env production

# または、デプロイスクリプト使用
./deploy-hierarchidb.sh
```

#### 6. フロントエンド設定の更新

既存の環境変数は既に更新済み：
- `scripts/env/development.sh`: hierarchidb-bffを指定済み
- `scripts/env/production.sh`: hierarchidb-bffを指定済み

### オプション2: 既存BFFの拡張（非推奨）❌

**理由**：
- eria-cartographへの影響リスク
- 設定の複雑化
- セキュリティポリシーの混在

## 移行チェックリスト

### Phase 1: 準備
- [ ] 新しいGoogle OAuth App作成
- [ ] 新しいGitHub OAuth App作成
- [ ] Client ID/Secretの取得
- [ ] wrangler.hierarchidb.tomlの更新

### Phase 2: デプロイ
- [ ] KVネームスペース作成（オプション）
- [ ] シークレット設定
- [ ] BFFデプロイ
- [ ] ヘルスチェック確認

### Phase 3: テスト
- [ ] 開発環境での認証テスト
- [ ] 本番環境での認証テスト
- [ ] エラーログの確認
- [ ] レート制限の動作確認

### Phase 4: 移行完了
- [ ] ドキュメント更新
- [ ] チームへの通知
- [ ] 旧設定のクリーンアップ（必要に応じて）

## セキュリティ考慮事項

### 新規デプロイの利点
1. **独立したシークレット管理**
   - HierarchiDB専用のJWT_SECRET
   - 独立したOAuth Client Secrets
   
2. **カスタムセキュリティポリシー**
   - HierarchiDB専用のレート制限
   - 専用の監査ログ
   - カスタムCORS設定

3. **環境分離**
   - eria-cartographとの完全な分離
   - 独立したメンテナンススケジュール

## トラブルシューティング

### よくある問題

1. **デプロイエラー**
   ```bash
   # ワーカー名の重複エラーの場合
   wrangler deploy --name hierarchidb-bff-unique --config wrangler.hierarchidb.toml
   ```

2. **OAuth設定ミス**
   - リダイレクトURIの完全一致を確認
   - Client ID/Secretの正確性を確認

3. **CORS エラー**
   - wrangler.tomlのALLOWED_ORIGINSを確認
   - デプロイ後の反映待ち（最大60秒）

## 結論

**新規BFFデプロイ（オプション1）を強く推奨**します。

理由：
- プロジェクトの独立性
- セキュリティの向上
- 管理の簡素化
- 将来的な拡張性

既存のeria-cartograph-bffは触らずに、HierarchiDB専用のBFFをデプロイすることで、両プロジェクトが独立して運用できます。