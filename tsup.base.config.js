"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTsupConfig = void 0;
var tsup_1 = require("tsup");
/**
 * Base tsup configuration for all packages
 */
var createTsupConfig = function (options) {
    if (options === void 0) { options = {}; }
    return (0, tsup_1.defineConfig)(__assign({ 
        // Default entry point for packages
        entry: ['src/index.ts'], 
        // Output formats
        format: ['esm'], 
        // TypeScript configuration
        target: 'es2022', 
        // Generate .d.ts files with optimized settings
        dts: {
            compilerOptions: {
                composite: false,
                incremental: false,
                tsBuildInfoFile: undefined,
            },
        }, 
        // Build settings
        splitting: false, sourcemap: true, clean: true, 
        // Common external dependencies
        external: [
            'provider',
            'provider-dom',
            '@mui/material',
            '@mui/icons-material',
            '@emotion/provider',
            '@emotion/styled',
        ] }, options));
};
exports.createTsupConfig = createTsupConfig;
