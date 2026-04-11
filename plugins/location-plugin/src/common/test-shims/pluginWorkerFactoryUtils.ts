// Minimal stubs for plugin worker factory dynamic imports during Vitest runs.

type WorkerFactory = () => Promise<unknown>;

const createStubFactory = (): WorkerFactory => async () => ({
  default: async () => undefined,
});

export const basemap = createStubFactory();
export const folder = createStubFactory();
export const resolver = createStubFactory();
export const route = createStubFactory();
export const spreadsheet = createStubFactory();
export const styler = createStubFactory();
export const shape = createStubFactory();
export const location = createStubFactory();
export const linker = createStubFactory();
export const timeline = createStubFactory();

export default {
  basemap,
  folder,
  resolver,
  route,
  spreadsheet,
  styler,
  shape,
  location,
  linker,
  timeline,
};
