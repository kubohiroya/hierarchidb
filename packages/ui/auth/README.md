# @hierarchidb/ui-auth

Last updated: 2026-08-20

Authentication UI components for HierarchiDB. Provides login screens, auth state display, etc.

OAuth callback return URL resolution is provided by `resolveAuthReturnUrl`. Its routing and
failure contract is documented in `docs/auth-callback-routing-spec.md`.
Callback route departure, timeout, and single hard-redirect behavior are provided by
`startAuthCallbackNavigation` under the same specification.

The canonical BFF token response, persisted UI session, same-tab notification, and reload
restoration contract is documented in `docs/auth-session-contract.md` and implemented by
`AuthSessionStorage`.

## License

MIT
