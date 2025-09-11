import { createTsupConfig } from '../../../../tsup.base.config';

export default createTsupConfig({
  external: [
    'react',
    'react-dom',
    '@mui/material',
    '@mui/icons-material',
    '@emotion/react',
    '@emotion/styled',
    '@dnd-kit/core',
    '@dnd-kit/sortable',
    '@dnd-kit/utilities',
    '@tanstack/react-table',
    '@tanstack/react-virtual',
  ],
});
