# HierarchiDB App — Keep every layered project at your fingertips

HierarchiDB is a web application designed for people who need to organise rich, hierarchical data without getting lost in tabs, spreadsheets, or GIS consoles. From project plans to geospatial assets, the app keeps everything in a single tree so you can browse, edit, and present information exactly the way your team thinks about it.

## Why HierarchiDB matters for end users
- **Navigate complex hierarchies with confidence:** Drag-and-drop folders, undo/redo any action, and rely on automatic saves to keep your structure intact while you explore ideas.
- **Work the way your data demands:** Enable plugins only when you need them—switch between maps, spreadsheets, timelines, and project nodes without changing tools.
- **Stay productive on any connection:** Once the app is loaded you can keep working offline; changes live in IndexedDB until you are ready to export or share them.
- **Collaborate without chaos:** Real-time co-editing, granular roles, and threaded comments help teams move quickly while preserving accountability.

## Feature highlights
### Structure information your way
- Build unlimited trees with folder, project, and custom plugin nodes.
- Use the breadcrumb trail, keyboard shortcuts, and quick actions to jump across deep hierarchies in seconds.
- Update properties from the detail panel and keep context with breadcrumb navigation and history tools.

### Bring specialised views to every node
- **Maps:** Combine basemaps, shapes, and styling layers to visualise locations, routes, and territories directly alongside documents.
- **Spreadsheets:** Manage tabular data with CSV/Excel import, column mapping, and formula-friendly editing without leaving the tree.
- **Linker workspaces:** Assemble curated collections of compiled assets and launch ready-to-share map views instantly.

### Keep teams aligned
- Invite teammates with role-based access, from read-only reviewers to project owners.
- Co-edit in real time with presence indicators, live cursors, and conflict resolution tools.
- Open comment threads on any node, mention stakeholders, and attach files to keep discussions in context.

### Never lose momentum
- Automatic version history gives you confidence to experiment—roll back or compare changes whenever you need.
- Import and export entire trees or selected branches in JSON, CSV, Excel, PDF, HTML, and GeoJSON formats to stay compatible with external systems.
- Configure personal settings for language, light/dark theme, and notification preferences so the workspace feels like yours.

## Quick start for new users
1. **Sign in and pick a language:** Access HierarchiDB in your browser and choose Japanese or English from the settings menu.
2. **Create your first tree:** Start a project, add folders and plugin nodes, and rearrange them with drag-and-drop.
3. **Add content with plugins:** Drop in a Linker node for a curated map view, a Spreadsheet node for data entry, or a Shape node to sketch geometry on top of a basemap.
4. **Invite collaborators:** Share access from the team panel, assign roles, and kick off a discussion with comments or mentions.
5. **Export a snapshot:** When you are ready to share outside the app, export the relevant branch in the format your audience needs.

## Everyday workflows
- **Planning and documentation:** Use project folders to keep briefs, decisions, and reference material structured and searchable.
- **Operations and fieldwork:** Combine geospatial layers with spreadsheets to track assets, routes, and site notes in one place.
- **Publishing and reviews:** Curate Linker workspaces to showcase the latest compiled maps, then hand over an export or invite reviewers for live feedback.

## Power tools when you need them
- Keyboard shortcuts for navigation, creation, and editing keep power users in flow.
- Help icons in the header link directly to documentation, so answers are always one click away.
- Runtime flags let administrators toggle experimental plugins or tailor the experience for specific teams.

## Learn more
Dive deeper with the in-app documentation located under [`app/docs/`](./app/docs/):
- [Getting started](./app/docs/01-getting-started.md)
- [Basic operations](./app/docs/02-basic-operations.md)
- [Navigation tips](./app/docs/03-navigation.md)
- [Plugin guides](./app/docs/04-folder-plugin.md) including Linker, map, and spreadsheet tools
- [Import & export workflows](./app/docs/08-import-export.md)
- [Collaboration and permissions](./app/docs/10-collaboration.md)
- [Settings, shortcuts, and troubleshooting](./app/docs/11-settings.md)

## Architecture and plugin framework (for contributors)
- **Monorepo layout:** `app/` (React + Vite shell, plugin loader, worker entry) sits alongside `packages/` (runtime services, UI host/SDK, tooling) and `plugins/` (feature packages that ship UI/worker/icon/database entries). Shared docs and scripts live in `docs/`, `config/`, and `scripts/env`.
- **Plugin registry as single source of truth:** Each plugin declares `hierarchidb.plugin` metadata in its `package.json`. Run `pnpm tools:gen-plugin-registry` to aggregate definitions into `@hierarchidb/plugin-registry` and `app/src/plugin-registry`, then UI/worker/icon/database loaders import from the same registry via `import.meta.glob` for consistent resolution.
- **UI ↔ Worker bridge:** `@hierarchidb/runtime-worker` wires plugin worker modules and Dexie stores; `@hierarchidb/plugin-ui-host` and `plugin-ui-sdk` provide MultiStep dialog scaffolding, Jotai-based working copy state, and Comlink RPC helpers. WorkerProvider injects the bridge so dialogs stay in sync without bespoke messaging.
- **Tooling baseline:** `pnpm` + `turbo` orchestrate builds/tests; `tsdown` (configured at `tsdown.config.ts`) is the unified bundler for packages and plugins. TypeScript paths point to `src/` only, with NodeNext resolution and project references to generate `.d.ts` before consumers compile.

## Development workflow
- Install and validate: `pnpm install --frozen-lockfile` → `pnpm lint && pnpm format && pnpm typecheck && pnpm test`. Use `pnpm --filter @hierarchidb/<pkg> <task>` for targeted checks (e.g., `typecheck`, `build`, `test`).
- Run locally: `pnpm dev` loads env from `scripts/env/development.sh` and starts the app worker shell; `pnpm dev:with-watch` keeps Turbo build/watch and Vite aligned. For production-like checks use `pnpm build` then `pnpm preview`.
- Plugin lifecycle: add metadata, implement `src/{ui,worker,icon,shared}` entries, regenerate the registry, and ensure loaders resolve in both UI and worker contexts. Keep feature toggles default-off and document them under `config/feature-flags.ts`.
- Tests and coverage: unit suites live beside sources in `packages/*/src/__tests__/` and `plugins/*-plugin/src/**/__tests__/`; worker flows run via `packages/runtime-worker/src/__tests__/wfl/`; Playwright smoke tests live in `e2e/`.

## Release and rollback principles
- Ship small, reversible changes behind default-off flags; record branch and task status in the linked GitHub Issue and Project before editing.
- Prefer registry regeneration + targeted package builds over ad-hoc path tweaks; if a change regresses, revert the touched files and rerun the same `pnpm` commands you used for verification.
- Default validation set before review: `pnpm lint && pnpm format && pnpm typecheck && pnpm test` (or scoped equivalents), plus any package-specific checks you touched.

## What’s next
- Stabilise NodeNext type graphs and keep `tsdown` as the single bundler across packages/plugins.
- Maintain a single plugin registry source, ensuring UI and worker loaders stay in lockstep after new plugins or schema changes.
- Keep feature flags and rollback notes current in the linked GitHub Issue, and expand tests around plugin dialogs and worker flows as new capabilities land.

HierarchiDB puts every layer of your project within reach—so you and your team can plan, analyse, and deliver without friction.
