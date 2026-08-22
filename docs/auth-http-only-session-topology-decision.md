# HttpOnly cookie session topology decision

最終更新: 2026-08-22

## Status

Decision: **No-Go for the current production topology.**

現行の production / preview / local deployment では、BFF session JWT を JavaScript-readable
Bearer token から HttpOnly cookie へ移行しない。Issue #811 の範囲では、現行 Bearer session を
`AuthSessionStorage` と UI-to-worker read-only bridge の契約で fail-closed に保つ。

この判断は cookie 化を永久に禁止するものではない。frontend と BFF を同一 site で配信する topology、
または frontend ごとの same-origin reverse proxy を production 運用できることが確定した場合だけ、
別 Issue で仕様変更と実装を開始する。

## Current topology

| Frontend | BFF | Site relation | Cookie session decision |
| --- | --- | --- | --- |
| `kubohiroya.github.io` | `*.workers.dev` | cross-site | No-Go |
| Vercel deployment domain | `*.workers.dev` | cross-site | No-Go |
| Netlify deployment domain | `*.workers.dev` | cross-site | No-Go |
| localhost | remote `*.workers.dev` | cross-site | No-Go |

same-origin reverse proxy や共通 registrable domain を使わない限り、BFF cookie は cross-site cookie として
扱われる。credentialed CORS と `SameSite=None; Secure` を設定しても、browser の第三者 cookie policy、
user setting、enterprise policy を成立条件から外せない。

## Evaluation

| Option | Decision | Reason |
| --- | --- | --- |
| A. 現行 Bearer 方式を継続 | Adopt now | 追加 infrastructure なしで全 deployment に適用できる。XSS リスクは残るため、短命 session、CSP、Trusted Types、worker bridge の fail-closed 化で縮小する。 |
| B. Frontend ごとの same-origin reverse proxy | Defer | 各 hosting provider の rewrite、preview routing、監視、deployment skew、rollback を運用設計する必要がある。GitHub Pages は同等の proxy 制御が限定的。 |
| C. 共通 registrable domain 配下へ集約 | Defer | DNS、TLS、OAuth callback、BFF route、preview URL、証明書管理の owner を決める必要がある。 |
| D. Partitioned Cookie / CHIPS | No-Go as primary auth | top-level site ごとに cookie jar が分かれるため、deployment 間 session 共有と logout/revoke の期待が変わる。未対応/制限 browser への fallback を追加できない。 |
| E. Frontend ごとの BFF deployment | Defer | secret、OAuth app callback、KV、監視、release、incident 対応が frontend 数だけ増える。 |

## Security tradeoff

HttpOnly cookie は JavaScript から session credential を読めなくするため、XSS 時の token exfiltration を
抑制できる。一方、browser が credential を自動付与するため、CSRF 対策、Origin/Fetch Metadata 検証、
credentialed CORS、cookie scope、logout/revoke の厳密な設計が必須になる。

現行 topology で cookie 化だけを先行すると、次のどちらかになるため採用しない。

- cross-site cookie に依存し、第三者 cookie policy によって login / refresh / logout が不安定になる。
- Bearer と cookie の二重 transport または fallback を追加し、認証境界が曖昧になる。

## Worker impact

SharedWorker と build pipeline は JavaScript から取得可能な Bearer token を直接読むのではなく、
UI が登録する read-only storage bridge から完全な `AuthSessionStorage` session だけを取得する。
Issue #811 はこの前提を強化する。

cookie topology を採用する場合、Worker は JWT 値を必要としない boundary へ置き換える必要がある。
その場合は、`setUiStorageBridge`、worker-side `AuthService`、external API proxy、auth-required resume
flow を同じ仕様変更 Issue で再設計する。Bearer bridge と cookie transport を同時に正規経路にしない。

## Go conditions

次のすべてが満たされるまで Go にしない。

- 全 supported frontend が same-origin proxy または同一 registrable domain 配下で BFF に到達できる。
- GitHub Pages を対象外にする場合、その product decision が明示承認されている。
- Chrome、Firefox、WebKit/Safari 相当で、第三者 cookie 許可をユーザーへ要求せず login / reload /
  refresh / logout が成立する。
- CSRF token、Origin 検証、Fetch Metadata 検証、CORS credential contract、cookie name/path/domain/samesite
  contract が仕様化されている。
- reverse proxy / DNS / TLS / OAuth callback / secret / KV / observability の owner と rollback が決まっている。
- app / SharedWorker が JWT 値を必要としない代替境界が設計されている。

## No-Go hardening items

No-Go の間は次を別 Issue 候補として扱う。

- `AuthSessionStorage` contract violation を継続して fail-closed にする。
- UI-to-worker bridge 登録を validate-before-publish に保つ。
- canonical session change 後に同一 Worker client へ bridge を再登録する。
- CSP と Trusted Types の enforcement 範囲を確認する。
- session JWT lifetime と refresh mode の運用値を documented default から逸脱させない。
- token、cookie、userinfo を diagnostic log / artifact に出力しない。

## References

- MDN: Using HTTP cookies - `https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Cookies`
- MDN: Set-Cookie header - `https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie`
- MDN: CHIPS / Partitioned cookies - `https://developer.mozilla.org/en-US/docs/Web/Privacy/Guides/Third-party_cookies/Partitioned_cookies`
- web.dev: SameSite cookies explained - `https://web.dev/articles/samesite-cookies-explained`
