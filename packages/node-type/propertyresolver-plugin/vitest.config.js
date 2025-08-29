"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var config_1 = require("vitest/config");
var path_1 = require("path");
exports.default = (0, config_1.defineConfig)({
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./src/__tests__/setup.ts'],
    },
    resolve: {
        alias: {
            '~': path_1.default.resolve(__dirname, 'src'),
        },
    },
});
