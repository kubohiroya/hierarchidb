"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MappingCompiler = void 0;
/**
 * Simple MappingCompiler for testing
 */
var MappingCompiler = /** @class */ (function () {
    function MappingCompiler() {
    }
    /**
     * Compile mapping rules into a function
     */
    MappingCompiler.prototype.compile = function (mappingRules) {
        var _this = this;
        return function (data) {
            var result = {};
            for (var _i = 0, mappingRules_1 = mappingRules; _i < mappingRules_1.length; _i++) {
                var rule = mappingRules_1[_i];
                // Get value from source path
                var value = _this.getValueByPath(data, rule.sourceProperty);
                // Apply transformation if specified
                var transformedValue = value;
                if (rule.transformFunction && value !== undefined) {
                    try {
                        // Create a safe evaluation context
                        var transformFn = new Function('value', "return ".concat(rule.transformFunction));
                        transformedValue = transformFn(value);
                    }
                    catch (e) {
                        console.error("Transform error for ".concat(rule.sourceProperty, ":"), e);
                        transformedValue = value;
                    }
                }
                // Use default value if needed
                if (transformedValue === undefined && rule.defaultValue !== undefined) {
                    transformedValue = rule.defaultValue;
                }
                // Set value in result
                _this.setValueByPath(result, rule.targetProperty, transformedValue);
            }
            return result;
        };
    };
    /**
     * Get value from object by dot-notation path
     */
    MappingCompiler.prototype.getValueByPath = function (obj, path) {
        var parts = path.split('.');
        var current = obj;
        for (var _i = 0, parts_1 = parts; _i < parts_1.length; _i++) {
            var part = parts_1[_i];
            if (current === null || current === undefined) {
                return undefined;
            }
            current = current[part];
        }
        return current;
    };
    /**
     * Set value in object by dot-notation path
     */
    MappingCompiler.prototype.setValueByPath = function (obj, path, value) {
        var parts = path.split('.');
        var lastPart = parts.pop();
        var current = obj;
        for (var _i = 0, parts_2 = parts; _i < parts_2.length; _i++) {
            var part = parts_2[_i];
            if (!(part in current)) {
                current[part] = {};
            }
            current = current[part];
        }
        current[lastPart] = value;
    };
    return MappingCompiler;
}());
exports.MappingCompiler = MappingCompiler;
