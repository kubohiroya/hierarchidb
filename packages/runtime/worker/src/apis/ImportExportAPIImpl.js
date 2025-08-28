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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImportExportAPIImpl = void 0;
var common_core_1 = require("@hierarchidb/common-core");
var CoreDB_1 = require("../db/CoreDB");
/**
 * Import/Export API implementation for Worker layer
 * Handles data import/export operations with progress tracking
 */
var ImportExportAPIImpl = /** @class */ (function () {
    function ImportExportAPIImpl() {
        this.operations = new Map();
        this.abortControllers = new Map();
        // Note: db will be initialized asynchronously
    }
    ImportExportAPIImpl.prototype.initialize = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = this;
                        return [4 /*yield*/, CoreDB_1.CoreDB.getSingleton()];
                    case 1:
                        _a.db = _b.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    ImportExportAPIImpl.getInstance = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!!ImportExportAPIImpl.instance) return [3 /*break*/, 2];
                        ImportExportAPIImpl.instance = new ImportExportAPIImpl();
                        return [4 /*yield*/, ImportExportAPIImpl.instance.initialize()];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2: return [2 /*return*/, ImportExportAPIImpl.instance];
                }
            });
        });
    };
    /**
     * Import nodes from structured data
     */
    ImportExportAPIImpl.prototype.importNodes = function (params) {
        var _a;
        return __awaiter(this, void 0, void 0, function () {
            var operationId, abortController, operation, validation, importedNodeIds, errors, skippedCount, nodes, total, i, nodeData, existingNode, nodeId, node, childResult, error_1, errorMessage, error_2;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        operationId = this.generateOperationId();
                        abortController = new AbortController();
                        this.abortControllers.set(operationId, abortController);
                        operation = {
                            operationId: operationId,
                            type: 'import',
                            status: 'running',
                            startedAt: Date.now(),
                        };
                        this.operations.set(operationId, operation);
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 14, 15, 16]);
                        if (!params.validateFirst) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.validateImportData({
                                data: params.data,
                                format: params.format,
                                treeId: params.treeId,
                                targetParentId: params.targetParentId,
                            })];
                    case 2:
                        validation = _b.sent();
                        if (!validation.valid) {
                            throw new Error("Validation failed: ".concat(validation.errors.map(function (e) { return e.message; }).join(', ')));
                        }
                        _b.label = 3;
                    case 3:
                        importedNodeIds = [];
                        errors = [];
                        skippedCount = 0;
                        nodes = params.data.nodes || [];
                        total = nodes.length;
                        i = 0;
                        _b.label = 4;
                    case 4:
                        if (!(i < nodes.length)) return [3 /*break*/, 13];
                        if (abortController.signal.aborted) {
                            throw new Error('Import operation cancelled');
                        }
                        nodeData = nodes[i];
                        _b.label = 5;
                    case 5:
                        _b.trys.push([5, 11, , 12]);
                        if (!(params.conflictResolution === 'skip')) return [3 /*break*/, 7];
                        return [4 /*yield*/, this.findNodeByName(params.targetParentId, nodeData.name)];
                    case 6:
                        existingNode = _b.sent();
                        if (existingNode) {
                            skippedCount++;
                            return [3 /*break*/, 12];
                        }
                        _b.label = 7;
                    case 7:
                        nodeId = (0, common_core_1.generateNodeId)();
                        node = {
                            id: nodeId,
                            parentId: params.targetParentId,
                            nodeType: nodeData.nodeType || 'folder',
                            name: nodeData.name,
                            description: nodeData.description,
                            depth: 0,
                            // metadata: nodeData.metadata || {}, // TreeNode doesn't have metadata property
                            createdAt: Date.now(),
                            updatedAt: Date.now(),
                            version: 1,
                        };
                        return [4 /*yield*/, this.db.createNode(node)];
                    case 8:
                        _b.sent();
                        importedNodeIds.push(nodeId);
                        if (!(nodeData.children && nodeData.children.length > 0)) return [3 /*break*/, 10];
                        return [4 /*yield*/, this.importNodes(__assign(__assign({}, params), { targetParentId: nodeId, data: { nodes: nodeData.children } }))];
                    case 9:
                        childResult = _b.sent();
                        importedNodeIds.push.apply(importedNodeIds, childResult.importedNodeIds);
                        skippedCount += childResult.skippedCount;
                        _b.label = 10;
                    case 10:
                        // Report progress
                        (_a = params.onProgress) === null || _a === void 0 ? void 0 : _a.call(params, {
                            phase: 'importing',
                            current: i + 1,
                            total: total,
                            percentage: ((i + 1) / total) * 100,
                            message: "Imported ".concat(nodeData.name),
                        });
                        return [3 /*break*/, 12];
                    case 11:
                        error_1 = _b.sent();
                        errorMessage = "Failed to import node \"".concat(nodeData.name, "\": ").concat(error_1);
                        errors.push(errorMessage);
                        console.error(errorMessage, error_1);
                        return [3 /*break*/, 12];
                    case 12:
                        i++;
                        return [3 /*break*/, 4];
                    case 13:
                        // Finalize operation
                        operation.status = 'completed';
                        operation.completedAt = Date.now();
                        operation.result = {
                            success: importedNodeIds.length > 0,
                            importedNodeIds: importedNodeIds,
                            importedCount: importedNodeIds.length,
                            skippedCount: skippedCount,
                            errors: errors.length > 0 ? errors : undefined,
                            operationId: operationId,
                        };
                        return [2 /*return*/, operation.result];
                    case 14:
                        error_2 = _b.sent();
                        operation.status = 'failed';
                        operation.completedAt = Date.now();
                        operation.error = String(error_2);
                        throw error_2;
                    case 15:
                        this.abortControllers.delete(operationId);
                        return [7 /*endfinally*/];
                    case 16: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Export nodes to structured data
     */
    ImportExportAPIImpl.prototype.exportNodes = function (params) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function () {
            var operationId, abortController, operation, collectedNodes, total, i, nodeId, node, children, exportedData, mimeType, result, error_3;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        operationId = this.generateOperationId();
                        abortController = new AbortController();
                        this.abortControllers.set(operationId, abortController);
                        operation = {
                            operationId: operationId,
                            type: 'export',
                            status: 'running',
                            startedAt: Date.now(),
                        };
                        this.operations.set(operationId, operation);
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 8, 9, 10]);
                        collectedNodes = [];
                        total = params.nodeIds.length;
                        i = 0;
                        _c.label = 2;
                    case 2:
                        if (!(i < params.nodeIds.length)) return [3 /*break*/, 7];
                        if (abortController.signal.aborted) {
                            throw new Error('Export operation cancelled');
                        }
                        nodeId = params.nodeIds[i];
                        return [4 /*yield*/, this.db.getNode(nodeId)];
                    case 3:
                        node = _c.sent();
                        if (!node) return [3 /*break*/, 5];
                        collectedNodes.push(node);
                        if (!params.includeChildren) return [3 /*break*/, 5];
                        return [4 /*yield*/, this.collectChildNodes(nodeId)];
                    case 4:
                        children = _c.sent();
                        collectedNodes.push.apply(collectedNodes, children);
                        _c.label = 5;
                    case 5:
                        // Report progress
                        (_a = params.onProgress) === null || _a === void 0 ? void 0 : _a.call(params, {
                            phase: 'collecting',
                            current: i + 1,
                            total: total,
                            percentage: ((i + 1) / total) * 100,
                            message: "Collected node ".concat(i + 1, " of ").concat(total),
                        });
                        _c.label = 6;
                    case 6:
                        i++;
                        return [3 /*break*/, 2];
                    case 7:
                        exportedData = void 0;
                        mimeType = void 0;
                        (_b = params.onProgress) === null || _b === void 0 ? void 0 : _b.call(params, {
                            phase: 'formatting',
                            current: 1,
                            total: 1,
                            percentage: 100,
                            message: 'Formatting data...',
                        });
                        switch (params.format) {
                            case 'json':
                                exportedData = this.formatAsJSON(collectedNodes, params.includeMetadata);
                                mimeType = 'application/json';
                                break;
                            case 'csv':
                                exportedData = this.formatAsCSV(collectedNodes, params.csvColumns);
                                mimeType = 'text/csv';
                                break;
                            case 'xml':
                                exportedData = this.formatAsXML(collectedNodes, params.includeMetadata);
                                mimeType = 'application/xml';
                                break;
                            default:
                                throw new Error("Unsupported export format: ".concat(params.format));
                        }
                        result = {
                            success: true,
                            data: exportedData,
                            format: params.format,
                            exportedCount: collectedNodes.length,
                            mimeType: mimeType,
                            filename: "export-".concat(Date.now(), ".").concat(params.format),
                            operationId: operationId,
                        };
                        // Finalize operation
                        operation.status = 'completed';
                        operation.completedAt = Date.now();
                        operation.result = result;
                        return [2 /*return*/, result];
                    case 8:
                        error_3 = _c.sent();
                        operation.status = 'failed';
                        operation.completedAt = Date.now();
                        operation.error = String(error_3);
                        throw error_3;
                    case 9:
                        this.abortControllers.delete(operationId);
                        return [7 /*endfinally*/];
                    case 10: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get supported import formats
     */
    ImportExportAPIImpl.prototype.getSupportedImportFormats = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, ['json', 'csv', 'xml']];
            });
        });
    };
    /**
     * Get supported export formats
     */
    ImportExportAPIImpl.prototype.getSupportedExportFormats = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, ['json', 'csv', 'xml']];
            });
        });
    };
    /**
     * Validate import data without performing actual import
     */
    ImportExportAPIImpl.prototype.validateImportData = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            var errors, warnings, nodeTypes, nodeCount, maxDepth, validateNode;
            return __generator(this, function (_a) {
                errors = [];
                warnings = [];
                nodeTypes = new Map();
                nodeCount = 0;
                maxDepth = 0;
                validateNode = function (node, path, depth) {
                    nodeCount++;
                    maxDepth = Math.max(maxDepth, depth);
                    // Validate required fields
                    if (!node.name) {
                        errors.push({
                            code: 'MISSING_NAME',
                            message: 'Node name is required',
                            path: path,
                        });
                    }
                    // Track node types
                    var nodeType = node.nodeType || 'folder';
                    nodeTypes.set(nodeType, (nodeTypes.get(nodeType) || 0) + 1);
                    // Validate children recursively
                    if (node.children && Array.isArray(node.children)) {
                        node.children.forEach(function (child, index) {
                            validateNode(child, "".concat(path, ".children[").concat(index, "]"), depth + 1);
                        });
                    }
                };
                // Validate structure
                if (!params.data || !params.data.nodes) {
                    errors.push({
                        code: 'INVALID_STRUCTURE',
                        message: 'Import data must contain a nodes array',
                    });
                }
                else if (!Array.isArray(params.data.nodes)) {
                    errors.push({
                        code: 'INVALID_NODES',
                        message: 'Nodes must be an array',
                    });
                }
                else {
                    // Validate each node
                    params.data.nodes.forEach(function (node, index) {
                        validateNode(node, "nodes[".concat(index, "]"), 0);
                    });
                }
                return [2 /*return*/, {
                        valid: errors.length === 0,
                        errors: errors,
                        warnings: warnings.length > 0 ? warnings : undefined,
                        statistics: {
                            nodeCount: nodeCount,
                            maxDepth: maxDepth,
                            nodeTypes: Object.fromEntries(nodeTypes),
                        },
                    }];
            });
        });
    };
    /**
     * Get import/export operation status
     */
    ImportExportAPIImpl.prototype.getOperationStatus = function (operationId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.operations.get(operationId) || null];
            });
        });
    };
    /**
     * Cancel an ongoing import/export operation
     */
    ImportExportAPIImpl.prototype.cancelOperation = function (operationId) {
        return __awaiter(this, void 0, void 0, function () {
            var controller, operation;
            return __generator(this, function (_a) {
                controller = this.abortControllers.get(operationId);
                if (!controller) {
                    return [2 /*return*/, {
                            success: false,
                            error: 'Operation not found or already completed',
                        }];
                }
                controller.abort();
                operation = this.operations.get(operationId);
                if (operation && operation.status === 'running') {
                    operation.status = 'cancelled';
                    operation.completedAt = Date.now();
                }
                return [2 /*return*/, { success: true }];
            });
        });
    };
    // Helper methods
    ImportExportAPIImpl.prototype.generateOperationId = function () {
        return "op-".concat(Date.now(), "-").concat(Math.random().toString(36).substr(2, 9));
    };
    ImportExportAPIImpl.prototype.findNodeByName = function (parentId, name) {
        return __awaiter(this, void 0, void 0, function () {
            var children;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.db.listChildren(parentId)];
                    case 1:
                        children = _a.sent();
                        return [2 /*return*/, children.find(function (node) { return node.name === name; }) || null];
                }
            });
        });
    };
    ImportExportAPIImpl.prototype.collectChildNodes = function (parentId) {
        return __awaiter(this, void 0, void 0, function () {
            var children, allNodes, _i, children_1, child, grandchildren;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.db.listChildren(parentId)];
                    case 1:
                        children = _a.sent();
                        allNodes = __spreadArray([], children, true);
                        _i = 0, children_1 = children;
                        _a.label = 2;
                    case 2:
                        if (!(_i < children_1.length)) return [3 /*break*/, 5];
                        child = children_1[_i];
                        return [4 /*yield*/, this.collectChildNodes(child.id)];
                    case 3:
                        grandchildren = _a.sent();
                        allNodes.push.apply(allNodes, grandchildren);
                        _a.label = 4;
                    case 4:
                        _i++;
                        return [3 /*break*/, 2];
                    case 5: return [2 /*return*/, allNodes];
                }
            });
        });
    };
    ImportExportAPIImpl.prototype.formatAsJSON = function (nodes, includeMetadata) {
        var exportData = {
            version: '1.0',
            exportDate: new Date().toISOString(),
            nodeCount: nodes.length,
            nodes: nodes.map(function (node) {
                var exported = {
                    name: node.name,
                    nodeType: node.nodeType,
                    description: node.description,
                };
                // if (includeMetadata && node.metadata) {
                //   exported.metadata = node.metadata;
                // } // TreeNode doesn't have metadata property
                return exported;
            }),
        };
        return JSON.stringify(exportData, null, 2);
    };
    ImportExportAPIImpl.prototype.formatAsCSV = function (nodes, columns) {
        var cols = columns || ['name', 'nodeType', 'description'];
        var headers = cols.join(',');
        var rows = nodes.map(function (node) {
            return cols.map(function (col) {
                var value = node[col] || '';
                // Escape CSV values
                if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                    return "\"".concat(value.replace(/"/g, '""'), "\"");
                }
                return String(value);
            }).join(',');
        });
        return __spreadArray([headers], rows, true).join('\n');
    };
    ImportExportAPIImpl.prototype.formatAsXML = function (nodes, includeMetadata) {
        var xml = ['<?xml version="1.0" encoding="UTF-8"?>'];
        xml.push('<export>');
        xml.push('  <metadata>');
        xml.push("    <version>1.0</version>");
        xml.push("    <exportDate>".concat(new Date().toISOString(), "</exportDate>"));
        xml.push("    <nodeCount>".concat(nodes.length, "</nodeCount>"));
        xml.push('  </metadata>');
        xml.push('  <nodes>');
        for (var _i = 0, nodes_1 = nodes; _i < nodes_1.length; _i++) {
            var node = nodes_1[_i];
            xml.push('    <node>');
            xml.push("      <name>".concat(this.escapeXML(node.name), "</name>"));
            xml.push("      <nodeType>".concat(node.nodeType, "</nodeType>"));
            if (node.description) {
                xml.push("      <description>".concat(this.escapeXML(node.description), "</description>"));
            }
            // if (includeMetadata && node.metadata) {
            //   xml.push('      <metadata>');
            //   for (const [key, value] of Object.entries(node.metadata)) {
            //     xml.push(`        <${key}>${this.escapeXML(String(value))}</${key}>`);
            //   }
            //   xml.push('      </metadata>');
            // } // TreeNode doesn't have metadata property
            xml.push('    </node>');
        }
        xml.push('  </nodes>');
        xml.push('</export>');
        return xml.join('\n');
    };
    ImportExportAPIImpl.prototype.escapeXML = function (str) {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    };
    ImportExportAPIImpl.instance = null;
    return ImportExportAPIImpl;
}());
exports.ImportExportAPIImpl = ImportExportAPIImpl;
