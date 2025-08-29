"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
exports.__esModule = true;
exports.MapHighlightService = exports.createDefaultWindowState = exports.WindowPersistenceService = void 0;
var WindowPersistenceService_1 = require("./WindowPersistenceService");
__createBinding(exports, WindowPersistenceService_1, "WindowPersistenceService");
var windowStateUtils_1 = require("./windowStateUtils");
__createBinding(exports, windowStateUtils_1, "createDefaultWindowState");
var MapHighlightService_1 = require("./MapHighlightService");
__createBinding(exports, MapHighlightService_1, "MapHighlightService");
