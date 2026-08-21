# @hierarchidb/gen-iso3166-2

Last updated: 2026-04-05

ISO 3166-2 code generation and country code normalization tool. Generates conversion data between alpha-2, alpha-3, and country names. Used by shape-plugin, location-plugin, and route-plugin.

The browser entry resolves generated CSV assets from Vite's exact build `BASE_URL` in both window
and worker runtimes. The build must replace `import.meta.env.BASE_URL`; worker artifacts must not
retain a runtime lookup that falls back to the origin root for a base-prefixed deployment.

## License

MIT
