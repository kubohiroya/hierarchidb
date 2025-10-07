import { createTsupConfig } from '../../../tsup.base.config.js';

export default createTsupConfig({
  dts: {
    entry: {
      index: 'src/RuntimeWorkerService.ts',
      AuthNotificationSystem: 'src/AuthNotificationSystem.ts',
    },
  },
});

