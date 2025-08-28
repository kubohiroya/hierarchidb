"use strict";
/**
 * @file default-plugin.ts
 * @description Default plugin definitions for the system
 */
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerDefaultPlugins = exports.getDefaultPlugins = exports.spreadsheetPlugin = exports.notePlugin = exports.projectPlugin = exports.shapePlugin = exports.stylemapPlugin = exports.basemapPlugin = exports.folderPlugin = void 0;
var handlers_1 = require("../handlers");
// Basic working entity handler for default plugins
var DefaultEntityHandler = /** @class */ (function (_super) {
    __extends(DefaultEntityHandler, _super);
    function DefaultEntityHandler() {
        return _super.call(this, null, null, null) || this;
    }
    DefaultEntityHandler.prototype.createEntity = function (nodeId, data) {
        return __awaiter(this, void 0, void 0, function () {
            var entity;
            return __generator(this, function (_a) {
                entity = __assign({ id: crypto.randomUUID(), // Generate a unique ID
                    nodeId: nodeId, createdAt: Date.now(), updatedAt: Date.now(), version: 1 }, data);
                // In a real implementation, this would save to database
                console.log("Created entity for node ".concat(nodeId, ":"), entity);
                return [2 /*return*/, entity];
            });
        });
    };
    DefaultEntityHandler.prototype.updateEntity = function (nodeId, data) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                // In a real implementation, this would update the database
                console.log("Updated entity for node ".concat(nodeId, ":"), data);
                return [2 /*return*/];
            });
        });
    };
    DefaultEntityHandler.prototype.deleteEntity = function (nodeId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                // In a real implementation, this would delete from database
                console.log("Deleted entity for node ".concat(nodeId));
                return [2 /*return*/];
            });
        });
    };
    DefaultEntityHandler.prototype.getEntity = function (nodeId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                // In a real implementation, this would query the database
                console.log("Getting entity for node ".concat(nodeId));
                return [2 /*return*/, null]; // Return null for now as we don't have persistent storage
            });
        });
    };
    return DefaultEntityHandler;
}(handlers_1.BaseEntityHandler));
var defaultEntityHandler = new DefaultEntityHandler();
/**
 * Folder plugin definition
 */
exports.folderPlugin = {
    nodeType: 'folder',
    name: 'Folder',
    displayName: 'Folder',
    icon: {
        muiIconName: 'Folder',
        emoji: '📁',
        color: '#ffa726',
    },
    category: {
        treeId: '*',
        menuGroup: 'basic',
        createOrder: 1,
    },
    database: {
        dbName: 'CoreDB',
        tableName: 'folders',
        schema: '&id, nodeId, name, description, createdAt, updatedAt, version',
        version: 1,
    },
    meta: {
        id: 'folder-plugin-plugin',
        name: 'Folder',
        nodeType: 'folder',
        status: 'active',
        version: '1.0.0',
        tags: ['container', 'basic'],
    },
    entityHandler: defaultEntityHandler,
    routing: {
        actions: {},
        defaultAction: undefined,
    },
};
/**
 * BaseMap plugin definition
 */
exports.basemapPlugin = {
    nodeType: 'basemap',
    name: 'BaseMap',
    displayName: 'Base Map',
    icon: {
        muiIconName: 'Map',
        emoji: '🗺️',
        color: '#1976d2',
    },
    category: {
        treeId: '*',
        menuGroup: 'document',
        createOrder: 10,
    },
    database: {
        dbName: 'CoreDB',
        tableName: 'basemaps',
        schema: '&id, nodeId, name, mapConfig, createdAt, updatedAt, version',
        version: 1,
    },
    meta: {
        id: 'basemap-plugin',
        name: 'BaseMap',
        nodeType: 'basemap',
        status: 'active',
        version: '1.0.0',
        tags: ['map', 'visualization'],
    },
    entityHandler: defaultEntityHandler,
    routing: {
        actions: {},
        defaultAction: undefined,
    },
};
/**
 * StyleMap plugin definition
 */
exports.stylemapPlugin = {
    nodeType: 'stylemap',
    name: 'StyleMap',
    displayName: 'Style Map',
    icon: {
        muiIconName: 'Palette',
        emoji: '🎨',
        color: '#9c27b0',
    },
    category: {
        treeId: '*',
        menuGroup: 'document',
        createOrder: 20,
    },
    database: {
        dbName: 'CoreDB',
        tableName: 'stylemaps',
        schema: '&id, nodeId, name, styleRules, createdAt, updatedAt, version',
        version: 1,
    },
    meta: {
        id: 'stylemap-plugin-plugin',
        name: 'StyleMap',
        nodeType: 'stylemap',
        status: 'active',
        version: '1.0.0',
        tags: ['styling', 'visualization'],
    },
    entityHandler: defaultEntityHandler,
    routing: {
        actions: {},
        defaultAction: undefined,
    },
};
/**
 * Shape plugin definition
 */
