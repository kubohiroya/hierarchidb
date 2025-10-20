import { createTsupConfig } from '../../../tsup.base.config';

export default createTsupConfig({ external: ['react', '@mui/material', '@mui/icons-material', '@emotion/react'] });
