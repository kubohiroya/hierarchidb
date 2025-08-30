"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pluginLogger = void 0;
function pluginLogger() {
    return {
        name: 'vite-plugin-logger',
        configResolved: function (config) {
            var _a;
            console.log('\n' + '='.repeat(60));
            console.log('🔌 VITE PLUGINS LOADED:');
            console.log('='.repeat(60));
            config.plugins.forEach(function (plugin, index) {
                var pluginName = plugin.name || "Unknown Plugin ".concat(index + 1);
                console.log("  ".concat((index + 1).toString().padStart(2, '0'), ". ").concat(pluginName));
            });
            console.log('='.repeat(60));
            console.log('📁 Configuration:');
            console.log("  \u2022 Base Path: ".concat(config.base));
            console.log("  \u2022 Mode: ".concat(config.mode));
            console.log("  \u2022 Build Command: ".concat(config.command));
            console.log("  \u2022 Dev Server Port: ".concat(((_a = config.server) === null || _a === void 0 ? void 0 : _a.port) || 'default'));
            console.log('='.repeat(60) + '\n');
        }
    };
}
exports.pluginLogger = pluginLogger;
