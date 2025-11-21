import { n as MAPLIBRE_PROPERTY_METADATA, r as StylerConfigDefault, t as MAPLIBRE_PROPERTY_GROUPS } from "./stylerTypes.js";
import { a as generateColorGradient, c as hsvToRgb, d as valueToColor, i as createColorVariations, l as rgbToHex, n as calculateLinearColor, o as getContrastRatio, r as calculateQuantileColor, s as hexToRgb, t as adjustBrightness, u as rgbToHsv } from "./colorUtils.js";
import { t as StylerDataService } from "./StylerDataService.js";
import "./dataAnalysis.js";
import { n as StylerStep5, t as StylerStep6 } from "./StylerStep6.js";
import { NodeDialogPlugin, wrapDialogStepComponent } from "@hierarchidb/plugin-ui-sdk";

//#region src/plugin-manifest.ts
const PLUGIN_ID = "@hierarchidb/styler-plugin";
const PLUGIN_VERSION = "1.0.0";
const PLUGIN_DESCRIPTION = "Styler Plugin for HierarchiDB - Dynamic styling for map visualizations";
const PLUGIN_NODE_TYPE = "styler";
const PLUGIN_MANIFEST = {
	id: PLUGIN_ID,
	name: "Styler Plugin",
	displayName: "Styler",
	nodeType: PLUGIN_NODE_TYPE,
	version: PLUGIN_VERSION,
	description: PLUGIN_DESCRIPTION,
	extends: "spreadsheet",
	priority: 700,
	dependencies: ["@hierarchidb/spreadsheet-plugin"],
	icon: {
		mui: "Palette",
		emoji: "🎨",
		color: "#dcbc50",
		component: {
			specifier: "@hierarchidb/styler-plugin/icon",
			exportName: "StylerPluginIcon"
		}
	},
	category: {
		id: "visualization",
		menuGroup: "tabular",
		createOrder: 700
	},
	capabilities: {
		canHaveChildren: false,
		canBeRoot: false,
		canBeDeleted: true,
		canBeRenamed: true,
		canBeMoved: true,
		canBeCopied: true
	},
	schema: {
		inherits: "folder",
		fields: [{
			name: "csvData",
			type: "string",
			required: true
		}, {
			name: "mappingConfig",
			type: "object",
			required: true
		}]
	},
	worker: { preload: ["registerStylerWorkerStores"] }
};

//#endregion
//#region src/common/handlers/StylerEntityHandler.ts
function hasData(value) {
	return typeof value === "object" && value !== null && "data" in value;
}
function unwrapHandlerResult(result) {
	if (!result) return void 0;
	if (hasData(result)) return result.data;
	if (typeof result === "object" && result !== null && "success" in result && result.success === false) return;
	return result;
}
/**
* StylerEntityHandler
* Extends SpreadsheetEntityHandler to add style map functionality
*/
var StylerEntityHandler = class {
	spreadsheetHandler;
	dataService;
	constructor(spreadsheetHandler, dataService) {
		this.spreadsheetHandler = spreadsheetHandler;
		this.dataService = dataService;
	}
	async createEntity(nodeId, data) {
		const baseEntity = unwrapHandlerResult(await this.spreadsheetHandler.createEntity(nodeId, data));
		if (!baseEntity) throw new Error("Spreadsheet handler returned no entity during createEntity");
		return {
			success: true,
			data: {
				...baseEntity,
				stylerConfig: data?.stylerConfig || StylerConfigDefault,
				selectedKeyColumn: data?.selectedKeyColumn || "",
				selectedValueColumn: data?.selectedValueColumn || "",
				generatedStyle: data?.generatedStyle
			}
		};
	}
	async getEntity(nodeId) {
		const baseEntity = unwrapHandlerResult(await this.spreadsheetHandler.getEntity(nodeId));
		if (!baseEntity) return { success: false };
		return {
			success: true,
			data: {
				...baseEntity,
				stylerConfig: baseEntity.stylerConfig || StylerConfigDefault,
				selectedKeyColumn: baseEntity.selectedKeyColumn || "",
				selectedValueColumn: baseEntity.selectedValueColumn || "",
				generatedStyle: baseEntity.generatedStyle
			}
		};
	}
	async updateEntity(nodeId, data) {
		const baseEntity = unwrapHandlerResult(await this.spreadsheetHandler.updateEntity(nodeId, data)) ?? unwrapHandlerResult(await this.spreadsheetHandler.getEntity(nodeId));
		let entity;
		if (baseEntity) entity = {
			...baseEntity,
			stylerConfig: baseEntity.stylerConfig || data.stylerConfig || StylerConfigDefault,
			selectedKeyColumn: baseEntity.selectedKeyColumn || data.selectedKeyColumn || "",
			selectedValueColumn: baseEntity.selectedValueColumn || data.selectedValueColumn || "",
			generatedStyle: baseEntity.generatedStyle
		};
		if ((data.stylerConfig || data.selectedKeyColumn || data.selectedValueColumn) && entity && data.spreadsheetMetadataId && entity.stylerConfig.targetProperty) try {
			const { styleSpec, colorMapping } = await this.dataService.generateMapLibreStyle(data.spreadsheetMetadataId, entity);
			entity.generatedStyle = {
				maplibreStyleSpec: styleSpec,
				colorMapping,
				lastUpdated: Date.now()
			};
		} catch (styleError) {
			console.warn("Failed to generate style:", styleError);
		}
		return {
			success: !!entity,
			data: entity
		};
	}
	async deleteEntity(nodeId) {
		const tableId = unwrapHandlerResult(await this.spreadsheetHandler.getEntity(nodeId))?.spreadsheetMetadataId;
		if (tableId) try {
			await this.dataService.removeTableReference(tableId);
		} catch {}
		await this.spreadsheetHandler.deleteEntity(nodeId);
		return { success: true };
	}
};

