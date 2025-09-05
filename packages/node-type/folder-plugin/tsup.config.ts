import { createTsupConfig } from '../../../tsup.base.config';

export default createTsupConfig({
  entry: {
    index: 'src/index.ts',
    'worker/index': 'src/worker/index.ts',
    'ui/index': 'src/ui/index.ts',
    'shared/index': 'src/shared/index.ts',
  },
  splitting: false,
  external: [
    '@hierarchidb/util',
  ],
});
