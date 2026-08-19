# @hierarchidb/ui-auth

Last updated: 2026-04-05

Authentication UI components for HierarchiDB. Provides login screens, auth state display, etc.

OAuth callback return URL resolution is provided by `resolveAuthReturnUrl`. Its routing and
failure contract is documented in `docs/auth-callback-routing-spec.md`.

The canonical BFF token response, persisted UI session, same-tab notification, and reload
restoration contract is documented in `docs/auth-session-contract.md` and implemented by
`AuthSessionStorage`.

## License

MIT
