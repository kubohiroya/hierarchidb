import { createTsupConfig } from '../../../tsup.base.config.js';

export default createTsupConfig({
  dts: {
    entry: {
      index: 'src/index.ts',
      AuthNotificationSystem: 'src/AuthNotificationSystem.ts',
    },
  },
});

