// Minimal optional feature stubs for Vitest.

export const mapAdapter = {
  async initialize() {
    return undefined;
  },
};

export const tabularXlsx = {
  async write() {
    return new Uint8Array();
  },
};

export default {
  mapAdapter,
  tabularXlsx,
};
