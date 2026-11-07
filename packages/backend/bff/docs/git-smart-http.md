# TurboWarp Plus Editor Git proxy

This optional contract implements mode B of [TurboWarp Plus Editor #315](https://github.com/kubohiroya/turbowarp-plus-editor/issues/315). It uses GitHub App web authorization, a BFF-owned Durable Object, and a Git-only route in the CORS Worker.

## Login and session

1. The Editor POSTs JSON `{remote, write}` to the BFF at `/v1/git-auth/start`. The BFF returns an authorization URL and an opaque login ticket. The Editor keeps the ticket in memory and opens the authorization URL.
2. GitHub calls `/v1/git-auth/callback`. The BFF atomically consumes the OAuth state before exchanging the code using PKCE. It validates the selected repository ID and requested permission. The callback returns a plain confirmation.
3. With the login ticket as its Bearer, the Editor polls `GET /v1/git-auth/session` on the BFF. A pending login returns 202. A completed login returns the Cloudflare connection, account, proxy Bearer, and expiration in Unix milliseconds. The ticket is origin-bound and can obtain a renewed five-minute proxy Bearer until the login expires. The login lasts at most eight hours.
4. `DELETE /v1/git-auth/session` with the login ticket revokes the server-side record. In-flight calls recheck the record before authorization completes.

GitHub access and refresh tokens and the current proxy secret are encrypted with AES-GCM in the BFF's Durable Object. The BFF serializes token rotation. The Git Worker accesses authorization through a Durable Object binding. The public BFF endpoints return display information and the proxy session, keeping upstream credentials in the Worker boundary.

## Proxy

The Git-only routes are `GET /v1/git/<owner>/<repo>.git/info/refs?service=git-upload-pack|git-receive-pack` and `POST /v1/git/<owner>/<repo>.git/git-upload-pack|git-receive-pack`. The proxy verifies the exact HTTPS origin of its own deployment, the request origin, the Bearer, the repository ID, and the operation. The allowed caller origins are explicit. To enable Desktop, add `tw-editor://.` to both origin lists. An allowed OPTIONS returns 204 with the requested method and permitted headers. Authenticated Git responses and errors include the exact allowed origin and are marked `no-store`.

The proxy creates a new GitHub HTTP Basic authorization header, preserves Smart HTTP binary streams, and checks the declared POST length against the 32 MiB limit. It validates at most one discovery redirect to the same GitHub repository ID and service, and refuses RPC redirects. Error bodies use `{code, requestId}`.

## Enable and roll back

Configure `GIT_ALLOWED_ORIGINS` and the exact HTTPS `GIT_PROXY_ORIGIN` in both Workers. In the BFF, configure `GIT_GITHUB_CLIENT_ID`, `GIT_GITHUB_CLIENT_SECRET`, `GIT_GITHUB_REDIRECT_URI` ending in `/v1/git-auth/callback`, and `GIT_SESSION_KEY` as a secret with 32 random bytes encoded as 64 hex digits. Register `GitSession` as a SQLite-backed Durable Object in the BFF. Bind it as `GIT_SESSIONS` in the BFF and in the Git Worker, where the binding names the BFF script. These bindings are optional and the dedicated routes fail closed when they are absent.

Roll back by removing the Git routes' bindings and revoking the affected session records. The existing BFF login routes and generic CORS proxy keep their own configuration.
