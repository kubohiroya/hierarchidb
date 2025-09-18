import { createTsupConfig } from '../../../tsup.base.config.js';

export default createTsupConfig({
  dts: true,
  external: ['maplibre-gl', 'deck.gl'],
});
