export class BatchService {
  // minimal surface to satisfy imports in tests
}

export class TabularWriter {
  // minimal surface to satisfy imports in tests
}

// default exports expected by SessionController
export const vtpbf = {
  fromGeojson: () => new Uint8Array(),
};
export const geojsonvt = (..._args: unknown[]) => ({
  getTile: () => ({ features: [] as unknown[] }),
});
// Support both default and named import styles
module.exports = Object.assign(module.exports || {}, { default: vtpbf, geojsonvt });
