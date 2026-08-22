# @hierarchidb/tools-schemas

Last updated: 2026-04-05

Schema definition tools for HierarchiDB. Provides JSON Schema / TypeScript type definition generation and validation.

## Plugin Manifest Schema

`plugin-manifest.schema.json` defines the minimum public plugin manifest contract. The
schema requires `id`, `nodeType`, and `version`, while root and nested extension areas
remain intentionally permissive. Schema tests use Ajv strict mode with no coercion,
defaults, or additional-property removal.

## License

MIT
