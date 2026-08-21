# Playwright E2E authentication specification

最終更新: 2026-08-21

## 目的

通常のPlaywright E2Eで、実OAuth accountや期限付きsessionに依存せず、製品のログイン開始、
OAuth callback、session検証・保存、認証済みUIまでを決定論的に検証する。

## SSOT

- E2E fixture: `e2e/fixtures/canonicalAuthFixture.ts`
- E2E URL構築: `playwright.config.ts` と `e2e/utils/test-helpers.ts`
- 製品session契約: `docs/auth-session-contract.md`
- 製品callback: `app/src/router/routes/auth/auth.callback.tsx`
- session検証・保存: `packages/ui/auth/src/services/AuthSessionStorage.ts`
- BFF contract test: `packages/backend/bff/tests/`

## 正規フロー

1. Playwrightが製品のlogin routeを開く。
2. テストが実際のprovider buttonを操作する。
3. 製品の `BFFAuthService` がprovider、PKCE verifier、return URLを保存する。
4. fixtureが外部境界の `authorize` を受け、アプリのcallbackへauthorization code付きでredirectする。
5. 製品callbackが `BFFAuthService.handleCallback()` を実行する。
6. fixtureが `token` requestのmethod、provider、code、PKCE verifier、redirect URIを検証する。
7. fixtureが現行BFF contractに適合するstateless token responseを返す。
8. 製品の `AuthSessionStorage` が完全なsessionを保存し、session変更eventを通知する。
9. fixtureが保存済みtokenと同じBearer tokenで `verify` の成功を検証する。
10. E2Eは認証済みUIと必要なworker動作を検証する。

mockするのはOAuth/BFFのnetwork境界だけである。callback route、session persistence、React consumer、
UI-to-worker bridgeをlocalStorage直接書込で迂回してはならない。

`playwright.config.ts` とURL helperは、環境変数未指定時も同じ既定base path `/hierarchidb` を使用する。
不一致によるroot pathへのnavigationを許容しない。

## 禁止する認証経路

- 手動作成した `e2e/.auth/auth.json`
- `E2E_AUTH_ACCESS_TOKEN`、`E2E_AUTH_USERINFO`、`E2E_AUTH_USERINFO_B64`、
  `E2E_AUTH_REFRESH_TOKEN_ID`
- `page.addInitScript()`によるsession keyの直接書込
- 成功認証を再現するspec固有の `/auth/verify` mock
- 実ブラウザprofile、cookie、localStorage sessionの読出し・コピー
- token、cookie、userinfo全体を含むdiagnostic logまたはartifact

## 例外

401、invalid callback、session contract violationなどを目的とするnegative testは、失敗応答をtest内で
明示的にmockできる。そのmockを成功認証fixtureとして後続testへ再利用してはならない。

BFF provider exchange、JWT発行、session mode、KV behaviorはBFF package testの責務とする。
実OAuth providerを通す確認は手動smoke testであり、通常E2EやCIの前提にしない。

## Fail-fast契約

- providerがfixtureの許可値と異なる場合はHTTP 400にする。
- PKCE challengeまたはS256指定が欠けるauthorize requestを拒否する。
- token requestのcode、provider、verifier、redirect URIが欠ける場合はHTTP 400にする。
- verify requestのmethodまたはBearer tokenが契約と異なる場合はHTTP 401にする。
- token responseを既定値やlegacy fieldで補完しない。
- login、callback、session保存のどこかが失敗した場合、timeout後の継続やsession直接注入へfallbackしない。

## 検証

```bash
pnpm exec playwright test e2e/auth-flow.spec.ts --project=chromium
pnpm e2e:shape-startup
pnpm -w turbo run test --filter @hierarchidb/ui-auth --filter @hierarchidb/bff
pnpm -w turbo run typecheck --filter @hierarchidb/ui-auth --filter @hierarchidb/app --filter @hierarchidb/bff
```

## Rollback

canonical fixtureと利用側の変更を同一PR単位でrevertする。旧auth seed、実token fallback、複数の
成功認証fixtureは復元しない。
