"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var tsup_base_config_1 = require("../../../tsup.base.config");
exports.default = (0, tsup_base_config_1.createTsupConfig)({
    external: [
        'provider',
        'provider-dom',
        '@mui/material',
        '@mui/icons-material',
        '@emotion/provider',
        '@emotion/styled',
        'dexie',
    ],
});
