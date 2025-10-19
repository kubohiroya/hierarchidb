import { createTsupConfig } from '../../../tsup.base.config.ts';

export default createTsupConfig({ external: ['react', 'react-dom', '@mui/material', '@mui/icons-material', '@emotion/react', '@emotion/styled'] });
