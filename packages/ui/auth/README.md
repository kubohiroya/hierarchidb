# @hierarchidb/ui-auth

UI auth components, contexts, and services (OIDC/Google/BFF/multi-provider) plus popup-detection and auth-recovery hooks.

## Directory layout
```
components/   Auth dialogs/prompts/forms/avatar, OAuth callback handler
contexts/     OIDCAuthProvider, GoogleAuthProvider, MultiAuthProvider, SimpleBFFAuthProvider
hooks/        useAuth, getIdToken
services/     AuthService, BFFAuthService, AuthCallbackHandler, PopupDetectionService, UIAuthRecoveryClient
types/        AuthUser, AuthProviderType/Config/ContextType
index.ts      Public exports
```

## Key exports
- Components: `AuthProviderDialog/Options/Prompt`, `AuthRequiredDialog`, `AuthErrorBoundary/Listener`, `LoginForm`, `OAuthCallback`, `UserAvatar/UserAvatarMenu`, `AuthMethodSettings`.
- Contexts/hooks: `OIDCAuthProvider`/`useOIDCAuth`, `GoogleAuthProvider`/`useGoogleAuth`, `MultiAuthProvider`/`useMultiAuth`, `SimpleBFFAuthProvider`/`useSimpleBFFAuth`, `useAuth`, `getIdToken`.
- Services: `AuthService` (provider-agnostic), `BFFAuthService`, `AuthCallbackHandler`, `PopupDetectionService`, `registerAuthUIHandlers` (ties into `@hierarchidb/auth-recovery` notifications).
- Types: `AuthUser`, `AuthProviderType`, `AuthProviderConfig`, `AuthContextType`, `BFFAuthResponse`, `BFFSignInOptions`, `BFFUser`.

## Consumers / usage
- App shell provides providers (OIDC/Google/BFF) at the root; plugin UIs consume `useAuth`/`useMultiAuth`.
- `@hierarchidb/auth-recovery` uses `registerAuthUIHandlers` to bridge 401 recovery prompts.
- User menu/profile components in `@hierarchidb/ui-usermenu` reuse `UserAvatar` and `useAuth`.

## Notes
- Supports popup/redirect flows; `PopupDetectionService` falls back to redirect on blocked popups.
- Token retrieval via `getIdToken`; silent renew available for OIDC contexts.
