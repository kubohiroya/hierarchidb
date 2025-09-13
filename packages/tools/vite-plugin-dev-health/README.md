# @hierarchidb/tools-vite-plugin-dev-health

Dev-time Vite plugin that detects dependency drift (lockfile vs node_modules, missing deps) and surfaces build/HMR health to the browser via a lightweight banner and console messages.

## Why

During long-running `vite dev`, dependency changes can leave the server running an old, last-successful bundle without obvious warning (e.g., missing installs, lockfile updated). This plugin emits a small client-side signal so you notice immediately.

## Features

- Detects when your lockfile is newer than `node_modules` (likely needs install)
- Detects missing dependencies by attempting to resolve declared deps
- Pushes updates over Vite WS and exposes a virtual module `virtual:dev-health`
- Pairs well with a tiny client script to render a non-intrusive banner

## Usage

Install in a monorepo workspace or project, then add to your Vite config (dev only):

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import devHealthPlugin from '@hierarchidb/tools-vite-plugin-dev-health';

export default defineConfig({
  plugins: [devHealthPlugin()],
});
```

In your client entry (dev only), import a small helper that listens for updates and shows UI (you can roll your own or copy the example from the app package):

```ts
if (import.meta.env.DEV) import('./dev-health-client');
```

TypeScript can be told about the virtual module by adding a declaration:

```ts
declare module 'virtual:dev-health' {
  export const status: any;
  const _default: any;
  export default _default;
}
```

## Notes

- The plugin is dev-only (`apply: 'serve'`) and does nothing in production.
- Detection is heuristic but practical; it won’t mutate your system (no auto-install), it only warns.

