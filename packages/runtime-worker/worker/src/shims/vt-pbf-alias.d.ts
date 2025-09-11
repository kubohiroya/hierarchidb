// Type alias shim: reuse @types/vt-pbf for the '@maplibre/vt-pbf' package name.
// This is types-only and does not affect runtime resolution.
declare module '@maplibre/vt-pbf' {
  import vtPbf = require('vt-pbf');
  const mod: typeof vtPbf;
  export default mod;
  export = mod;
}

