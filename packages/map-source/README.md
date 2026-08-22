# @hierarchidb/map-source

Last updated: 2026-04-05

Map source management package for HierarchiDB. Provides abstraction and management of MapLibre GL JS source definitions (vector tiles, raster, GeoJSON, etc.).

## FeatureCollection Schema

`featureCollectionJsonSchema` is a container-level GeoJSON check for `FeatureCollection`
payloads. It validates the public shape with Ajv strict mode and no coercion, defaults, or
additional-property removal. The schema remains permissive for GeoJSON extension fields;
provider-specific property contracts belong to the consuming plugin.

## Dependencies

`@hierarchidb/util`, `ajv`

## Related Packages

- [`@hierarchidb/map-adapter`](../map-adapter/) — Map adapter (source registration target)
- [`@hierarchidb/ui-map`](../ui/map/) — Map UI components

## License

MIT
