import { createTsupConfig } from '../../../tsup.base.config';

export default createTsupConfig({
  dts: true,
  external: ['maplibre-gl', 'deck.gl']
});

