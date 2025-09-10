export class BatchService {
  // minimal surface to satisfy imports in tests
}

export class TabularWriter {
  // minimal surface to satisfy imports in tests
}

// default exports expected by SessionController
const vtpbf = {} as any;
export default vtpbf;
export const geojsonvt = (..._args: any[]) => ({
  getTile: () => ({ features: [] }),
});
// Support both default and named import styles
module.exports = Object.assign(module.exports || {}, { default: vtpbf, geojsonvt });
