import { createTsupConfig } from "../../../tsup.base.config.js";

export default createTsupConfig({
  entry: [
    "src/index.ts",
    "src/ui/index.ts",
    "src/shared/index.ts",
    "src/services/index.ts"
  ],
  // UI-heavy: DTS often pulls in React/MUI internals; skip DTS for now
  dts: false,
  external: [
    '@hierarchidb/runtime-ui-plugin-dialog',
    '@hierarchidb/spreadsheet-plugin',
    // Explicit peers
    'react',
    'react-dom',
    '@mui/material',
    '@mui/icons-material',
    '@emotion/react',
    '@emotion/styled',
    'dexie',
    'i18next',
    'react-i18next',
  ],
});
