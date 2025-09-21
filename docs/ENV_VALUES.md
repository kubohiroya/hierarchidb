# Environment Variables (Frontend / Vite)

This document lists all environment variables used by the browser application and frontend packages (backend and tooling excluded). Variables must be prefixed with `VITE_` to be exposed to the client bundle and accessed via `import.meta.env`.

## How To Configure
- Files: place key/value pairs in `.env`, `.env.development`, `.env.production`, etc.
- Access in code: `import.meta.env.VITE_SOME_KEY`
- Build-time only values: `import.meta.env.MODE`, `import.meta.env.DEV`, `import.meta.env.PROD` (provided by Vite).
- Precedence: `VITE_…` in `.env.*` → system env at build → defaults in code.

## App Routing / Base
- Name: `VITE_APP_PREFIX`
  - Meaning: App/db prefix string used in URL/database naming helpers.
  - Default: `''` (empty)
  - Example: `hierarchidb`
  - Used by: `app`, `packages/util`, node-type plugins (basemap/shape previews)
- Name: `VITE_APP_NAME`
  - Meaning: Base path name used for GitHub Pages and asset routing.
  - Default: `''`
  - Example: `hierarchidb`
  - Used by: `app` (vite/react-router config, build scripts)
- Name: `VITE_USE_HASH_ROUTING`
  - Meaning: Enable hash-based routing for static hosting.
  - Default: `true` (treated as true unless explicitly `'false'`)
  - Example: `true` | `false`
  - Used by: `app` (build scripts, router config)

## App Display / Metadata
- Name: `VITE_APP_TITLE`
  - Meaning: Application title string.
  - Default: `HierarchiDB`
  - Example: `HierarchiDB`
  - Used by: `app`
- Name: `VITE_APP_DESCRIPTION`
  - Meaning: Short description of the application.
  - Default: Predefined marketing sentence
  - Example: `High-performance tree-structured data management framework`
  - Used by: `app`
- Name: `VITE_APP_DETAILS`
  - Meaning: Extended description text.
  - Default: Predefined sentence
  - Used by: `app`
- Name: `VITE_APP_LOGO`
  - Meaning: Logo asset path.
  - Default: `logo.png`
  - Used by: `app`
- Name: `VITE_APP_FAVICON`
  - Meaning: Favicon asset path.
  - Default: `favicon.svg` (some paths use `logo.favicon.png` as fallback)
  - Used by: `app`
- Name: `VITE_APP_THEME`
  - Meaning: UI theme.
  - Default: `light`
  - Example: `light` | `dark`
  - Used by: `app`
- Name: `VITE_APP_LOCALE`
  - Meaning: Default UI locale.
  - Default: `en-US`
  - Used by: `app`
- Name: `VITE_APP_ATTRIBUTION`
  - Meaning: Credit string shown in UI (optional).
  - Default: `''`
  - Used by: `app`
- Name: `VITE_APP_HOMEPAGE`
  - Meaning: Project/landing URL shown in UI.
  - Default: `https://github.com/kubohiroya/hierarchidb`
  - Used by: `app`

## BFF / Auth (Frontend-side config)
- Name: `VITE_BFF_BASE_URL`
  - Meaning: Base URL for the BFF (without `/auth` suffix).
  - Default: `http://localhost:8787`
  - Used by: `app`, `packages/ui/auth`
- Name: `VITE_OIDC_AUTHORITY`
  - Meaning: OIDC provider authority URL.
  - Default: `''`
  - Used by: `packages/ui/auth`
- Name: `VITE_OIDC_CLIENT_ID`
  - Meaning: OIDC public client ID.
  - Default: `''`
  - Used by: `packages/ui/auth`
- Name: `VITE_OIDC_CLIENT_SECRET`
  - Meaning: OIDC client secret (if public client uses it; often empty in SPAs).
  - Default: `''`
  - Used by: `packages/ui/auth`
- Name: `VITE_OIDC_SCOPE`
  - Meaning: OIDC scopes for login.
  - Default: `openid profile email`
  - Used by: `packages/ui/auth`
- Name: `VITE_GOOGLE_CLIENT_ID`
  - Meaning: Google OAuth client ID.
  - Default: `''`
  - Used by: `packages/ui/auth`
- Name: `VITE_GITHUB_CLIENT_ID`, `VITE_GITHUB_CLIENT_SECRET`
  - Meaning: GitHub OAuth app credentials (secret typically not required in SPA).
  - Default: `''`
  - Used by: `packages/ui/auth`
- Name: `VITE_MICROSOFT_CLIENT_ID`, `VITE_MICROSOFT_CLIENT_SECRET`
  - Meaning: Microsoft identity platform credentials.
  - Default: `''`
  - Used by: `packages/ui/auth`

## Worker / Rendering Adapters
- Name: `VITE_WORKERAPI_LOG`
  - Meaning: Enable verbose Worker API logs in browser console.
  - Default: off
  - Example: `1`
  - Used by: `app`
- Name: `VITE_MAP_ADAPTER_MAPLIBRE_PKG`
  - Meaning: Override MapLibre package name for lazy import in adapter.
  - Default: `maplibre-gl`
  - Used by: `@hierarchidb/map-adapter`
- Name: `VITE_MAP_ADAPTER_DECK_PKG`
  - Meaning: Override deck.gl package name for lazy import in adapter.
  - Default: `deck.gl`
  - Used by: `@hierarchidb/map-adapter`

## Plugin-specific Feature Flags
- Name: `VITE_LOCATION_TABULAR`
  - Status: Deprecated（ロケーションプラグインで常時有効化されたため無視されます）。
- Name: `VITE_WORKER_FEATURE_ROUTE_SEAROUTE`
  - Status: Deprecated（Searoute エンジンは常時有効化され、値は無視されます）。
- Name: `VITE_ROUTE_SEAROUTE_PKG`
  - Meaning: Searoute implementation package to prefer (`searoute` or `searoute-js`).
  - Default: not set (runtime tries `searoute` then `searoute-js`)
  - Used by: `@hierarchidb/plugins-route-plugin`

## Other Vite Env Keys
- `import.meta.env.MODE`: build mode (`development` / `production` / custom)
- `import.meta.env.DEV`: boolean, true in dev server
- `import.meta.env.PROD`: boolean, true in production build

## Notes
- Only variables prefixed with `VITE_` are exposed to the client bundle. Non-prefixed `process.env.*` is not available in browser code.
- Backend/services and local tools may use non-`VITE_` variables; those are out of scope for this document.
- Several defaults also exist in code paths (e.g., fallback asset names) and are noted above.
