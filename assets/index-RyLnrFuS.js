import { t as PLUGIN_MANIFEST } from "./plugin-manifest.js";
import { NodeDialogPlugin } from "@hierarchidb/plugin-ui-sdk";

//#region src/common/extensions/BaseMapDialogExtension.ts
function isValidUrl(u) {
	if (!u) return false;
	try {
		new URL(u);
		return true;
	} catch {
		return false;
	}
}
const isRecord = (value) => typeof value === "object" && value !== null;
const asCoordinateTuple = (value) => {
	if (!Array.isArray(value)) return void 0;
	const [lng, lat] = value;
	return typeof lng === "number" && typeof lat === "number" ? [lng, lat] : void 0;
};
const toDialogData = (value) => {
	if (!isRecord(value)) return {};
	const rawMapStyle = value.mapStyle;
	const mapStyle = isRecord(rawMapStyle) ? {
		style: typeof rawMapStyle.style === "string" ? rawMapStyle.style : void 0,
		customStyleUrl: typeof rawMapStyle.customStyleUrl === "string" ? rawMapStyle.customStyleUrl : void 0
	} : void 0;
	const rawViewport = value.viewport;
	return {
		mapStyle,
		viewport: isRecord(rawViewport) ? {
			center: asCoordinateTuple(rawViewport.center),
			zoom: typeof rawViewport.zoom === "number" ? rawViewport.zoom : void 0
		} : void 0
	};
};
const hasValidStyleStep = (data) => {
	const style = data.mapStyle?.style;
	if (!style) return false;
	if (style === "custom") return isValidUrl(data.mapStyle?.customStyleUrl);
	return true;
};
const hasValidViewportStep = (data) => {
	const center = data.viewport?.center;
	if (!center) return false;
	const [lng, lat] = center;
	const zoom = data.viewport?.zoom;
	return typeof lng === "number" && lng >= -180 && lng <= 180 && typeof lat === "number" && lat >= -90 && lat <= 90 && typeof zoom === "number" && zoom >= 0 && zoom <= 24;
};
const resolveStepNumbers = (stepNumbers) => stepNumbers && stepNumbers.length > 0 ? Array.from(stepNumbers) : [2, 3];
var BaseMapDialogExtension = class extends NodeDialogPlugin {
	pluginId = "basemap-plugin-dialog-extension";
	pluginName = "BaseMap Dialog Extension";
	pluginDescription = "Adds BaseMap step evaluators to plugin console";
	pluginVersion = "1.0.0";
	getStepStateEvaluator() {
		return {
			getValidatedSteps: (data, stepNumbers) => {
				const dialogData = toDialogData(data);
				return resolveStepNumbers(stepNumbers).map((n) => {
					if (n === 2) return hasValidStyleStep(dialogData);
					if (n === 3) return hasValidViewportStep(dialogData);
					return true;
				});
			},
			getEnabledSteps: (data, stepNumbers) => {
				const dialogData = toDialogData(data);
				const filled = /* @__PURE__ */ new Map();
				const ok2 = (() => {
					return hasValidStyleStep(dialogData);
				})();
				const ok3 = (() => {
					return hasValidViewportStep(dialogData);
				})();
				filled.set(2, ok2);
				filled.set(3, ok3);
				return resolveStepNumbers(stepNumbers).map((n) => {
					if (n === 2) return true;
					if (n === 3) return filled.get(2) === true;
					return true;
				});
			}
		};
	}
	getSubmitEligibility() {
		return (data) => {
			const dialogData = toDialogData(data);
			if (!hasValidStyleStep(dialogData)) return false;
			return hasValidViewportStep(dialogData);
		};
	}
};
const baseMapDialogExtension = new BaseMapDialogExtension();
async function initializeBaseMapDialogExtension() {
	await baseMapDialogExtension.initialize();
}

//#endregion
//#region src/index.ts
/**
* BaseMap Plugin - Standard Structure Export
* Following HierarchiDB plugin standard conventions
*/
const BASEMAP_CONSTANTS = {
	DEFAULT_VIEWPORT: {
		center: [139.6917, 35.6895],
		zoom: 10,
		bearing: 0,
		pitch: 0
	},
	MAP_STYLE_PRESETS: {
		streets: "Standard street map view",
		satellite: "Satellite imagery view",
		terrain: "Topographical terrain view",
		dark: "Dark theme for low-light viewing",
		light: "Clean light theme",
		custom: "Custom MapLibre style URL"
	},
	VALIDATION_LIMITS: {
		LONGITUDE_MIN: -180,
		LONGITUDE_MAX: 180,
		LATITUDE_MIN: -90,
		LATITUDE_MAX: 90,
		ZOOM_MIN: 0,
		ZOOM_MAX: 24,
		BEARING_MIN: 0,
		BEARING_MAX: 360,
		PITCH_MIN: 0,
		PITCH_MAX: 60
	}
};
const PLUGIN_INFO = PLUGIN_MANIFEST;
var RuntimeWiring = class {};

//#endregion
export { BASEMAP_CONSTANTS, PLUGIN_MANIFEST as BaseMapPluginManifest, PLUGIN_INFO, RuntimeWiring, baseMapDialogExtension, initializeBaseMapDialogExtension };
//# sourceMappingURL=index.js.map