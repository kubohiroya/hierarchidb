"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var tsup_1 = require("tsup");
exports.default = (0, tsup_1.defineConfig)({
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
    external: [
        'react',
        'react-dom',
        '@mui/material',
        '@mui/icons-material',
        '@hierarchidb/common-type',
        '@hierarchidb/runtime-batch-processor',
        '@hierarchidb/ui-core',
        '@hierarchidb/ui-dialog',
        '@hierarchidb/worker',
    ],
});
