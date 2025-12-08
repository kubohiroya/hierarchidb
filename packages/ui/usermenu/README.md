# @hierarchidb/ui-usermenu

User menu that integrates auth, theme toggle, language selection, and dev utilities.

## Directory layout
```
components/UserLoginButton.tsx  Main menu button + dialogs/menus
index.ts                        Public export
```

## Key exports
- `UserLoginButton` — shows avatar/login button; menu items for sign-in/out, theme (light/dark/system), language (system/en/ja), cache clear dialog, auth provider selection dialog.

## Consumers / usage
- Used in app shell headers; relies on providers from `@hierarchidb/ui-auth` and `@hierarchidb/ui-theme`.
- Emits custom events `hierarchidb-theme-change` / `hierarchidb-language-change` when toggled; callers can listen if needed.

## Dependencies
- Auth: `@hierarchidb/ui-auth` (`useAuth`, `AuthProviderDialog`, `UserAvatar`).
- Theme: `@hierarchidb/ui-theme` `ThemeContext`.
- MUI icons/components.
