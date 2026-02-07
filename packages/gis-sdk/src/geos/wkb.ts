import type initGeosJs from 'geos-wasm';
import type { GeoJSON } from 'geojson';

export type GeosModule = Awaited<ReturnType<typeof initGeosJs>>;
export type GeosEmscriptenModule = GeosModule & {
  _malloc: (size: number) => number;
  _free: (ptr: number) => void;
  HEAPU8: Uint8Array;
  getValue: (ptr: number, type: string) => number;
  UTF8ToString: (ptr: number) => string;
};

const asEmscriptenModule = (geos: GeosModule): GeosEmscriptenModule => (
  geos as GeosEmscriptenModule
);

const allocSizePointer = (geos: GeosModule): number => asEmscriptenModule(geos)._malloc(4);

const readSizePointer = (geos: GeosModule, ptr: number): number => (
  asEmscriptenModule(geos).getValue(ptr, 'i32') as number
);

export const geomToWkb = (geos: GeosModule, geomPtr: number): Uint8Array => {
  const module = asEmscriptenModule(geos);
  const writer = geos.GEOSWKBWriter_create();
  const sizePtr = allocSizePointer(geos);
  try {
    const wkbPtr = geos.GEOSWKBWriter_write(writer, geomPtr, sizePtr);
    if (!wkbPtr) {
      throw new Error('GEOSWKBWriter_write returned null');
    }
    const size = readSizePointer(geos, sizePtr);
    if (!Number.isFinite(size) || size <= 0) {
      throw new Error('GEOSWKBWriter_write returned invalid size');
    }
    const bytes = module.HEAPU8.slice(wkbPtr, wkbPtr + size);
    geos.GEOSFree(wkbPtr);
    return bytes;
  } finally {
    module._free(sizePtr);
    geos.GEOSWKBWriter_destroy(writer);
  }
};

export const wkbToGeom = (geos: GeosModule, wkb: Uint8Array): number => {
  const module = asEmscriptenModule(geos);
  const reader = geos.GEOSWKBReader_create();
  const bufferPtr = module._malloc(wkb.length);
  try {
    module.HEAPU8.set(wkb, bufferPtr);
    const geomPtr = geos.GEOSWKBReader_read(reader, bufferPtr, wkb.length);
    if (!geomPtr) {
      throw new Error('GEOSWKBReader_read returned null');
    }
    return geomPtr;
  } finally {
    module._free(bufferPtr);
    geos.GEOSWKBReader_destroy(reader);
  }
};

export const geomToGeojson = (geos: GeosModule, geomPtr: number): GeoJSON => {
  const module = asEmscriptenModule(geos);
  const writer = geos.GEOSGeoJSONWriter_create();
  try {
    const jsonPtr = geos.GEOSGeoJSONWriter_writeGeometry(writer, geomPtr, 0);
    if (!jsonPtr) {
      throw new Error('GEOSGeoJSONWriter_writeGeometry returned null');
    }
    const jsonText = module.UTF8ToString(jsonPtr);
    geos.GEOSFree(jsonPtr);
    return JSON.parse(jsonText) as GeoJSON;
  } finally {
    geos.GEOSGeoJSONWriter_destroy(writer);
  }
};

export const wkbToGeojson = (geos: GeosModule, wkb: Uint8Array): GeoJSON => {
  const geomPtr = wkbToGeom(geos, wkb);
  try {
    return geomToGeojson(geos, geomPtr);
  } finally {
    geos.GEOSGeom_destroy(geomPtr);
  }
};