//#endregion
//#region src/common/extensions/StylerDialogExtension.ts
const isRecord = (value) => typeof value === "object" && value !== null;
const toDialogRecord = (value) => isRecord(value) ? value : {};
const resolveStepNumbers = (stepNumbers) => stepNumbers && stepNumbers.length > 0 ? Array.from(stepNumbers) : [5, 6];
const readNumber = (value) => typeof value === "number" && Number.isFinite(value) ? value : null;
const hasStylerConfiguration = (dialogData) => {
	const configCandidate = isRecord(dialogData.stylerConfig) ? dialogData.stylerConfig : dialogData.stylerConfig;
	if (!configCandidate || typeof configCandidate !== "object") return false;
	const config = configCandidate;
	const targetProperty = typeof config.targetProperty === "string" ? config.targetProperty.trim() : "";
	const mappingCandidate = config.mapping;
	const mapping = isRecord(mappingCandidate) ? mappingCandidate : void 0;
	const min = mapping ? readNumber(mapping.min) : null;
	const max = mapping ? readNumber(mapping.max) : null;
	const selectedValueColumn = typeof dialogData.selectedValueColumn === "string" ? dialogData.selectedValueColumn.trim() : "";
	return Boolean(targetProperty && selectedValueColumn && min !== null && max !== null && min < max);
};
const StylerStep5Component = wrapDialogStepComponent(StylerStep5);
const StylerStep6Component = wrapDialogStepComponent(StylerStep6);
const STYLER_STEP_DEFINITIONS = [{
	stepNumber: 5,
	title: "Style Mapping Configuration",
	component: StylerStep5Component,
	dependsOn: [4],
	validation: { validate: async (data) => hasStylerConfiguration(toDialogRecord(data)) ? { valid: true } : {
		valid: false,
		message: "Styler configuration requires a target property, value column, and valid range."
	} }
}, {
	stepNumber: 6,
	title: "Preview with Style Mapping",
	component: StylerStep6Component,
	dependsOn: [5],
	validation: { validate: async () => ({ valid: true }) },
	isOptional: true
}];
const cloneStepDefinitions = () => STYLER_STEP_DEFINITIONS.map((step) => ({
	...step,
	dependsOn: step.dependsOn ? [...step.dependsOn] : void 0,
	validation: step.validation ? { ...step.validation } : void 0
}));
const evaluateStylerSteps = (data) => {
	const step5Complete = hasStylerConfiguration(toDialogRecord(data));
	return new Map([[5, {
		enabled: true,
		validated: step5Complete
	}], [6, {
		enabled: step5Complete,
		validated: true
	}]]);
};
var StylerDialogExtension = class extends NodeDialogPlugin {
	pluginId = "styler-plugin-dialog-extension";
	pluginName = "Styler Dialog Extension";
	pluginDescription = "Adds Styler dialog steps to plugin console";
	pluginVersion = "1.0.0";
	dependencies = ["spreadsheet-plugin-dialog-extension"];
	getCreateDialogSteps() {
		return cloneStepDefinitions();
	}
	getEditDialogSteps() {
		return cloneStepDefinitions();
	}
	getStepStateEvaluator() {
		return {
			getValidatedSteps: (data, stepNumbers) => {
				const state = evaluateStylerSteps(data);
				return resolveStepNumbers(stepNumbers).map((num) => state.get(num)?.validated ?? true);
			},
			getEnabledSteps: (data, stepNumbers) => {
				const state = evaluateStylerSteps(data);
				return resolveStepNumbers(stepNumbers).map((num) => state.get(num)?.enabled ?? true);
			}
		};
	}
	getSubmitEligibility() {
		return (data) => hasStylerConfiguration(toDialogRecord(data));
	}
};
const stylerDialogExtension = new StylerDialogExtension();
async function initializeStylerDialogExtension() {
	await stylerDialogExtension.initialize();
}

//#endregion
//#region src/index.ts
/**
* @file RuntimeWorkerService.ts
* @description Styler plugin main entry point
* : Styler
* :
* : HierarchiDB
*/
/**
* Backward-compatible alias for consumers that expect the historic PLUGIN_INFO export.
* Metadata now lives in src/plugin-manifest.ts.
*/
const PLUGIN_INFO = PLUGIN_MANIFEST;
/**
* :
* : HierarchiDB
* :
*/
/**
* Legacy initializeStylerPlugin helper has been removed. Consumers should rely on
* StylerDialogExtension / runtime registration instead of the old extension definition path.
*/
const registerRuntimeWorkerAdapters = async () => {};
let initialized = false;
async function onRegister() {
	if (initialized) return;
	initialized = true;
}

//#endregion
export { MAPLIBRE_PROPERTY_GROUPS, MAPLIBRE_PROPERTY_METADATA, PLUGIN_INFO, StylerConfigDefault, StylerDataService, StylerEntityHandler, PLUGIN_MANIFEST as StylerPluginManifest, adjustBrightness, calculateLinearColor, calculateQuantileColor, createColorVariations, generateColorGradient, getContrastRatio, hexToRgb, hsvToRgb, initializeStylerDialogExtension, onRegister, registerRuntimeWorkerAdapters, rgbToHex, rgbToHsv, stylerDialogExtension, valueToColor };
//# sourceMappingURL=index.js.map