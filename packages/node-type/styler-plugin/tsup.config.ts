import { createTsupConfig } from '../../../tsup.base.config';

export default createTsupConfig({
  external: [
    'provider',
    'provider-dom',
    'provider-i18next',
    '@mui/material',
    '@mui/icons-material',
    '@emotion/provider',
    '@emotion/styled',
    '@hierarchidb/ui-core/components/TagInput',
    '@hierarchidb/ui-core/components/CategorySelector',
    'dexie',
  ],
});
