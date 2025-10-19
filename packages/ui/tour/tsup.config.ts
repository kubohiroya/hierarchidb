import { createTsupConfig } from '../../../tsup.base.config.ts';

export default createTsupConfig({
  external: ['react', '@mui/material', '@mui/icons-material', '@emotion/react'],
});
