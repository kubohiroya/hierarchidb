import { createTsupConfig } from '../../../tsup.base.config';

export default createTsupConfig({
  dts: {
    entry: {
      index: 'src/index.ts',
      AuthNotificationSystem: 'src/AuthNotificationSystem.ts',
    },
  },
  external: [
    '@hierarchidb/common-types',
  ],
});
