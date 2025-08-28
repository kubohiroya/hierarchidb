# TDD Redフェーズ: 認証UIコンポーネント

## テスト設計内容

### 追加テストケース（10個）

#### 1. 複数プロバイダーの同時認証防止 🟡

**信頼性レベル**: 参考実装から推測した妥当な機能

```typescript
it('複数プロバイダーの同時認証を防ぐ', async () => {
  const service = AuthService.getInstance();
  const firstAuth = service.authenticate();
  const secondAuth = service.authenticate();
  await expect(secondAuth).rejects.toThrow('Authentication already in progress');
});
```

**期待される失敗**: 同時認証防止機能が未実装

#### 2. プロバイダー固有設定の適用 🟡

**信頼性レベル**: 参考実装を基に推測

```typescript
it('プロバイダー固有の設定を適用できる', () => {
  const microsoftConfig = { /* Microsoft用設定 */ };
  AuthService.initialize(microsoftConfig);
  const authUrl = /* 生成されたURL */;
  expect(authUrl).toContain('login.microsoftonline.com');
});
```

**期待される失敗**: プロバイダー切り替え機能が未実装

#### 3. 認証状態の追跡 🔴

**信頼性レベル**: 元の資料にない推測

```typescript
it('認証状態を追跡できる', () => {
  const service = AuthService.getInstance();
  expect(service.isAuthenticating()).toBe(false);
  expect(service.isAuthenticated()).toBe(false);
});
```

**期待される失敗**: `isAuthenticating()` と `isAuthenticated()` メソッドが未定義

#### 4. トークン有効期限管理 🟡

**信頼性レベル**: OAuth2標準から推測

```typescript
it('トークンの有効期限を管理できる', async () => {
  const service = AuthService.getInstance();
  // トークン取得後
  expect(service.isTokenValid()).toBe(true);
  // 期限切れ後
  await new Promise(resolve => setTimeout(resolve, 2000));
  expect(service.isTokenValid()).toBe(false);
});
```

**期待される失敗**: `isTokenValid()` メソッドが未定義

#### 5. PKCEサポート 🟢

**信頼性レベル**: OAuth2.0標準仕様に基づく

```typescript
it('PKCE (Proof Key for Code Exchange) をサポートする', async () => {
  const pkceConfig = { ...mockConfig, usePKCE: true };
  AuthService.initialize(pkceConfig);
  const authUrl = /* 生成されたURL */;
  expect(authUrl).toContain('code_challenge=');
  expect(authUrl).toContain('code_challenge_method=S256');
});
```

**期待される失敗**: PKCEパラメータが生成されない

#### 6. nonceパラメータによるリプレイ攻撃防止 🟢

**信頼性レベル**: OIDC標準仕様に基づく

```typescript
it('nonce パラメータでリプレイ攻撃を防ぐ', async () => {
  const firstNonce = /* 最初の認証のnonce */;
  const secondNonce = /* 2回目の認証のnonce */;
  expect(firstNonce).not.toBe(secondNonce);
});
```

**期待される失敗**: nonceパラメータが生成されない

#### 7. ネットワークエラー時の自動リトライ 🟡

**信頼性レベル**: 一般的なベストプラクティスから推測

```typescript
it('ネットワークエラー時に自動リトライする', async () => {
  const service = AuthService.getInstance();
  service.setMaxRetries(3);
  const authPromise = service.authenticateWithRetry();
  await expect(authPromise).resolves.toBeDefined();
});
```

**期待される失敗**: `setMaxRetries()` と `authenticateWithRetry()` メソッドが未定義

#### 8. エラー後の状態クリーンアップ 🟢

**信頼性レベル**: 既存のテストコードから確認済み

```typescript
it('エラー後に状態を正しくクリーンアップする', async () => {
  await expect(service.authenticate()).rejects.toThrow('Popup blocked');
  expect(mockClearInterval).toHaveBeenCalled();
  expect(mockRemoveEventListener).toHaveBeenCalled();
});
```

**期待される失敗**: 部分的に実装済みだが完全でない可能性

#### 9. カスタムスコープの設定 🟡

**信頼性レベル**: OAuth2標準から推測

```typescript
it('カスタムスコープを設定できる', () => {
  const service = AuthService.getInstance();
  service.setCustomScopes(['custom:read', 'custom:write']);
  const authUrl = /* 生成されたURL */;
  expect(authUrl).toContain('custom%3Aread');
});
```

**期待される失敗**: `setCustomScopes()` メソッドが未定義

#### 10. リフレッシュトークンの自動更新 🟡

**信頼性レベル**: OAuth2標準から推測

```typescript
it('リフレッシュトークンで自動更新する', async () => {
  const service = AuthService.getInstance();
  // トークン期限切れ前に自動更新
  const newToken = await service.refreshToken();
  expect(newToken).toBeDefined();
});
```

**期待される失敗**: `refreshToken()` メソッドが未定義

## テスト実行コマンド

```bash
# AuthServiceのテスト実行
pnpm --filter @hierarchidb/ui-auth test src/services/__tests__/AuthService.test.ts

# UserAvatarMenuのテスト実行
pnpm --filter @hierarchidb/ui-auth test src/components/__tests__/UserAvatarMenu.test.tsx

# MultiAuthContextのテスト実行
pnpm --filter @hierarchidb/ui-auth test src/contexts/__tests__/MultiAuthContext.test.tsx

# すべての認証関連テスト実行
pnpm --filter @hierarchidb/ui-auth test
```

## 期待される失敗メッセージ

1. `TypeError: service.isAuthenticating is not a function`
2. `TypeError: service.isAuthenticated is not a function`
3. `TypeError: service.isTokenValid is not a function`
4. `TypeError: service.setMaxRetries is not a function`
5. `TypeError: service.authenticateWithRetry is not a function`
6. `TypeError: service.getStoredCodeVerifier is not a function`
7. `TypeError: service.setCustomScopes is not a function`
8. `TypeError: service.refreshToken is not a function`
9. `Error: Authentication already in progress` が発生しない
10. URLにPKCEやnonceパラメータが含まれない

## コメントの説明

各テストケースには以下の日本語コメントを含めています：

1. **【テスト目的】**: テストで確認したい機能の概要
2. **【テスト内容】**: 具体的なテスト手順
3. **【期待される動作】**: 正常動作時の結果
4. **信頼性レベル**: 
   - 🟢 元の資料や標準仕様に基づく
   - 🟡 参考実装や一般的なプラクティスから推測
   - 🔴 完全な推測
5. **【結果検証】**: expectステートメントで確認する内容
6. **【確認内容】**: 各アサーションの具体的な検証ポイント

これらのコメントにより、テストの意図が明確になり、実装フェーズで何を作るべきかが明確になります。