import { _ as getCategoryColor, a as mergeBatchConfig, c as summarizeCheckboxState, d as ActionType, f as ErrorCategory, g as SHAPE_CATEGORIES, h as DEFAULT_SHAPE_CATEGORY, l as validateBatchConfig, m as ShapeErrorFactory, o as normalizeDataSourceName, p as ErrorSeverity, s as parseCheckboxState, u as BatchTaskStage, v as getCategoryLabel, y as getCategoryOption } from "./MetadataLoader.js";
import { a as BATCH_CONSTANTS, c as SHAPE_LEVELS, d as UI_CONSTANTS, i as shapeDB, l as SHAPE_PLUGIN_ID, o as DEFAULT_PROCESSING_CONFIG, r as ShapeDB, s as SHAPE_DATA_SOURCES, t as EphemeralShapeDB, u as STORAGE_CONSTANTS } from "./EphemeralShapeDB.js";
import "./services.js";
import { a as ShapeMetadata, i as BatchSessionManager, n as createShapeBatchManager, r as isShapeBatchAPIV2Enabled, t as UnifiedShapeBatchManager } from "./UnifiedShapeBatchManager.js";
import { t as getShapeRuntimeWorkerClient } from "./RuntimeWorkerClient.js";
import { TabularQueryService as ShapeTableQueryService } from "@hierarchidb/tabular-store";

//#region src/plugin-manifest.ts
const PLUGIN_ID = "@hierarchidb/shape-plugin";
const PLUGIN_VERSION = "0.1.0";
const PLUGIN_DESCRIPTION = "Geographic shape data management plugin for HierarchiDB";
const PLUGIN_NODE_TYPE = "shape";
const PLUGIN_MANIFEST = {
	id: PLUGIN_ID,
	name: "Shape Plugin",
	displayName: "Shape",
	nodeType: PLUGIN_NODE_TYPE,
	version: PLUGIN_VERSION,
	description: PLUGIN_DESCRIPTION,
	extends: "folder",
	priority: 800,
	dependencies: ["folder"],
	icon: {
		mui: "Hexagon",
		emoji: "♦️",
		color: "#a3b030",
		component: {
			specifier: "@hierarchidb/shape-plugin/icon",
			exportName: "ShapePluginIcon"
		}
	},
	category: {
		id: "geographic",
		menuGroup: "geo",
		createOrder: 800
	},
	capabilities: {
		canHaveChildren: false,
		canBeRoot: false,
		canBeDeleted: true,
		canBeRenamed: true,
		canBeMoved: true,
		canBeCopied: false,
		supportsBatchProcessing: true
	},
	schema: {
		inherits: "folder",
		fields: [
			{
				name: "dataSourceName",
				type: "string",
				required: true
			},
			{
				name: "selectedCountries",
				type: "array",
				required: true
			},
			{
				name: "selectedAdminLevels",
				type: "array",
				required: true
			},
			{
				name: "licenseAgreement",
				type: "boolean",
				required: true
			}
		]
	},
	database: { prewarm: [{
		specifier: "@hierarchidb/shape-plugin",
		export: "ShapeDB"
	}] },
	worker: { preload: ["registerShapeWorkerStores", "loadShapeEntitiesDbModule"] }
};

//#endregion
//#region src/services/tiles/RuntimeTileClient.ts
async function listTiles(sessionId) {
	const vectorTile = (await getShapeRuntimeWorkerClient())?.vectortile;
	if (!vectorTile?.listTiles) return [];
	return vectorTile.listTiles(sessionId) ?? [];
}
async function getTile(sessionId, z, x, y) {
	const vectorTile = (await getShapeRuntimeWorkerClient())?.vectortile;
	if (!vectorTile?.getTile) return null;
	const result = await vectorTile.getTile(sessionId, z, x, y);
	if (!result) return null;
	return result instanceof Uint8Array ? result : new Uint8Array(result);
}
async function getTileSummary(sessionId) {
	const vectorTile = (await getShapeRuntimeWorkerClient())?.vectortile;
	if (!vectorTile?.getSummary) return {
		tiles: 0,
		totalBytes: 0
	};
	return vectorTile.getSummary(sessionId);
}

//#endregion
//#region src/index.ts
var RuntimeWiring = class {
	static async registerRuntimeWorkerAdapters() {
		try {
			await (await import("./registerRuntimeWorker.js")).registerShapeRuntimeWorkerAdapters();
		} catch {}
	}
};
let initialized = false;
async function onRegister() {
	if (initialized) return;
	initialized = true;
	try {
		const { ShapeDB: ShapeDB$1 } = await import("./services/index.js");
		const db = new ShapeDB$1();
		await db.open();
		await db.close();
	} catch (error) {
		console.warn("[shape-plugin] failed to pre-open ShapeDB:", error);
	}
}

//#endregion
export { ActionType, BATCH_CONSTANTS, BatchTaskStage, DEFAULT_PROCESSING_CONFIG, DEFAULT_SHAPE_CATEGORY, EphemeralShapeDB, ErrorCategory, ErrorSeverity, RuntimeWiring, SHAPE_CATEGORIES, SHAPE_DATA_SOURCES, SHAPE_LEVELS, SHAPE_PLUGIN_ID, STORAGE_CONSTANTS, BatchSessionManager as ShapeBatchSessionManager, ShapeDB, ShapeErrorFactory, ShapeMetadata, PLUGIN_MANIFEST as ShapePluginManifest, ShapeTableQueryService, UI_CONSTANTS, UnifiedShapeBatchManager, createShapeBatchManager, getCategoryColor, getCategoryLabel, getCategoryOption, getTile, getTileSummary, isShapeBatchAPIV2Enabled, listTiles, mergeBatchConfig, normalizeDataSourceName, onRegister, parseCheckboxState, shapeDB, summarizeCheckboxState, validateBatchConfig };
//# sourceMappingURL=index.js.map