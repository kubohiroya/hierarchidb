import { createTsupConfig } from '../../../tsup.base.config';

export default createTsupConfig({
  external: [
    '@hierarchidb/download',
    '@hierarchidb/auth-recovery',
  ],
});
