declare module 'geos-wasm' {
  export type GeosWasmModule = {
    _malloc: (size: number) => number;
    _free: (ptr: number) => void;
    HEAPU8: Uint8Array;
    getValue: (ptr: number, type: string) => number;
    UTF8ToString: (ptr: number) => string;
    GEOSArea: (geomPtr: number, areaPtr: number) => number;
    GEOSGeom_destroy: (geomPtr: number) => void;
    GEOSEnvelope: (geomPtr: number) => number | null;
    GEOSWKBWriter_create: () => number;
    GEOSWKBWriter_write: (writerPtr: number, geomPtr: number, sizePtr: number) => number | null;
    GEOSWKBWriter_destroy: (writerPtr: number) => void;
    GEOSWKBReader_create: () => number;
    GEOSWKBReader_read: (readerPtr: number, dataPtr: number, size: number) => number | null;
    GEOSWKBReader_destroy: (readerPtr: number) => void;
    GEOSGeoJSONWriter_create: () => number;
    GEOSGeoJSONWriter_writeGeometry: (writerPtr: number, geomPtr: number, indent: number) => number | null;
    GEOSGeoJSONWriter_destroy: (writerPtr: number) => void;
    GEOSFree: (ptr: number) => void;
    GEOSisValid: (geomPtr: number) => number;
    GEOSisValidReason: (geomPtr: number) => number | null;
    GEOSTopologyPreserveSimplify: (geomPtr: number, tolerance: number) => number | null;
    GEOSSimplify: (geomPtr: number, tolerance: number) => number | null;
    GEOSMakeValid: (geomPtr: number) => number | null;
    GEOSIntersects: (leftPtr: number, rightPtr: number) => number;
    GEOSContains: (leftPtr: number, rightPtr: number) => number;
    GEOSIntersection: (leftPtr: number, rightPtr: number) => number | null;
    GEOSisEmpty: (geomPtr: number) => number;
  };

  export type GeosWasmInitConfig = {
    locateFile?: (path: string) => string;
  };

  const initGeosJs: (config?: GeosWasmInitConfig) => Promise<GeosWasmModule>;
  export default initGeosJs;
}

declare module 'geos-wasm/helpers' {
  export const geojsonToGeosGeom: (geojson: unknown, geos: unknown) => number | null;
}
