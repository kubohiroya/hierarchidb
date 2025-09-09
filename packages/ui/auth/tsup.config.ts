import { createTsupConfig } from '../../../tsup.base.config';

export default createTsupConfig({
  external: [
    '@hierarchidb/common-auth',
  ],
});