exports.shapePlugin = {
    nodeType: 'shape',
    name: 'Shape',
    displayName: 'Geographic Shape',
    icon: {
        muiIconName: 'Layers',
        emoji: '🌍',
        color: '#ff5722',
    },
    category: {
        treeId: '*',
        menuGroup: 'advanced',
        createOrder: 30,
    },
    database: {
        dbName: 'CoreDB',
        tableName: 'shapes',
        schema: '&id, nodeId, name, geoData, createdAt, updatedAt, version',
        version: 1,
    },
    meta: {
        id: 'shape-plugin-plugin',
        name: 'Shape',
        nodeType: 'shape',
        status: 'active',
        version: '1.0.0',
        tags: ['geography', 'boundaries'],
    },
    entityHandler: defaultEntityHandler,
    routing: {
        actions: {},
        defaultAction: undefined,
    },
};
/**
 * Project plugin definition
 */
exports.projectPlugin = {
    nodeType: 'project',
    name: 'Project',
    displayName: 'Project',
    icon: {
        muiIconName: 'Extension',
        emoji: '📋',
        color: '#00bcd4',
    },
    category: {
        treeId: '*',
        menuGroup: 'container',
        createOrder: 5,
    },
    database: {
        dbName: 'CoreDB',
        tableName: 'projects',
        schema: '&id, nodeId, name, description, status, createdAt, updatedAt, version',
        version: 1,
    },
    meta: {
        id: 'project-plugin',
        name: 'Project',
        nodeType: 'project',
        status: 'active',
        version: '1.0.0',
        tags: ['container', 'project-management'],
    },
    entityHandler: defaultEntityHandler,
    routing: {
        actions: {},
        defaultAction: undefined,
    },
};
/**
 * Note/Document plugin definition
 */
exports.notePlugin = {
    nodeType: 'note',
    name: 'Note',
    displayName: 'Note',
    icon: {
        muiIconName: 'Note',
        emoji: '📝',
        color: '#ff9800',
    },
    category: {
        treeId: '*',
        menuGroup: 'document',
        createOrder: 15,
    },
    database: {
        dbName: 'CoreDB',
        tableName: 'notes',
        schema: '&id, nodeId, name, content, createdAt, updatedAt, version',
        version: 1,
    },
    meta: {
        id: 'note-plugin',
        name: 'Note',
        nodeType: 'note',
        status: 'active',
        version: '1.0.0',
        tags: ['document', 'text'],
    },
    entityHandler: defaultEntityHandler,
    routing: {
        actions: {},
        defaultAction: undefined,
    },
};
/**
 * Spreadsheet plugin definition
 */
exports.spreadsheetPlugin = {
    nodeType: 'spreadsheet',
    name: 'Spreadsheet',
    displayName: 'Spreadsheet',
    icon: {
        muiIconName: 'TableChart',
        emoji: '📊',
        color: '#4caf50',
    },
    category: {
        treeId: '*',
        menuGroup: 'document',
        createOrder: 25,
    },
    database: {
        dbName: 'CoreDB',
        tableName: 'spreadsheets',
        schema: '&id, nodeId, name, data, createdAt, updatedAt, version',
        version: 1,
    },
    meta: {
        id: 'spreadsheet-plugin-plugin',
        name: 'Spreadsheet',
        nodeType: 'spreadsheet',
        status: 'active',
        version: '1.0.0',
        tags: ['data', 'table'],
    },
    entityHandler: defaultEntityHandler,
    routing: {
        actions: {},
        defaultAction: undefined,
    },
};
/**
 * Get all default plugins
 */
function getDefaultPlugins() {
    return [
        exports.folderPlugin,
        exports.basemapPlugin,
        exports.stylemapPlugin,
        exports.shapePlugin,
        exports.projectPlugin,
        exports.notePlugin,
        exports.spreadsheetPlugin,
    ];
}
exports.getDefaultPlugins = getDefaultPlugins;
/**
 * Register all default plugins to a registry
 */
function registerDefaultPlugins(registry) {
    var plugins = getDefaultPlugins();
    for (var _i = 0, plugins_1 = plugins; _i < plugins_1.length; _i++) {
        var plugin = plugins_1[_i];
        registry.registerPlugin(plugin);
    }
}
exports.registerDefaultPlugins = registerDefaultPlugins;
