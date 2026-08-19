# Auth callback return URL routing specification

最終更新: 2026-08-19

## 目的

OAuth callback 後の return URL 解決契約を一意に定める。GitHub Pages の hash routing、
通常の browser routing、app base path の有無にかかわらず、callback 実装ごとの URL
組み立て差異を許容しない。

## SSOT

- URL 解決関数: `packages/ui/auth/src/services/resolveAuthReturnUrl.ts`
- app callback: `app/src/router/routes/auth/auth.callback.tsx`
- 公開 UI callback: `packages/ui/auth/src/components/useOAuthCallbackView.ts`

app callback と公開 UI callback は、必ず `resolveAuthReturnUrl` を使用する。各 callback に
同等の path / hash 正規化処理を複製してはならない。

## 入力契約

`resolveAuthReturnUrl(rawUrl, options)` は次を受け取る。

- `rawUrl`: 認証開始時に `auth_return_url` へ保存した非空の absolute URL または
  app-relative route。
- `currentOrigin`: callback 実行中の `window.location.origin` と同じ形式の absolute origin。
- `appBasePath`: Vite の `BASE_URL`。`/` で始まり、query / hash を含まない。
- `routerMode`: `browser` または `hash`。

入力契約違反は例外にする。`/` への丸め、既定値補完、別 routing mode としての再解釈は
行わない。`auth_return_url` が存在しない場合も callback error として可視化する。

## 解決規則

| 条件 | 結果 |
| --- | --- |
| origin が異なる | external URL として absolute URL を維持する |
| hash mode かつ `#/` hash が存在する | pathname / pre-hash query を結合せず hash 全体を使う |
| hash mode かつ hash がない | app base path を除いた pathname と query を `#/...` に変換する |
| browser mode | app base path を除いた pathname、query、fragment を使う |
| app-relative route | app base path が付いていない route として受け入れる |
| absolute same-origin pathname が app base path 外 | 契約違反として失敗する |
| hash mode の fragment が `#/` で始まらない | 契約違反として失敗する |
| HTTP(S) 以外の URL | 契約違反として失敗する |

GitHub Pages の基準 fixture:

```text
input:
https://kubohiroya.github.io/hierarchidb/#/t/r/90d6c659-58f2-4912-b6d5-96bc5dd7d4f2/shape/edit/normal/5

resolved internal target:
#/t/r/90d6c659-58f2-4912-b6d5-96bc5dd7d4f2/shape/edit/normal/5
```

base pathname と hash route を結合しないため、node ID や app base path は重複しない。

## Navigation responsibility

本仕様は return URL の解決までを対象とする。解決後の SPA navigation、hard redirect、
timeout、callback 画面からの離脱確認は Issue #818 の責務とする。ただし hash target を
TanStack Router の browser path として渡してはならない。

## 検証

- `packages/ui/auth/src/services/__tests__/resolveAuthReturnUrl.unit.test.ts`
- `pnpm -w turbo run test --filter @hierarchidb/ui-auth`
- `pnpm -w turbo run typecheck --filter @hierarchidb/ui-auth`
- `pnpm -w turbo run typecheck --filter @hierarchidb/app`
- `pnpm -w turbo run build --filter @hierarchidb/app`

実 OAuth / GitHub Pages での callback 画面離脱は #818 の navigation 契約と合わせて確認する。
