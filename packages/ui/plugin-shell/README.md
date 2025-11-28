# @hierarchidb/ui-shell

Aggregated facade that bundles the UI-facing packages `@hierarchidb/app` consumes.
See `docs/architecture/app-dependency-bundles.md` for the full dependency map.

All imports should go through sub-paths rather than referencing the original
packages directly:

- `@hierarchidb/ui-shell/components`
- `@hierarchidb/ui-shell/plugin-ui-host`
- `@hierarchidb/ui-shell/ui-auth`
- `@hierarchidb/ui-shell/ui-dialog`
- `@hierarchidb/ui-shell/ui-icon`
- `@hierarchidb/ui-shell/ui-i18n`
- `@hierarchidb/ui-shell/ui-layout`
- `@hierarchidb/ui-shell/ui-map`
- `@hierarchidb/ui-shell/ui-navigation`
- `@hierarchidb/ui-shell/ui-routing`
- `@hierarchidb/ui-shell/ui-theme`
- `@hierarchidb/ui-shell/ui-tour`
- `@hierarchidb/ui-treeconsole-base`
- `@hierarchidb/ui-shell/ui-treeconsole-breadcrumb`
- `@hierarchidb/ui-treeconsole-toolbar`
- `@hierarchidb/ui-shell/ui-treeconsole-treetable`
- `@hierarchidb/ui-shell/ui-usermenu`

The root export exposes `UIShellPackages` so tooling can inspect the bundle membership.
