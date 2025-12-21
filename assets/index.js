import { r as __toDynamicImportESM } from "../chunk.js";
import { loadMapLibreMap } from "@hierarchidb/ui-map";
import { Alert, Box, Card, CardActionArea, CardContent, Chip, CircularProgress, Paper, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { Suspense, createContext, lazy, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { getWorkerClientHook } from "@hierarchidb/ui-worker-provider";
import { createTreeNodeUpdaterActions, useTreeNodeUpdater } from "@hierarchidb/plugin-ui-sdk";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { DarkMode, LightMode, Map, Satellite, Terrain, Tune } from "@mui/icons-material";
import * as ReactI18NextModule from "react-i18next";
import { useTranslation } from "react-i18next";
import i18next from "i18next";
import { atom } from "jotai";
import { createStore } from "jotai/vanilla";
import { PluginStepRegistry } from "@hierarchidb/plugin-base";

//#region src/common/constants/builtInStyles.ts
/**
* Built-in map styles available without API keys
* These are free, reliable map tile services
*/
const BUILT_IN_STYLES = {
	streets: {
		id: "streets",
		name: "Streets",
		description: "Standard street map with roads, labels, and points of interest",
		url: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
		thumbnailUrl: "https://carto.com/help/images/building-maps/basemaps/voyager.png",
		attribution: "© CARTO © OpenStreetMap contributors",
		free: true,
		requiresApiKey: false
	},
	satellite: {
		id: "satellite",
		name: "Satellite",
		description: "Satellite imagery view",
		url: "https://demotiles.maplibre.org/style.json",
		attribution: "© MapLibre © OpenStreetMap contributors",
		free: false,
		requiresApiKey: true
	},
	terrain: {
		id: "terrain",
		name: "Terrain",
		description: "Topographical map with elevation contours",
		url: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
		attribution: "© CARTO © OpenStreetMap contributors",
		free: true,
		requiresApiKey: false
	},
	dark: {
		id: "dark",
		name: "Dark",
		description: "Dark theme optimized for data visualization",
		url: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
		thumbnailUrl: "https://carto.com/help/images/building-maps/basemaps/dark-matter.png",
		attribution: "© CARTO © OpenStreetMap contributors",
		free: true,
		requiresApiKey: false
	},
	light: {
		id: "light",
		name: "Light",
		description: "Minimal light theme perfect for overlaying data",
		url: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
		thumbnailUrl: "https://carto.com/help/images/building-maps/basemaps/positron.png",
		attribution: "© CARTO © OpenStreetMap contributors",
		free: true,
		requiresApiKey: false
	}
};
/**
* Get style URL by style type
* Falls back to streets style if not found
*/
function getBuiltInStyleUrl(styleType) {
	if (styleType === "custom") return BUILT_IN_STYLES.streets.url;
	return BUILT_IN_STYLES[styleType]?.url || BUILT_IN_STYLES.streets.url;
}
/**
* Get attribution text for a style
*/
function getStyleAttribution(styleType) {
	if (styleType === "custom") return "© Map data contributors";
	return BUILT_IN_STYLES[styleType]?.attribution || BUILT_IN_STYLES.streets.attribution;
}

//#endregion
//#region src/ui/hooks/useBaseMapEntity.ts
/**
* @file useBaseMapEntity.ts
* @description React hook for fetching and managing BaseMap entity data
*/
const DEFAULT_MAP_STYLE = { style: "streets" };
const DEFAULT_VIEWPORT = {
	center: [0, 0],
	zoom: 1,
	bearing: 0,
	pitch: 0
};
function isRecord$1(value) {
	return typeof value === "object" && value !== null;
}
const coerceMapStyle = (value) => {
	if (isRecord$1(value) && typeof value.style === "string") return { ...value };
	return { ...DEFAULT_MAP_STYLE };
};
const coerceViewport = (value) => {
	if (!isRecord$1(value)) return void 0;
	const center = value.center;
	const zoom = value.zoom;
	if (Array.isArray(center) && center.length === 2 && typeof center[0] === "number" && typeof center[1] === "number" && typeof zoom === "number") return { ...value };
};
const readNodeData = (node) => {
	if (!node) return {};
	const nodeRecord = node;
	const rawData = nodeRecord.draftData ?? nodeRecord.data;
	return isRecord$1(rawData) ? rawData : {};
};
function buildBaseMapEntityFromNode(node) {
	if (!node) return null;
	const data = readNodeData(node);
	const mapStyle = coerceMapStyle(data.mapStyle);
	const viewport = coerceViewport(data.viewport);
	const draftMetadata = node.draftMetadata;
	const committedMetadata = node.metadata;
	return {
		mapStyle,
		viewport,
		draftMetadata: draftMetadata || committedMetadata || {
			name: "",
			description: "",
			tags: []
		}
	};
}
/**
* Hook to fetch and manage BaseMap entity
* @param nodeId - Node ID of the BaseMap entity
* @param options - Hook options
* @returns BaseMap entity state and methods
*/
function useBaseMapEntity(nodeId, options = {}) {
	const { skip = false, pollingInterval, initialData } = options;
	const [entity, setEntity] = useState(initialData || null);
	const [loading, setLoading] = useState(!initialData && !skip);
	const [error, setError] = useState(null);
	const askedGeolocationRef = useRef(false);
	const workerClientHook = useMemo(() => {
		try {
			return getWorkerClientHook();
		} catch {
			return null;
		}
	}, []);
	const workerClient = workerClientHook ? workerClientHook() : null;
	const { treeNodeUpdater, updateTreeNodeUpdater, commitTreeNodeUpdater, discardDraft } = useTreeNodeUpdater({
		mode: nodeId ? "edit" : "create",
		nodeType: "basemap",
		parentId: nodeId ?? void 0,
		treeId: nodeId ?? "",
		workerClient,
		initialDraftData: {
			mapStyle: { ...DEFAULT_MAP_STYLE },
			viewport: void 0
		},
		initialDraftMetadata: nodeId ? {
			name: "",
			description: "",
			tags: []
		} : void 0
	});
	const { updatePayload, updatePayloadAndMetadata } = useMemo(() => createTreeNodeUpdaterActions(updateTreeNodeUpdater), [updateTreeNodeUpdater]);
	const fetchEntity = useCallback(async () => {
		if (!nodeId || skip) return;
		try {
			setLoading(true);
			setError(null);
			if (!workerClient) throw new Error("Worker client unavailable");
			const data = buildBaseMapEntityFromNode(await (await workerClient.getAPI().getQueryAPI()).getNode(nodeId));
			if (!data) throw new Error("BaseMap entity not found");
			if (treeNodeUpdater && data.draftMetadata) updateTreeNodeUpdater({ draftMetadata: {
				name: data.draftMetadata.name ?? "",
				description: data.draftMetadata.description ?? "",
				tags: data.draftMetadata.tags ?? []
			} });
			setEntity(data);
		} catch (err) {
			console.error("Failed to fetch BaseMap entity:", err);
			setError(err instanceof Error ? err : /* @__PURE__ */ new Error("Failed to fetch entity"));
			setEntity(null);
		} finally {
			setLoading(false);
		}
	}, [
		nodeId,
		skip,
		workerClient
	]);
	const resolveViewport = useCallback(async () => {
		if (typeof navigator !== "undefined" && navigator.geolocation) try {
			const { latitude, longitude } = (await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject))).coords;
			return {
				center: [longitude || 0, latitude || 0],
				zoom: 1,
				bearing: 0,
				pitch: 0
			};
		} catch {}
		return DEFAULT_VIEWPORT;
	}, []);
	const geolocationCacheRef = useRef(null);
	const getOrResolveViewport = useCallback(async () => {
		if (geolocationCacheRef.current) return geolocationCacheRef.current;
		const viewport = await resolveViewport();
		geolocationCacheRef.current = viewport;
		return viewport;
	}, [resolveViewport]);
	const updateEntity = useCallback(async (id, updater) => {
		if (!nodeId) throw new Error("Cannot update entity without nodeId");
		setLoading(true);
		try {
			if (!treeNodeUpdater) throw new Error("No draft available for basemap");
			updateTreeNodeUpdater({ treeNodeId: id });
			updatePayloadAndMetadata({
				mapStyle: updater.payload.draftData?.mapStyle ?? { ...DEFAULT_MAP_STYLE },
				viewport: updater.payload.draftData?.viewport
			}, {
				name: updater.payload.draftMetadata?.name ?? "",
				description: updater.payload.draftMetadata?.description ?? "",
				tags: updater.payload.draftMetadata?.tags ?? []
			});
			await commitTreeNodeUpdater("save", treeNodeUpdater);
			await fetchEntity();
		} catch (err) {
			console.error("Failed to update BaseMap entity:", err);
			setError(err instanceof Error ? err : /* @__PURE__ */ new Error("Failed to update entity"));
			throw err;
		} finally {
			setLoading(false);
		}
	}, [
		fetchEntity,
		nodeId,
		treeNodeUpdater,
		updatePayloadAndMetadata,
		updateTreeNodeUpdater,
		commitTreeNodeUpdater
	]);
	useEffect(() => {
		fetchEntity().then(() => {
			if (!entity || entity.viewport) return;
			if (askedGeolocationRef.current) return;
			askedGeolocationRef.current = true;
			if (geolocationCacheRef.current) {
				const cached = geolocationCacheRef.current;
				setEntity((prev) => prev ? {
					...prev,
					viewport: cached
				} : prev);
				if (treeNodeUpdater) updatePayload({ viewport: cached }, treeNodeUpdater.draftData ?? void 0);
				return;
			}
			const fallbackViewport = DEFAULT_VIEWPORT;
			setEntity((prev) => prev ? {
				...prev,
				viewport: fallbackViewport
			} : prev);
			if (treeNodeUpdater) updatePayload({ viewport: fallbackViewport }, treeNodeUpdater.draftData ?? void 0);
			if (typeof window !== "undefined") window.setTimeout(async () => {
				if (!navigator?.geolocation) return;
				if (!window.confirm("Use your current location to set the initial basemap view?")) return;
				const geoViewport = await getOrResolveViewport();
				setEntity((prev) => prev ? {
					...prev,
					viewport: geoViewport
				} : prev);
				if (treeNodeUpdater) updatePayload({ viewport: geoViewport }, treeNodeUpdater.draftData ?? void 0);
			}, 0);
		});
	}, [
		entity,
		fetchEntity,
		getOrResolveViewport,
		treeNodeUpdater,
		updateTreeNodeUpdater
	]);
	useEffect(() => {
		return () => {
			discardDraft().catch(() => {});
		};
	}, [discardDraft]);
	useEffect(() => {
		if (!pollingInterval || !nodeId || skip) return;
		const interval = setInterval(fetchEntity, pollingInterval);
		return () => clearInterval(interval);
	}, [
		fetchEntity,
		nodeId,
		pollingInterval,
		skip
	]);
	return {
		entity,
		loading,
		error,
		refetch: fetchEntity,
		updateEntity
	};
}
/**
* Hook to fetch BaseMap configuration for export/display
* @param nodeId - Node ID of the BaseMap entity
* @returns BaseMap configuration
*/
function useBaseMapConfiguration(nodeId) {
	const { entity, loading, error } = useBaseMapEntity(nodeId, { skip: !nodeId });
	return {
		config: entity ? {
			mapStyle: entity.mapStyle,
			viewport: entity.viewport
		} : null,
		loading,
		error
	};
}
/**
* Hook to validate BaseMap configuration
* @param config - Partial BaseMap entity configuration
* @returns Validation result
*/
function useBaseMapValidation(config) {
	const [validation, setValidation] = useState({
		isValid: true,
		errors: []
	});
	const [validating, setValidating] = useState(false);
	useEffect(() => {
		const validate = () => {
			setValidating(true);
			try {
				const errors$2 = [];
				if (config.mapStyle) {
					const { style, customStyleUrl } = config.mapStyle;
					if (![
						"streets",
						"satellite",
						"terrain",
						"dark",
						"light",
						"custom"
					].includes(style)) errors$2.push("Invalid map style");
					if (style === "custom") if (!customStyleUrl) errors$2.push("Custom style URL is required when using custom style");
					else try {
						new URL(customStyleUrl);
					} catch {
						errors$2.push("Invalid custom style URL format");
					}
				}
				if (config.viewport) {
					const { center, zoom, bearing, pitch } = config.viewport;
					if (!Array.isArray(center) || center.length !== 2 || typeof center[0] !== "number" || typeof center[1] !== "number") errors$2.push("Valid center coordinates are required");
					if (typeof zoom !== "number" || zoom < 0 || zoom > 24) errors$2.push("Zoom must be a number between 0 and 24");
					if (typeof bearing !== "number" || bearing < 0 || bearing >= 360) errors$2.push("Bearing must be a number between 0 and 360");
					if (typeof pitch !== "number" || pitch < 0 || pitch > 60) errors$2.push("Pitch must be a number between 0 and 60");
				}
				setValidation({
					isValid: errors$2.length === 0,
					errors: errors$2
				});
			} catch (err) {
				console.error("Validation error:", err);
				setValidation({
					isValid: false,
					errors: [`Validation failed: ${err.message}`]
				});
			} finally {
				setValidating(false);
			}
		};
		const timer = setTimeout(validate, 300);
		return () => clearTimeout(timer);
	}, [config]);
	return {
		...validation,
		validating
	};
}
const __testUtils = { buildBaseMapEntityFromNode };

//#endregion
//#region src/ui/utils/mapStyle.ts
function isObject(value) {
	return typeof value === "object" && value !== null;
}
function isMapLibreStyleConfig(value) {
	if (!isObject(value)) return false;
	const candidate = value;
	const layers = candidate.layers;
	const sources = candidate.sources;
	const hasLayers = Array.isArray(layers);
	const hasSources = isObject(sources);
	const hasVersion = typeof candidate.version === "number";
	return hasLayers && hasSources && hasVersion;
}
function resolveMapStyleSource(mapStyle) {
	if (mapStyle.style === "custom") {
		if (mapStyle.customStyleUrl) return mapStyle.customStyleUrl;
		if (mapStyle.customStyleConfig && isMapLibreStyleConfig(mapStyle.customStyleConfig)) return mapStyle.customStyleConfig;
	}
	return BUILT_IN_STYLES[mapStyle.style]?.url ?? BUILT_IN_STYLES.streets.url;
}
function resolvePreviewMapStyle(mapStyle) {
	if (mapStyle.style === "custom") {
		if (mapStyle.customStyleUrl) return mapStyle.customStyleUrl;
		if (mapStyle.customStyleConfig && isMapLibreStyleConfig(mapStyle.customStyleConfig)) return mapStyle.customStyleConfig;
	}
	return getBuiltInStyleUrl(mapStyle.style);
}

//#endregion
//#region src/ui/components/BaseMapDisplay.tsx
const LazyMapLibreMap$2 = lazy(async () => {
	return { default: (await loadMapLibreMap()).MapLibreMap };
});
/**
* BaseMap Display Component
* Renders a MapLibre map with BaseMap entity configuration
*/
const BaseMapDisplay = ({ nodeId, entity: providedEntity, width = "100%", height = "400px", style, onLoad, onViewStateChange, showLoadingIndicator = true, interactive = true, datasetId, enableDemoOverlay = false }) => {
	const shouldFetch = !providedEntity && Boolean(nodeId);
	const { entity: fetchedEntity, loading: remoteLoading, error: remoteError } = useBaseMapEntity(shouldFetch ? nodeId : null, { skip: !shouldFetch });
	const entity = providedEntity ?? fetchedEntity ?? void 0;
	const [loading, setLoading] = useState(!providedEntity);
	const [error, setError] = useState(null);
	const [_mapInstance, setMapInstance] = useState(null);
	const unbindRef = useRef(null);
	useEffect(() => {
		if (providedEntity) {
			setLoading(false);
			setError(null);
			return;
		}
		setLoading(remoteLoading);
		setError(remoteError ? remoteError.message ?? "Failed to load map configuration" : null);
	}, [
		providedEntity,
		remoteLoading,
		remoteError
	]);
	const initialViewState = useMemo(() => {
		if (!entity?.viewport) return void 0;
		return {
			longitude: entity.viewport.center[0],
			latitude: entity.viewport.center[1],
			zoom: entity.viewport.zoom,
			bearing: entity.viewport.bearing || 0,
			pitch: entity.viewport.pitch || 0
		};
	}, [entity]);
	const mapStyleSource = useMemo(() => {
		if (!entity?.mapStyle) return BUILT_IN_STYLES.streets.url;
		return resolveMapStyleSource(entity.mapStyle);
	}, [entity?.mapStyle]);
	const handleMapLoad = useCallback((map) => {
		setMapInstance(map);
		map.once("styledata", () => {
			if (!enableDemoOverlay) return;
			const c = {
				lng: entity?.viewport?.center?.[0] ?? 0,
				lat: entity?.viewport?.center?.[1] ?? 0
			};
			const dx = .05, dy = .03;
			const mkPoly = (cx, cy, w, h) => [
				[cx - w, cy - h],
				[cx + w, cy - h],
				[cx + w, cy + h],
				[cx - w, cy + h],
				[cx - w, cy - h]
			];
			const demoData = {
				type: "FeatureCollection",
				features: [{
					type: "Feature",
					id: "demo-1",
					properties: {
						name: "Demo Area A",
						nodeType: "basemap"
					},
					geometry: {
						type: "Polygon",
						coordinates: [mkPoly(c.lng - .08, c.lat, dx, dy)]
					}
				}, {
					type: "Feature",
					id: "demo-2",
					properties: {
						name: "Demo Area B",
						nodeType: "basemap"
					},
					geometry: {
						type: "Polygon",
						coordinates: [mkPoly(c.lng + .08, c.lat, dx, dy)]
					}
				}]
			};
			if (!map.getSource("demo-source")) map.addSource("demo-source", {
				type: "geojson",
				data: demoData
			});
			if (!map.getLayer("demo-fill")) map.addLayer({
				id: "demo-fill",
				type: "fill",
				source: "demo-source",
				paint: {
					"fill-color": [
						"case",
						["to-boolean", ["features-state", "selected"]],
						"#1976d2",
						["to-boolean", ["features-state", "hovered"]],
						"#64b5f6",
						"#3f51b5"
					],
					"fill-opacity": .25
				}
			});
			if (!map.getLayer("demo-outline")) map.addLayer({
				id: "demo-outline",
				type: "line",
				source: "demo-source",
				paint: {
					"line-color": [
						"case",
						["to-boolean", ["features-state", "selected"]],
						"#0d47a1",
						["to-boolean", ["features-state", "hovered"]],
						"#1976d2",
						"#283593"
					],
					"line-width": [
						"case",
						["to-boolean", ["features-state", "selected"]],
						3,
						["to-boolean", ["features-state", "hovered"]],
						2.5,
						2
					]
				}
			});
		});
		onLoad?.(map);
	}, [
		enableDemoOverlay,
		entity?.viewport?.center,
		onLoad
	]);
	useEffect(() => {
		if (!_mapInstance) return;
		const unbind = unbindRef.current;
		return () => {
			unbind?.();
		};
	}, [_mapInstance]);
	const handleViewStateChange = useCallback((viewState) => {
		onViewStateChange?.(viewState);
	}, [onViewStateChange]);
	if (loading && showLoadingIndicator) return /* @__PURE__ */ jsx(Box, {
		sx: {
			display: "flex",
			justifyContent: "center",
			alignItems: "center",
			width,
			height,
			...style
		},
		children: /* @__PURE__ */ jsx(CircularProgress, {})
	});
	if (error) return /* @__PURE__ */ jsx(Box, {
		sx: {
			width,
			height,
			p: 2,
			...style
		},
		children: /* @__PURE__ */ jsx(Alert, {
			severity: "error",
			children: /* @__PURE__ */ jsx(Typography, {
				variant: "body2",
				children: error
			})
		})
	});
	if (!entity || !initialViewState) return /* @__PURE__ */ jsx(Box, {
		sx: {
			width,
			height,
			p: 2,
			...style
		},
		children: /* @__PURE__ */ jsx(Alert, {
			severity: "info",
			children: /* @__PURE__ */ jsx(Typography, {
				variant: "body2",
				children: "No map configuration available"
			})
		})
	});
	const mapStyleProps = typeof mapStyleSource === "string" ? { mapStyleUrl: mapStyleSource } : { mapStyleObject: mapStyleSource };
	return /* @__PURE__ */ jsx(Box, {
		sx: {
			width,
			height,
			position: "relative",
			...style
		},
		children: /* @__PURE__ */ jsx(Suspense, {
			fallback: /* @__PURE__ */ jsx(Box, {
				sx: {
					position: "absolute",
					inset: 0,
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					backgroundColor: "rgba(247, 250, 252, 0.6)"
				},
				children: /* @__PURE__ */ jsx(CircularProgress, { size: 32 })
			}),
			children: /* @__PURE__ */ jsx(LazyMapLibreMap$2, {
				initialViewState,
				...mapStyleProps,
				width: "100%",
				height: "100%",
				onLoad: handleMapLoad,
				onViewStateChange: handleViewStateChange,
				mapOptions: {
					interactive,
					scrollZoom: interactive,
					dragPan: interactive,
					dragRotate: interactive,
					doubleClickZoom: interactive,
					touchZoomRotate: interactive
				}
			})
		})
	});
};

//#endregion
//#region src/ui/components/BaseMapPreview.tsx
/**
* @file BaseMapPreview.tsx
* @description BaseMap preview component for base-dialog and panel views
* Shows a live preview of the configured basemap settings
*/
/**
* Icon mapping for map styles
*/
const STYLE_ICONS = {
	streets: /* @__PURE__ */ jsx(Map, {}),
	satellite: /* @__PURE__ */ jsx(Satellite, {}),
	terrain: /* @__PURE__ */ jsx(Terrain, {}),
	dark: /* @__PURE__ */ jsx(DarkMode, {}),
	light: /* @__PURE__ */ jsx(LightMode, {}),
	custom: /* @__PURE__ */ jsx(Tune, {})
};
const LazyMapLibreMap$1 = lazy(async () => {
	return { default: (await loadMapLibreMap()).MapLibreMap };
});
/**
* BaseMap Preview Component
* Provides a preview of the basemap configuration
*/
const BaseMapPreview = ({ mapStyle, viewport, zxy, width = "100%", height = 300, showMetadata = true, interactive = false, title = "BaseMap Preview" }) => {
	const initialViewState = useMemo(() => ({
		longitude: viewport.center[0],
		latitude: viewport.center[1],
		zoom: viewport.zoom,
		bearing: viewport.bearing || 0,
		pitch: viewport.pitch || 0
	}), [viewport]);
	const zxyString = useMemo(() => {
		if (zxy) return zxy;
		return `${viewport.zoom},${viewport.center[0]},${viewport.center[1]}`;
	}, [zxy, viewport]);
	const handleMapClick = () => {
		if (!interactive) {
			const baseUrl = window.location.origin;
			const sanitized = (typeof import.meta !== "undefined" ? import.meta.env?.VITE_APP_PREFIX : void 0)?.replace(/^\/+|\/+$/g, "");
			const mapUrl = `${baseUrl}${sanitized ? `/${sanitized}/` : "/"}map?zxy=${zxyString}`;
			window.open(mapUrl, "_blank");
		}
	};
	const mapStyleSource = useMemo(() => resolvePreviewMapStyle(mapStyle), [mapStyle]);
	const attribution = useMemo(() => {
		if (mapStyle.style !== "custom") return getStyleAttribution(mapStyle.style);
		return "© Map contributors";
	}, [mapStyle]);
	const mapStyleProps = typeof mapStyleSource === "string" ? { mapStyleUrl: mapStyleSource } : { mapStyleObject: mapStyleSource };
	return /* @__PURE__ */ jsxs(Paper, {
		elevation: 1,
		sx: {
			width,
			overflow: "hidden",
			borderRadius: 2,
			position: "relative"
		},
		children: [showMetadata && /* @__PURE__ */ jsx(Box, {
			sx: {
				p: 2,
				borderBottom: 1,
				borderColor: "divider"
			},
			children: /* @__PURE__ */ jsxs(Stack, {
				direction: "row",
				alignItems: "center",
				spacing: 1,
				children: [
					STYLE_ICONS[mapStyle.style],
					/* @__PURE__ */ jsx(Typography, {
						variant: "subtitle1",
						fontWeight: "medium",
						children: title
					}),
					/* @__PURE__ */ jsx(Chip, {
						label: mapStyle.style,
						size: "small",
						variant: "outlined",
						color: "primary"
					})
				]
			})
		}), /* @__PURE__ */ jsxs(Box, {
			sx: {
				position: "relative",
				height,
				cursor: !interactive ? "pointer" : "grab"
			},
			onClick: handleMapClick,
			title: !interactive ? `Click to open map at ${zxyString}` : void 0,
			children: [/* @__PURE__ */ jsx(Suspense, {
				fallback: /* @__PURE__ */ jsx(Box, {
					sx: {
						position: "absolute",
						inset: 0,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						backgroundColor: "rgba(247,250,252,0.6)",
						borderRadius: 1
					},
					children: /* @__PURE__ */ jsx(Typography, {
						variant: "caption",
						color: "text.secondary",
						children: "Loading map preview…"
					})
				}),
				children: /* @__PURE__ */ jsx(LazyMapLibreMap$1, {
					initialViewState,
					...mapStyleProps,
					width: "100%",
					height: "100%",
					mapOptions: {
						interactive,
						scrollZoom: interactive,
						dragPan: interactive,
						dragRotate: interactive,
						doubleClickZoom: interactive,
						touchZoomRotate: interactive
					},
					onLoad: () => void 0
				})
			}), showMetadata && /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx(Box, {
				sx: {
					position: "absolute",
					top: 8,
					left: 8,
					backgroundColor: "rgba(255, 255, 255, 0.9)",
					px: 1.5,
					py: .5,
					borderRadius: 1,
					boxShadow: 1
				},
				children: /* @__PURE__ */ jsxs(Typography, {
					variant: "caption",
					sx: { fontFamily: "monospace" },
					children: [
						viewport.center[0].toFixed(4),
						", ",
						viewport.center[1].toFixed(4),
						" | z",
						viewport.zoom.toFixed(1)
					]
				})
			}), /* @__PURE__ */ jsx(Box, {
				sx: {
					position: "absolute",
					bottom: 0,
					right: 0,
					backgroundColor: "rgba(255, 255, 255, 0.8)",
					px: 1,
					py: .25,
					fontSize: "10px",
					maxWidth: "40%",
					textAlign: "right"
				},
				children: /* @__PURE__ */ jsx(Typography, {
					variant: "caption",
					sx: { fontSize: "10px" },
					children: attribution
				})
			})] })]
		})]
	});
};

//#endregion
//#region ../../node_modules/.pnpm/i18next-browser-languagedetector@8.2.0/node_modules/i18next-browser-languagedetector/dist/esm/i18nextBrowserLanguageDetector.js
const { slice: slice$1, forEach } = [];
function defaults(obj) {
	forEach.call(slice$1.call(arguments, 1), (source) => {
		if (source) {
			for (const prop in source) if (obj[prop] === void 0) obj[prop] = source[prop];
		}
	});
	return obj;
}
function hasXSS(input) {
	if (typeof input !== "string") return false;
	return [
		/<\s*script.*?>/i,
		/<\s*\/\s*script\s*>/i,
		/<\s*img.*?on\w+\s*=/i,
		/<\s*\w+\s*on\w+\s*=.*?>/i,
		/javascript\s*:/i,
		/vbscript\s*:/i,
		/expression\s*\(/i,
		/eval\s*\(/i,
		/alert\s*\(/i,
		/document\.cookie/i,
		/document\.write\s*\(/i,
		/window\.location/i,
		/innerHTML/i
	].some((pattern) => pattern.test(input));
}
const fieldContentRegExp = /^[\u0009\u0020-\u007e\u0080-\u00ff]+$/;
const serializeCookie = function(name$2, val) {
	const opt = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : { path: "/" };
	let str = `${name$2}=${encodeURIComponent(val)}`;
	if (opt.maxAge > 0) {
		const maxAge = opt.maxAge - 0;
		if (Number.isNaN(maxAge)) throw new Error("maxAge should be a Number");
		str += `; Max-Age=${Math.floor(maxAge)}`;
	}
	if (opt.domain) {
		if (!fieldContentRegExp.test(opt.domain)) throw new TypeError("option domain is invalid");
		str += `; Domain=${opt.domain}`;
	}
	if (opt.path) {
		if (!fieldContentRegExp.test(opt.path)) throw new TypeError("option path is invalid");
		str += `; Path=${opt.path}`;
	}
	if (opt.expires) {
		if (typeof opt.expires.toUTCString !== "function") throw new TypeError("option expires is invalid");
		str += `; Expires=${opt.expires.toUTCString()}`;
	}
	if (opt.httpOnly) str += "; HttpOnly";
	if (opt.secure) str += "; Secure";
	if (opt.sameSite) switch (typeof opt.sameSite === "string" ? opt.sameSite.toLowerCase() : opt.sameSite) {
		case true:
			str += "; SameSite=Strict";
			break;
		case "lax":
			str += "; SameSite=Lax";
			break;
		case "strict":
			str += "; SameSite=Strict";
			break;
		case "none":
			str += "; SameSite=None";
			break;
		default: throw new TypeError("option sameSite is invalid");
	}
	if (opt.partitioned) str += "; Partitioned";
	return str;
};
const cookie = {
	create(name$2, value, minutes, domain) {
		let cookieOptions = arguments.length > 4 && arguments[4] !== void 0 ? arguments[4] : {
			path: "/",
			sameSite: "strict"
		};
		if (minutes) {
			cookieOptions.expires = /* @__PURE__ */ new Date();
			cookieOptions.expires.setTime(cookieOptions.expires.getTime() + minutes * 60 * 1e3);
		}
		if (domain) cookieOptions.domain = domain;
		document.cookie = serializeCookie(name$2, value, cookieOptions);
	},
	read(name$2) {
		const nameEQ = `${name$2}=`;
		const ca = document.cookie.split(";");
		for (let i = 0; i < ca.length; i++) {
			let c = ca[i];
			while (c.charAt(0) === " ") c = c.substring(1, c.length);
			if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
		}
		return null;
	},
	remove(name$2, domain) {
		this.create(name$2, "", -1, domain);
	}
};
var cookie$1 = {
	name: "cookie",
	lookup(_ref) {
		let { lookupCookie } = _ref;
		if (lookupCookie && typeof document !== "undefined") return cookie.read(lookupCookie) || void 0;
	},
	cacheUserLanguage(lng, _ref2) {
		let { lookupCookie, cookieMinutes, cookieDomain, cookieOptions } = _ref2;
		if (lookupCookie && typeof document !== "undefined") cookie.create(lookupCookie, lng, cookieMinutes, cookieDomain, cookieOptions);
	}
};
var querystring = {
	name: "querystring",
	lookup(_ref) {
		let { lookupQuerystring } = _ref;
		let found;
		if (typeof window !== "undefined") {
			let { search } = window.location;
			if (!window.location.search && window.location.hash?.indexOf("?") > -1) search = window.location.hash.substring(window.location.hash.indexOf("?"));
			const params = search.substring(1).split("&");
			for (let i = 0; i < params.length; i++) {
				const pos = params[i].indexOf("=");
				if (pos > 0) {
					if (params[i].substring(0, pos) === lookupQuerystring) found = params[i].substring(pos + 1);
				}
			}
		}
		return found;
	}
};
var hash = {
	name: "hash",
	lookup(_ref) {
		let { lookupHash, lookupFromHashIndex } = _ref;
		let found;
		if (typeof window !== "undefined") {
			const { hash: hash$1 } = window.location;
			if (hash$1 && hash$1.length > 2) {
				const query = hash$1.substring(1);
				if (lookupHash) {
					const params = query.split("&");
					for (let i = 0; i < params.length; i++) {
						const pos = params[i].indexOf("=");
						if (pos > 0) {
							if (params[i].substring(0, pos) === lookupHash) found = params[i].substring(pos + 1);
						}
					}
				}
				if (found) return found;
				if (!found && lookupFromHashIndex > -1) {
					const language = hash$1.match(/\/([a-zA-Z-]*)/g);
					if (!Array.isArray(language)) return void 0;
					return language[typeof lookupFromHashIndex === "number" ? lookupFromHashIndex : 0]?.replace("/", "");
				}
			}
		}
		return found;
	}
};
let hasLocalStorageSupport = null;
const localStorageAvailable = () => {
	if (hasLocalStorageSupport !== null) return hasLocalStorageSupport;
	try {
		hasLocalStorageSupport = typeof window !== "undefined" && window.localStorage !== null;
		if (!hasLocalStorageSupport) return false;
		const testKey = "i18next.translate.boo";
		window.localStorage.setItem(testKey, "foo");
		window.localStorage.removeItem(testKey);
	} catch (e) {
		hasLocalStorageSupport = false;
	}
	return hasLocalStorageSupport;
};
var localStorage$1 = {
	name: "localStorage",
	lookup(_ref) {
		let { lookupLocalStorage } = _ref;
		if (lookupLocalStorage && localStorageAvailable()) return window.localStorage.getItem(lookupLocalStorage) || void 0;
	},
	cacheUserLanguage(lng, _ref2) {
		let { lookupLocalStorage } = _ref2;
		if (lookupLocalStorage && localStorageAvailable()) window.localStorage.setItem(lookupLocalStorage, lng);
	}
};
let hasSessionStorageSupport = null;
const sessionStorageAvailable = () => {
	if (hasSessionStorageSupport !== null) return hasSessionStorageSupport;
	try {
		hasSessionStorageSupport = typeof window !== "undefined" && window.sessionStorage !== null;
		if (!hasSessionStorageSupport) return false;
		const testKey = "i18next.translate.boo";
		window.sessionStorage.setItem(testKey, "foo");
		window.sessionStorage.removeItem(testKey);
	} catch (e) {
		hasSessionStorageSupport = false;
	}
	return hasSessionStorageSupport;
};
var sessionStorage = {
	name: "sessionStorage",
	lookup(_ref) {
		let { lookupSessionStorage } = _ref;
		if (lookupSessionStorage && sessionStorageAvailable()) return window.sessionStorage.getItem(lookupSessionStorage) || void 0;
	},
	cacheUserLanguage(lng, _ref2) {
		let { lookupSessionStorage } = _ref2;
		if (lookupSessionStorage && sessionStorageAvailable()) window.sessionStorage.setItem(lookupSessionStorage, lng);
	}
};
var navigator$1 = {
	name: "navigator",
	lookup(options) {
		const found = [];
		if (typeof navigator !== "undefined") {
			const { languages, userLanguage, language } = navigator;
			if (languages) for (let i = 0; i < languages.length; i++) found.push(languages[i]);
			if (userLanguage) found.push(userLanguage);
			if (language) found.push(language);
		}
		return found.length > 0 ? found : void 0;
	}
};
var htmlTag = {
	name: "htmlTag",
	lookup(_ref) {
		let { htmlTag: htmlTag$1 } = _ref;
		let found;
		const internalHtmlTag = htmlTag$1 || (typeof document !== "undefined" ? document.documentElement : null);
		if (internalHtmlTag && typeof internalHtmlTag.getAttribute === "function") found = internalHtmlTag.getAttribute("lang");
		return found;
	}
};
var path = {
	name: "path",
	lookup(_ref) {
		let { lookupFromPathIndex } = _ref;
		if (typeof window === "undefined") return void 0;
		const language = window.location.pathname.match(/\/([a-zA-Z-]*)/g);
		if (!Array.isArray(language)) return void 0;
		return language[typeof lookupFromPathIndex === "number" ? lookupFromPathIndex : 0]?.replace("/", "");
	}
};
var subdomain = {
	name: "subdomain",
	lookup(_ref) {
		let { lookupFromSubdomainIndex } = _ref;
		const internalLookupFromSubdomainIndex = typeof lookupFromSubdomainIndex === "number" ? lookupFromSubdomainIndex + 1 : 1;
		const language = typeof window !== "undefined" && window.location?.hostname?.match(/^(\w{2,5})\.(([a-z0-9-]{1,63}\.[a-z]{2,6})|localhost)/i);
		if (!language) return void 0;
		return language[internalLookupFromSubdomainIndex];
	}
};
let canCookies = false;
try {
	document.cookie;
	canCookies = true;
} catch (e) {}
const order = [
	"querystring",
	"cookie",
	"localStorage",
	"sessionStorage",
	"navigator",
	"htmlTag"
];
if (!canCookies) order.splice(1, 1);
const getDefaults$1 = () => ({
	order,
	lookupQuerystring: "lng",
	lookupCookie: "i18next",
	lookupLocalStorage: "i18nextLng",
	lookupSessionStorage: "i18nextLng",
	caches: ["localStorage"],
	excludeCacheFor: ["cimode"],
	convertDetectedLanguage: (l) => l
});
var Browser = class {
	constructor(services) {
		let options = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
		this.type = "languageDetector";
		this.detectors = {};
		this.init(services, options);
	}
	init() {
		let services = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : { languageUtils: {} };
		let options = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
		let i18nOptions = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : {};
		this.services = services;
		this.options = defaults(options, this.options || {}, getDefaults$1());
		if (typeof this.options.convertDetectedLanguage === "string" && this.options.convertDetectedLanguage.indexOf("15897") > -1) this.options.convertDetectedLanguage = (l) => l.replace("-", "_");
		if (this.options.lookupFromUrlIndex) this.options.lookupFromPathIndex = this.options.lookupFromUrlIndex;
		this.i18nOptions = i18nOptions;
		this.addDetector(cookie$1);
		this.addDetector(querystring);
		this.addDetector(localStorage$1);
		this.addDetector(sessionStorage);
		this.addDetector(navigator$1);
		this.addDetector(htmlTag);
		this.addDetector(path);
		this.addDetector(subdomain);
		this.addDetector(hash);
	}
	addDetector(detector) {
		this.detectors[detector.name] = detector;
		return this;
	}
	detect() {
		let detectionOrder = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : this.options.order;
		let detected = [];
		detectionOrder.forEach((detectorName) => {
			if (this.detectors[detectorName]) {
				let lookup = this.detectors[detectorName].lookup(this.options);
				if (lookup && typeof lookup === "string") lookup = [lookup];
				if (lookup) detected = detected.concat(lookup);
			}
		});
		detected = detected.filter((d) => d !== void 0 && d !== null && !hasXSS(d)).map((d) => this.options.convertDetectedLanguage(d));
		if (this.services && this.services.languageUtils && this.services.languageUtils.getBestMatchFromCodes) return detected;
		return detected.length > 0 ? detected[0] : null;
	}
	cacheUserLanguage(lng) {
		let caches = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : this.options.caches;
		if (!caches) return;
		if (this.options.excludeCacheFor && this.options.excludeCacheFor.indexOf(lng) > -1) return;
		caches.forEach((cacheName) => {
			if (this.detectors[cacheName]) this.detectors[cacheName].cacheUserLanguage(lng, this.options);
		});
	}
};
Browser.type = "languageDetector";

//#endregion
//#region ../../node_modules/.pnpm/i18next-http-backend@3.0.2/node_modules/i18next-http-backend/esm/utils.js
function _typeof$2(o) {
	"@babel/helpers - typeof";
	return _typeof$2 = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(o$1) {
		return typeof o$1;
	} : function(o$1) {
		return o$1 && "function" == typeof Symbol && o$1.constructor === Symbol && o$1 !== Symbol.prototype ? "symbol" : typeof o$1;
	}, _typeof$2(o);
}
var arr = [];
var each = arr.forEach;
var slice = arr.slice;
function hasXMLHttpRequest() {
	return typeof XMLHttpRequest === "function" || (typeof XMLHttpRequest === "undefined" ? "undefined" : _typeof$2(XMLHttpRequest)) === "object";
}
function isPromise(maybePromise) {
	return !!maybePromise && typeof maybePromise.then === "function";
}
function makePromise(maybePromise) {
	if (isPromise(maybePromise)) return maybePromise;
	return Promise.resolve(maybePromise);
}

//#endregion
//#region ../../node_modules/.pnpm/i18next-http-backend@3.0.2/node_modules/i18next-http-backend/esm/request.js
function ownKeys$1(e, r) {
	var t$1 = Object.keys(e);
	if (Object.getOwnPropertySymbols) {
		var o = Object.getOwnPropertySymbols(e);
		r && (o = o.filter(function(r$1) {
			return Object.getOwnPropertyDescriptor(e, r$1).enumerable;
		})), t$1.push.apply(t$1, o);
	}
	return t$1;
}
function _objectSpread$1(e) {
	for (var r = 1; r < arguments.length; r++) {
		var t$1 = null != arguments[r] ? arguments[r] : {};
		r % 2 ? ownKeys$1(Object(t$1), !0).forEach(function(r$1) {
			_defineProperty$1(e, r$1, t$1[r$1]);
		}) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t$1)) : ownKeys$1(Object(t$1)).forEach(function(r$1) {
			Object.defineProperty(e, r$1, Object.getOwnPropertyDescriptor(t$1, r$1));
		});
	}
	return e;
}
function _defineProperty$1(e, r, t$1) {
	return (r = _toPropertyKey$1(r)) in e ? Object.defineProperty(e, r, {
		value: t$1,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[r] = t$1, e;
}
function _toPropertyKey$1(t$1) {
	var i = _toPrimitive$1(t$1, "string");
	return "symbol" == _typeof$1(i) ? i : i + "";
}
function _toPrimitive$1(t$1, r) {
	if ("object" != _typeof$1(t$1) || !t$1) return t$1;
	var e = t$1[Symbol.toPrimitive];
	if (void 0 !== e) {
		var i = e.call(t$1, r || "default");
		if ("object" != _typeof$1(i)) return i;
		throw new TypeError("@@toPrimitive must return a primitive value.");
	}
	return ("string" === r ? String : Number)(t$1);
}
function _typeof$1(o) {
	"@babel/helpers - typeof";
	return _typeof$1 = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(o$1) {
		return typeof o$1;
	} : function(o$1) {
		return o$1 && "function" == typeof Symbol && o$1.constructor === Symbol && o$1 !== Symbol.prototype ? "symbol" : typeof o$1;
	}, _typeof$1(o);
}
var fetchApi = typeof fetch === "function" ? fetch : void 0;
if (typeof global !== "undefined" && global.fetch) fetchApi = global.fetch;
else if (typeof window !== "undefined" && window.fetch) fetchApi = window.fetch;
var XmlHttpRequestApi;
if (hasXMLHttpRequest()) {
	if (typeof global !== "undefined" && global.XMLHttpRequest) XmlHttpRequestApi = global.XMLHttpRequest;
	else if (typeof window !== "undefined" && window.XMLHttpRequest) XmlHttpRequestApi = window.XMLHttpRequest;
}
var ActiveXObjectApi;
if (typeof ActiveXObject === "function") {
	if (typeof global !== "undefined" && global.ActiveXObject) ActiveXObjectApi = global.ActiveXObject;
	else if (typeof window !== "undefined" && window.ActiveXObject) ActiveXObjectApi = window.ActiveXObject;
}
if (typeof fetchApi !== "function") fetchApi = void 0;
if (!fetchApi && !XmlHttpRequestApi && !ActiveXObjectApi) try {
	import("../node-ponyfill.js").then(__toDynamicImportESM(1)).then(function(mod) {
		fetchApi = mod.default;
	}).catch(function() {});
} catch (e) {}
var addQueryString = function addQueryString$1(url, params) {
	if (params && _typeof$1(params) === "object") {
		var queryString = "";
		for (var paramName in params) queryString += "&" + encodeURIComponent(paramName) + "=" + encodeURIComponent(params[paramName]);
		if (!queryString) return url;
		url = url + (url.indexOf("?") !== -1 ? "&" : "?") + queryString.slice(1);
	}
	return url;
};
var fetchIt = function fetchIt$1(url, fetchOptions, callback, altFetch) {
	var resolver = function resolver$1(response) {
		if (!response.ok) return callback(response.statusText || "Error", { status: response.status });
		response.text().then(function(data) {
			callback(null, {
				status: response.status,
				data
			});
		}).catch(callback);
	};
	if (altFetch) {
		var altResponse = altFetch(url, fetchOptions);
		if (altResponse instanceof Promise) {
			altResponse.then(resolver).catch(callback);
			return;
		}
	}
	if (typeof fetch === "function") fetch(url, fetchOptions).then(resolver).catch(callback);
	else fetchApi(url, fetchOptions).then(resolver).catch(callback);
};
var omitFetchOptions = false;
var requestWithFetch = function requestWithFetch$1(options, url, payload, callback) {
	if (options.queryStringParams) url = addQueryString(url, options.queryStringParams);
	var headers = _objectSpread$1({}, typeof options.customHeaders === "function" ? options.customHeaders() : options.customHeaders);
	if (typeof window === "undefined" && typeof global !== "undefined" && typeof global.process !== "undefined" && global.process.versions && global.process.versions.node) headers["User-Agent"] = "i18next-http-backend (node/".concat(global.process.version, "; ").concat(global.process.platform, " ").concat(global.process.arch, ")");
	if (payload) headers["Content-Type"] = "application/json";
	var reqOptions = typeof options.requestOptions === "function" ? options.requestOptions(payload) : options.requestOptions;
	var fetchOptions = _objectSpread$1({
		method: payload ? "POST" : "GET",
		body: payload ? options.stringify(payload) : void 0,
		headers
	}, omitFetchOptions ? {} : reqOptions);
	var altFetch = typeof options.alternateFetch === "function" && options.alternateFetch.length >= 1 ? options.alternateFetch : void 0;
	try {
		fetchIt(url, fetchOptions, callback, altFetch);
	} catch (e) {
		if (!reqOptions || Object.keys(reqOptions).length === 0 || !e.message || e.message.indexOf("not implemented") < 0) return callback(e);
		try {
			Object.keys(reqOptions).forEach(function(opt) {
				delete fetchOptions[opt];
			});
			fetchIt(url, fetchOptions, callback, altFetch);
			omitFetchOptions = true;
		} catch (err) {
			callback(err);
		}
	}
};
var requestWithXmlHttpRequest = function requestWithXmlHttpRequest$1(options, url, payload, callback) {
	if (payload && _typeof$1(payload) === "object") payload = addQueryString("", payload).slice(1);
	if (options.queryStringParams) url = addQueryString(url, options.queryStringParams);
	try {
		var x = XmlHttpRequestApi ? new XmlHttpRequestApi() : new ActiveXObjectApi("MSXML2.XMLHTTP.3.0");
		x.open(payload ? "POST" : "GET", url, 1);
		if (!options.crossDomain) x.setRequestHeader("X-Requested-With", "XMLHttpRequest");
		x.withCredentials = !!options.withCredentials;
		if (payload) x.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
		if (x.overrideMimeType) x.overrideMimeType("application/json");
		var h = options.customHeaders;
		h = typeof h === "function" ? h() : h;
		if (h) for (var i in h) x.setRequestHeader(i, h[i]);
		x.onreadystatechange = function() {
			x.readyState > 3 && callback(x.status >= 400 ? x.statusText : null, {
				status: x.status,
				data: x.responseText
			});
		};
		x.send(payload);
	} catch (e) {
		console && console.log(e);
	}
};
var request = function request$1(options, url, payload, callback) {
	if (typeof payload === "function") {
		callback = payload;
		payload = void 0;
	}
	callback = callback || function() {};
	if (fetchApi && url.indexOf("file:") !== 0) return requestWithFetch(options, url, payload, callback);
	if (hasXMLHttpRequest() || typeof ActiveXObject === "function") return requestWithXmlHttpRequest(options, url, payload, callback);
	callback(/* @__PURE__ */ new Error("No fetch and no xhr implementation found!"));
};
var request_default = request;

//#endregion
//#region ../../node_modules/.pnpm/i18next-http-backend@3.0.2/node_modules/i18next-http-backend/esm/index.js
function _typeof(o) {
	"@babel/helpers - typeof";
	return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(o$1) {
		return typeof o$1;
	} : function(o$1) {
		return o$1 && "function" == typeof Symbol && o$1.constructor === Symbol && o$1 !== Symbol.prototype ? "symbol" : typeof o$1;
	}, _typeof(o);
}
function ownKeys(e, r) {
	var t$1 = Object.keys(e);
	if (Object.getOwnPropertySymbols) {
		var o = Object.getOwnPropertySymbols(e);
		r && (o = o.filter(function(r$1) {
			return Object.getOwnPropertyDescriptor(e, r$1).enumerable;
		})), t$1.push.apply(t$1, o);
	}
	return t$1;
}
function _objectSpread(e) {
	for (var r = 1; r < arguments.length; r++) {
		var t$1 = null != arguments[r] ? arguments[r] : {};
		r % 2 ? ownKeys(Object(t$1), !0).forEach(function(r$1) {
			_defineProperty(e, r$1, t$1[r$1]);
		}) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t$1)) : ownKeys(Object(t$1)).forEach(function(r$1) {
			Object.defineProperty(e, r$1, Object.getOwnPropertyDescriptor(t$1, r$1));
		});
	}
	return e;
}
function _classCallCheck(a, n) {
	if (!(a instanceof n)) throw new TypeError("Cannot call a class as a function");
}
function _defineProperties(e, r) {
	for (var t$1 = 0; t$1 < r.length; t$1++) {
		var o = r[t$1];
		o.enumerable = o.enumerable || !1, o.configurable = !0, "value" in o && (o.writable = !0), Object.defineProperty(e, _toPropertyKey(o.key), o);
	}
}
function _createClass(e, r, t$1) {
	return r && _defineProperties(e.prototype, r), t$1 && _defineProperties(e, t$1), Object.defineProperty(e, "prototype", { writable: !1 }), e;
}
function _defineProperty(e, r, t$1) {
	return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, {
		value: t$1,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[r] = t$1, e;
}
function _toPropertyKey(t$1) {
	var i = _toPrimitive(t$1, "string");
	return "symbol" == _typeof(i) ? i : i + "";
}
function _toPrimitive(t$1, r) {
	if ("object" != _typeof(t$1) || !t$1) return t$1;
	var e = t$1[Symbol.toPrimitive];
	if (void 0 !== e) {
		var i = e.call(t$1, r || "default");
		if ("object" != _typeof(i)) return i;
		throw new TypeError("@@toPrimitive must return a primitive value.");
	}
	return ("string" === r ? String : Number)(t$1);
}
var getDefaults = function getDefaults$2() {
	return {
		loadPath: "/locales/{{lng}}/{{ns}}.json",
		addPath: "/locales/add/{{lng}}/{{ns}}",
		parse: function parse(data) {
			return JSON.parse(data);
		},
		stringify: JSON.stringify,
		parsePayload: function parsePayload(namespace, key, fallbackValue) {
			return _defineProperty({}, key, fallbackValue || "");
		},
		parseLoadPayload: function parseLoadPayload(languages, namespaces) {},
		request: request_default,
		reloadInterval: typeof window !== "undefined" ? false : 3600 * 1e3,
		customHeaders: {},
		queryStringParams: {},
		crossDomain: false,
		withCredentials: false,
		overrideMimeType: false,
		requestOptions: {
			mode: "cors",
			credentials: "same-origin",
			cache: "default"
		}
	};
};
var Backend = function() {
	function Backend$1(services) {
		var options = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
		var allOptions = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : {};
		_classCallCheck(this, Backend$1);
		this.services = services;
		this.options = options;
		this.allOptions = allOptions;
		this.type = "backend";
		this.init(services, options, allOptions);
	}
	return _createClass(Backend$1, [
		{
			key: "init",
			value: function init(services) {
				var _this = this;
				var options = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
				var allOptions = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : {};
				this.services = services;
				this.options = _objectSpread(_objectSpread(_objectSpread({}, getDefaults()), this.options || {}), options);
				this.allOptions = allOptions;
				if (this.services && this.options.reloadInterval) {
					var timer = setInterval(function() {
						return _this.reload();
					}, this.options.reloadInterval);
					if (_typeof(timer) === "object" && typeof timer.unref === "function") timer.unref();
				}
			}
		},
		{
			key: "readMulti",
			value: function readMulti(languages, namespaces, callback) {
				this._readAny(languages, languages, namespaces, namespaces, callback);
			}
		},
		{
			key: "read",
			value: function read(language, namespace, callback) {
				this._readAny([language], language, [namespace], namespace, callback);
			}
		},
		{
			key: "_readAny",
			value: function _readAny(languages, loadUrlLanguages, namespaces, loadUrlNamespaces, callback) {
				var _this2 = this;
				var loadPath = this.options.loadPath;
				if (typeof this.options.loadPath === "function") loadPath = this.options.loadPath(languages, namespaces);
				loadPath = makePromise(loadPath);
				loadPath.then(function(resolvedLoadPath) {
					if (!resolvedLoadPath) return callback(null, {});
					var url = _this2.services.interpolator.interpolate(resolvedLoadPath, {
						lng: languages.join("+"),
						ns: namespaces.join("+")
					});
					_this2.loadUrl(url, callback, loadUrlLanguages, loadUrlNamespaces);
				});
			}
		},
		{
			key: "loadUrl",
			value: function loadUrl(url, callback, languages, namespaces) {
				var _this3 = this;
				var lng = typeof languages === "string" ? [languages] : languages;
				var ns = typeof namespaces === "string" ? [namespaces] : namespaces;
				var payload = this.options.parseLoadPayload(lng, ns);
				this.options.request(this.options, url, payload, function(err, res) {
					if (res && (res.status >= 500 && res.status < 600 || !res.status)) return callback("failed loading " + url + "; status code: " + res.status, true);
					if (res && res.status >= 400 && res.status < 500) return callback("failed loading " + url + "; status code: " + res.status, false);
					if (!res && err && err.message) {
						var errorMessage = err.message.toLowerCase();
						if ([
							"failed",
							"fetch",
							"network",
							"load"
						].find(function(term) {
							return errorMessage.indexOf(term) > -1;
						})) return callback("failed loading " + url + ": " + err.message, true);
					}
					if (err) return callback(err, false);
					var ret, parseErr;
					try {
						if (typeof res.data === "string") ret = _this3.options.parse(res.data, languages, namespaces);
						else ret = res.data;
					} catch (e) {
						parseErr = "failed parsing " + url + " to json";
					}
					if (parseErr) return callback(parseErr, false);
					callback(null, ret);
				});
			}
		},
		{
			key: "create",
			value: function create(languages, namespace, key, fallbackValue, callback) {
				var _this4 = this;
				if (!this.options.addPath) return;
				if (typeof languages === "string") languages = [languages];
				var payload = this.options.parsePayload(namespace, key, fallbackValue);
				var finished = 0;
				var dataArray = [];
				var resArray = [];
				languages.forEach(function(lng) {
					var addPath = _this4.options.addPath;
					if (typeof _this4.options.addPath === "function") addPath = _this4.options.addPath(lng, namespace);
					var url = _this4.services.interpolator.interpolate(addPath, {
						lng,
						ns: namespace
					});
					_this4.options.request(_this4.options, url, payload, function(data, res) {
						finished += 1;
						dataArray.push(data);
						resArray.push(res);
						if (finished === languages.length) {
							if (typeof callback === "function") callback(dataArray, resArray);
						}
					});
				});
			}
		},
		{
			key: "reload",
			value: function reload() {
				var _this5 = this;
				var _this$services = this.services, backendConnector = _this$services.backendConnector, languageUtils = _this$services.languageUtils, logger = _this$services.logger;
				var currentLanguage = backendConnector.language;
				if (currentLanguage && currentLanguage.toLowerCase() === "cimode") return;
				var toLoad = [];
				var append = function append$1(lng) {
					languageUtils.toResolveHierarchy(lng).forEach(function(l) {
						if (toLoad.indexOf(l) < 0) toLoad.push(l);
					});
				};
				append(currentLanguage);
				if (this.allOptions.preload) this.allOptions.preload.forEach(function(l) {
					return append(l);
				});
				toLoad.forEach(function(lng) {
					_this5.allOptions.ns.forEach(function(ns) {
						backendConnector.read(lng, ns, "read", null, null, function(err, data) {
							if (err) logger.warn("loading namespace ".concat(ns, " for language ").concat(lng, " failed"), err);
							if (!err && data) logger.log("loaded namespace ".concat(ns, " for language ").concat(lng), data);
							backendConnector.loaded("".concat(lng, "|").concat(ns), err, data);
						});
					});
				});
			}
		}
	]);
}();
Backend.type = "backend";
var esm_default = Backend;

//#endregion
//#region ../../packages/ui/i18n/src/utils/env.ts
const readEnvRecord = () => {
	try {
		const meta = import.meta;
		if (meta?.env && typeof meta.env === "object") return meta.env;
	} catch {}
	if (typeof window !== "undefined") {
		const candidate = window.__HDB_ENV__;
		if (candidate && typeof candidate === "object") return candidate;
	}
};
const getEnvString = (key) => {
	const value = readEnvRecord()?.[key];
	return typeof value === "string" ? value : void 0;
};
const isDevEnv = () => {
	const mode = getEnvString("MODE");
	if (mode) return mode.toLowerCase() === "development";
	const devFlag = getEnvString("DEV");
	return devFlag === "true" || devFlag === "1";
};

//#endregion
//#region ../../packages/ui/i18n/public/locales/en/common.json
var common_default$1 = {
	navigation: {
		"language": "Language",
		"theme": "Theme"
	},
	auth: {
		"login": "Login",
		"logout": "Logout",
		"authMethod": "Auth Method",
		"popup": "Popup",
		"redirect": "Redirect",
		"userMenu": "User menu",
		"themeSelection": "Theme Selection",
		"languageSelection": "Language Selection",
		"clearAllData": "Clear All Data",
		"showMemoryMonitor": "Show Memory Monitor",
		"hideMemoryMonitor": "Hide Memory Monitor",
		"loadingAuthentication": "Loading authentication",
		"selectTheme": "Select {{theme}} theme",
		"selectLanguage": "Select {{language}} language"
	},
	userMenu: {
		"loading": "Loading authentication...",
		"login": "Login",
		"logout": "Logout",
		"aria": { "userMenu": "User menu" },
		"theme": {
			"label": "Theme",
			"system": "System",
			"light": "Light",
			"dark": "Dark"
		},
		"language": {
			"label": "Language",
			"system": "System default"
		},
		"clear": {
			"label": "Clear All Data",
			"title": "Clear all data?",
			"description": "This will clear all data including:",
			"items": {
				"cache": "Cache API data",
				"indexedDb": "All IndexedDB databases (projects, maps, shapes, etc.)",
				"localStorage": "localStorage data"
			},
			"warning": "This action cannot be undone and will delete all your local data. The page will reload after clearing the cache.",
			"confirm": "Clear All Data",
			"cancel": "Cancel",
			"error": "Failed to clear some cache data. Please try again."
		}
	},
	common: {
		"enabled": "ENABLED",
		"disabled": "DISABLED",
		"feature": "Feature",
		"user": "User",
		"loading": "Loading",
		"error": "Error",
		"success": "Success",
		"warning": "Warning",
		"themeChangeRequested": "Theme change requested: {{theme}}",
		"basicInfo": {
			"title": "Basic Information",
			"subtitle": "Enter a name and optional description.",
			"name": {
				"label": "Name",
				"helper": "Enter a descriptive name",
				"required": "Name is required",
				"placeholder": "Enter name"
			},
			"description": {
				"label": "Description",
				"helper": "Describe the purpose or contents (optional)",
				"placeholder": "Enter description (optional)"
			}
		}
	},
	api: {
		"request": "API Request",
		"response": "API Response",
		"error": "API Error"
	},
	errors: {
		"assertionFailed": "Assertion failed",
		"failedToClearData": "Failed to clear some cache data. Please try again.",
		"languageNotSupported": "Language {{language}} not supported",
		"routeResolutionFailed": "Route resolution failed in {{duration}}ms: {{error}}",
		"routeResolutionSlow": "Route resolution took {{duration}}ms, expected < 100ms"
	},
	lifecycle: {
		"mount": "mount",
		"unmount": "unmount",
		"update": "update",
		"render": "render",
		"effect": "effect"
	},
	dialogs: {
		"trash": {
			"modeMenu": {
				"ariaLabel": "Display mode",
				"normal": "Normal (windowed)",
				"maximize": "Maximize (browser window)",
				"fullScreen": "Full-screen (system)"
			},
			"actions": {
				"close": "Close dialog",
				"exitFullscreen": "Exit full screen"
			},
			"title": {
				"empty": "Empty Trash",
				"restore": "Restore from Trash"
			},
			"confirm": {
				"title": "Empty Trash?",
				"description": "Delete {{count}} {{unit}} permanently?",
				"empty": "This will permanently delete all items in the trash.",
				"draftWarning": "Drafts are present. Emptying the trash will force-delete in-progress edits."
			},
			"buttons": {
				"cancel": "Cancel",
				"confirmDelete": "Empty trash",
				"restore": "Restore",
				"restoreWithCount": "Restore ({{count}})",
				"empty": "Empty",
				"emptyWithCount": "Empty ({{count}})"
			},
			"searchPlaceholder": "Search in trash…",
			"panelTitle": "Trash",
			"stepLabel": "Trash",
			"draftWarning": "Drafts are included in this view. Deleting will force-remove in-progress edits.",
			"aria": {
				"restore": "Restore selection",
				"restoreWithCount": "Restore {{count}} {{unit}}",
				"empty": "Empty trash",
				"emptyWithCount": "Empty {{count}} {{unit}}"
			},
			"units": {
				"item_one": "item",
				"item_other": "items"
			}
		},
		"pluginDraft": {
			"resume": {
				"title": "Resume editing?",
				"description": "A previous edit exists as a draft. Resume it or start a fresh edit?",
				"buttons": {
					"cancel": "Cancel",
					"startFresh": "Start a fresh edit",
					"resumePrevious": "Resume previous edit"
				}
			},
			"conflict": {
				"title": "Edit conflict detected",
				"description": "Another tab saved this node at {{timestamp}}. You can cancel and keep their changes, or continue while keeping your own edits.",
				"buttons": {
					"discardSelf": "Discard my changes",
					"keepSelf": "Keep my changes"
				},
				"discard": {
					"title": "Discard unsaved changes?",
					"description": "You have unsaved changes. Discard them and close the dialog?"
				}
			}
		},
		"pluginDialog": {
			"buttons": {
				"save": "Save",
				"saveDraft": "Save draft",
				"next": "Next",
				"back": "Back",
				"cancel": "Cancel",
				"close": "Close",
				"maximize": "Maximize",
				"restoreSize": "Restore size",
				"fullscreen": "Full screen",
				"exitFullscreen": "Exit full screen"
			},
			"tooltips": {
				"saveDraftDisabled": "No changes to save",
				"close": "Close dialog",
				"maximize": "Maximize",
				"restoreSize": "Restore size",
				"fullscreen": "Full screen",
				"exitFullscreen": "Exit full screen"
			},
			"titles": {
				"create": "Create {{plugin}}",
				"edit": "Edit {{plugin}}"
			}
		}
	},
	treeConsole: {
		"toolbar": {
			"search": {
				"placeholder": "Search tree…",
				"ariaLabel": "Tree search"
			},
			"aria": {
				"toolbarLabel": "Tree console toolbar",
				"trashMenuButton": "Open trash actions",
				"importExportButton": "Import and export options",
				"settingsButton": "Open toolbar settings"
			},
			"tooltips": {
				"undo": "Undo ({{shortcut}})",
				"redo": "Redo ({{shortcut}})",
				"cut": "Cut ({{shortcut}})",
				"copy": "Copy ({{shortcut}})",
				"paste": "Paste ({{shortcut}})",
				"duplicate": "Duplicate ({{shortcut}})",
				"moveToTrash": "Move to Trash ({{shortcut}})"
			},
			"trashMenu": {
				"restore": "Restore from Trash",
				"empty": "Empty Trash"
			},
			"importExportMenu": {
				"import": "Import from JSON file",
				"export": "Export to JSON file",
				"importTemplate": "Import template",
				"importTemplateFallback": "Import template"
			},
			"rowClick": {
				"title": "Row click action",
				"options": {
					"selectNavigate": "Select / Navigate",
					"edit": "Edit"
				}
			},
			"settings": {
				"theme": {
					"title": "Theme",
					"modes": {
						"system": "System",
						"light": "Light",
						"dark": "Dark"
					}
				},
				"language": {
					"title": "Language",
					"modes": {
						"system": "System default",
						"en": "English",
						"ja": "Japanese"
					}
				},
				"autosave": { "title": "Autosave" }
			},
			"developerMenu": {
				"clearIndexedDb": "Delete all IndexedDB created by this app",
				"clearIndexedDbConfirm": "Delete all IndexedDB databases created by this app? This action cannot be undone.",
				"clearIndexedDbSuccess": "Deleted IndexedDB data created by this app.",
				"clearIndexedDbEmpty": "No IndexedDB databases were found for this app.",
				"clearIndexedDbFailure": "Failed to delete IndexedDB data. See console for details."
			}
		},
		"contextMenu": {
			"create": "Create",
			"createUnavailable": "Create menu unavailable",
			"createTooltip": "{{label}}: {{description}}",
			"openFolder": "Open folder",
			"open": "Open",
			"edit": "Edit",
			"copy": "Copy",
			"cut": "Cut",
			"duplicate": "Duplicate",
			"moveToTrash": "Move to Trash",
			"checkReference": "Check reference",
			"preview": "Preview"
		}
	},
	treeTable: {
		"selectAll": {
			"select": "Select all",
			"clear": "Clear all"
		},
		"columns": {
			"name": "Name",
			"description": "Description",
			"created": "Created",
			"updated": "Updated",
			"removed": "Removed"
		},
		"timestamps": {
			"today": "Today {{time}}",
			"yesterday": "Yesterday {{time}}",
			"twoDaysAgo": "Two days ago {{time}}",
			"dateTime": "{{date}} {{time}}"
		},
		"validation": {
			"invalidName": "Invalid name",
			"invalidDescription": "Invalid description"
		},
		"placeholders": {
			"nameConfirm": "Press Enter to confirm / Esc to cancel",
			"descriptionConfirm": "Press Ctrl+Enter to confirm / Esc to cancel"
		},
		"header": { "default": "Column" },
		"emptyCell": "-"
	}
};

//#endregion
//#region ../../packages/ui/i18n/public/locales/ja/common.json
var common_default = {
	navigation: {
		"language": "言語",
		"theme": "テーマ"
	},
	auth: {
		"login": "ログイン",
		"logout": "ログアウト",
		"authMethod": "認証方式",
		"popup": "ポップアップ",
		"redirect": "リダイレクト",
		"userMenu": "ユーザーメニュー",
		"themeSelection": "テーマ選択",
		"languageSelection": "言語選択",
		"clearAllData": "すべてのデータをクリア",
		"showMemoryMonitor": "メモリモニターを表示",
		"hideMemoryMonitor": "メモリモニターを隠す",
		"loadingAuthentication": "認証中",
		"selectTheme": "{{theme}}テーマを選択",
		"selectLanguage": "{{language}}言語を選択"
	},
	userMenu: {
		"loading": "認証を読み込み中...",
		"login": "ログイン",
		"logout": "ログアウト",
		"aria": { "userMenu": "ユーザーメニュー" },
		"theme": {
			"label": "テーマ",
			"system": "システム設定",
			"light": "ライト",
			"dark": "ダーク"
		},
		"language": {
			"label": "言語",
			"system": "システム設定"
		},
		"clear": {
			"label": "全データを削除",
			"title": "全データを削除しますか？",
			"description": "次のデータをすべて削除します:",
			"items": {
				"cache": "Cache API のデータ",
				"indexedDb": "IndexedDB の全データ（プロジェクト・マップ・シェイプ等）",
				"localStorage": "localStorage のデータ"
			},
			"warning": "この操作は元に戻せません。全ローカルデータが削除され、完了後にページを再読み込みします。",
			"confirm": "全データを削除",
			"cancel": "キャンセル",
			"error": "キャッシュの削除に失敗しました。もう一度お試しください。"
		}
	},
	common: {
		"enabled": "有効",
		"disabled": "無効",
		"feature": "機能",
		"user": "ユーザー",
		"loading": "読み込み中",
		"error": "エラー",
		"success": "成功",
		"warning": "警告",
		"themeChangeRequested": "テーマ変更がリクエストされました: {{theme}}",
		"basicInfo": {
			"title": "基本情報",
			"subtitle": "名前と説明（任意）を入力してください。",
			"name": {
				"label": "名前",
				"helper": "わかりやすい名前を入力してください",
				"required": "名前は必須です",
				"placeholder": "名前を入力"
			},
			"description": {
				"label": "説明",
				"helper": "目的や内容を説明してください（任意）",
				"placeholder": "説明を入力（任意）"
			}
		}
	},
	api: {
		"request": "APIリクエスト",
		"response": "APIレスポンス",
		"error": "APIエラー"
	},
	errors: {
		"assertionFailed": "アサーションに失敗しました",
		"failedToClearData": "一部のキャッシュデータのクリアに失敗しました。もう一度お試しください。",
		"languageNotSupported": "言語 {{language}} はサポートされていません",
		"routeResolutionFailed": "ルート解決に失敗しました {{duration}}ms: {{error}}",
		"routeResolutionSlow": "ルート解決に {{duration}}ms かかりました。100ms 未満が期待されます"
	},
	lifecycle: {
		"mount": "マウント",
		"unmount": "アンマウント",
		"update": "更新",
		"render": "レンダー",
		"effect": "エフェクト"
	},
	dialogs: {
		"trash": {
			"modeMenu": {
				"ariaLabel": "表示モード",
				"normal": "Normal（通常）",
				"maximize": "Maximize（最大）",
				"fullScreen": "Full-screen（全画面）"
			},
			"actions": {
				"close": "ダイアログを閉じる",
				"exitFullscreen": "全画面を終了"
			},
			"title": {
				"empty": "ゴミ箱を空にする",
				"restore": "ゴミ箱から復元"
			},
			"confirm": {
				"title": "ゴミ箱を空にしますか?",
				"description": "{{unit}}を{{count}}件、完全に削除しますか?",
				"empty": "ゴミ箱内の項目をすべて完全に削除します。",
				"draftWarning": "ドラフトが含まれています。削除すると編集中の内容も失われます。"
			},
			"buttons": {
				"cancel": "キャンセル",
				"confirmDelete": "ゴミ箱を空にする",
				"restore": "復元",
				"restoreWithCount": "復元 ({{count}})",
				"empty": "削除",
				"emptyWithCount": "削除 ({{count}})"
			},
			"searchPlaceholder": "ゴミ箱を検索…",
			"panelTitle": "ゴミ箱",
			"stepLabel": "ゴミ箱",
			"draftWarning": "ドラフトが含まれています。削除すると編集中の内容も失われます。",
			"aria": {
				"restore": "選択した項目を復元",
				"restoreWithCount": "{{unit}}を{{count}}件復元",
				"empty": "ゴミ箱を空にする",
				"emptyWithCount": "{{unit}}を{{count}}件削除"
			},
			"units": {
				"item_one": "項目",
				"item_other": "項目"
			}
		},
		"pluginDraft": {
			"resume": {
				"title": "編集を再開しますか？",
				"description": "以前の編集内容がドラフトとして保存されています。再開するか、新しく編集をやり直すかを選んでください。",
				"buttons": {
					"cancel": "キャンセル",
					"startFresh": "新規の編集を開始",
					"resumePrevious": "以前の編集を再開"
				}
			},
			"conflict": {
				"title": "他の編集と競合しています",
				"description": "別のタブで同じノードの編集が {{timestamp}} に保存されました。自分の編集をやめて相手の内容を採用するか、このまま自分の編集内容を優先して続行するかを選んでください。",
				"buttons": {
					"discardSelf": "自身の内容を破棄",
					"keepSelf": "自身の内容を優先"
				},
				"discard": {
					"title": "未保存の変更を破棄しますか？",
					"description": "未保存の変更があります。破棄してダイアログを閉じてもよろしいですか？"
				}
			}
		},
		"pluginDialog": {
			"buttons": {
				"save": "保存",
				"saveDraft": "下書きを保存",
				"next": "次へ",
				"back": "戻る",
				"cancel": "キャンセル",
				"close": "閉じる",
				"maximize": "最大化",
				"restoreSize": "元のサイズに戻す",
				"fullscreen": "全画面",
				"exitFullscreen": "全画面を終了"
			},
			"tooltips": {
				"saveDraftDisabled": "変更がないため保存できません",
				"close": "ダイアログを閉じる",
				"maximize": "最大化",
				"restoreSize": "元のサイズに戻す",
				"fullscreen": "全画面",
				"exitFullscreen": "全画面を終了"
			},
			"titles": {
				"create": "{{plugin}}の作成",
				"edit": "{{plugin}}の編集"
			}
		}
	},
	treeConsole: {
		"toolbar": {
			"search": {
				"placeholder": "ツリーを検索…",
				"ariaLabel": "ツリー検索"
			},
			"aria": {
				"toolbarLabel": "ツリーコンソールツールバー",
				"trashMenuButton": "ゴミ箱メニューを開く",
				"importExportButton": "インポート／エクスポートメニューを開く",
				"settingsButton": "ツールバー設定を開く"
			},
			"tooltips": {
				"undo": "取り消し ({{shortcut}})",
				"redo": "やり直し ({{shortcut}})",
				"cut": "切り取り ({{shortcut}})",
				"copy": "コピー ({{shortcut}})",
				"paste": "貼り付け ({{shortcut}})",
				"duplicate": "複製 ({{shortcut}})",
				"moveToTrash": "ゴミ箱に移動 ({{shortcut}})"
			},
			"trashMenu": {
				"restore": "ゴミ箱から復元",
				"empty": "ゴミ箱を空にする"
			},
			"importExportMenu": {
				"import": "JSONファイルからインポート",
				"export": "JSONファイルへエクスポート",
				"importTemplate": "テンプレートをインポート",
				"importTemplateFallback": "テンプレートをインポート"
			},
			"rowClick": {
				"title": "行クリック時の操作",
				"options": {
					"selectNavigate": "選択／移動",
					"edit": "編集"
				}
			},
			"settings": {
				"theme": {
					"title": "テーマ",
					"modes": {
						"system": "システム設定",
						"light": "ライト",
						"dark": "ダーク"
					}
				},
				"language": {
					"title": "言語",
					"modes": {
						"system": "システム既定",
						"en": "英語",
						"ja": "日本語"
					}
				},
				"autosave": { "title": "自動保存" }
			},
			"developerMenu": {
				"clearIndexedDb": "このアプリが作成したIndexedDBを全削除",
				"clearIndexedDbConfirm": "このアプリが作成したIndexedDBをすべて削除しますか？この操作は元に戻せません。",
				"clearIndexedDbSuccess": "このアプリが作成したIndexedDBデータを削除しました。",
				"clearIndexedDbEmpty": "削除対象のIndexedDBは見つかりませんでした。",
				"clearIndexedDbFailure": "IndexedDBの削除に失敗しました。詳細はコンソールを確認してください。"
			}
		},
		"contextMenu": {
			"create": "作成",
			"createUnavailable": "作成メニューを利用できません",
			"createTooltip": "{{label}}: {{description}}",
			"openFolder": "フォルダーを開く",
			"open": "開く",
			"edit": "編集",
			"copy": "コピー",
			"cut": "切り取り",
			"duplicate": "複製",
			"moveToTrash": "ゴミ箱に移動",
			"checkReference": "参照を確認",
			"preview": "プレビュー"
		}
	},
	treeTable: {
		"selectAll": {
			"select": "すべて選択",
			"clear": "すべて解除"
		},
		"columns": {
			"name": "名前",
			"description": "説明",
			"created": "作成日",
			"updated": "更新日",
			"removed": "削除日"
		},
		"timestamps": {
			"today": "今日 {{time}}",
			"yesterday": "昨日 {{time}}",
			"twoDaysAgo": "一昨日 {{time}}",
			"dateTime": "{{date}} {{time}}"
		},
		"validation": {
			"invalidName": "名前が正しくありません",
			"invalidDescription": "説明が正しくありません"
		},
		"placeholders": {
			"nameConfirm": "Enterキーで確定 / Escでキャンセル",
			"descriptionConfirm": "Ctrl+Enterで確定 / Escでキャンセル"
		},
		"header": { "default": "列" },
		"emptyCell": "-"
	}
};

//#endregion
//#region ../../packages/ui/i18n/public/locales/en/guidedTour.json
var guidedTour_default$1 = {};

//#endregion
//#region ../../packages/ui/i18n/public/locales/ja/guidedTour.json
var guidedTour_default = {};

//#endregion
//#region ../../packages/ui/i18n/public/locales/en/plugin-basic-info.json
var plugin_basic_info_default$1 = {
	description: {
		"create": "Enter basic information for the new node.",
		"edit": "Update the basic information for this node."
	},
	name: { "required": "Name is required" },
	fields: {
		"name": {
			"label": "Name",
			"placeholder": "Enter a descriptive name"
		},
		"description": {
			"label": "Description",
			"placeholder": "Enter an optional description",
			"counter": "{{count}}/1000 characters"
		},
		"tags": {
			"label": "Tags",
			"placeholder": "Enter tag and press Enter"
		}
	}
};

//#endregion
//#region ../../packages/ui/i18n/public/locales/ja/plugin-basic-info.json
var plugin_basic_info_default = {
	description: {
		"create": "新規ノードの基本情報を入力してください。",
		"edit": "このノードの基本情報を更新してください。"
	},
	name: { "required": "名称は必須です" },
	fields: {
		"name": {
			"label": "名称",
			"placeholder": "わかりやすい名称を入力してください"
		},
		"description": {
			"label": "説明",
			"placeholder": "任意の説明を入力してください",
			"counter": "{{count}}/1000 文字"
		},
		"tags": {
			"label": "タグ",
			"placeholder": "タグを入力して Enter を押してください"
		}
	}
};

//#endregion
//#region ../../packages/ui/i18n/public/locales/en/styler-plugin.json
var styler_plugin_default$1 = {
	styleSettings: {
		"title": "Style Mapping",
		"description": "Map the source columns to the styles",
		"source": { "label": "Key/Value Column Pair" },
		"styleType": {
			"label": "Style Target",
			"help": "Select a property as its style targets.",
			"options": {
				"choropleth": "Chorograph",
				"points": "Point rendering",
				"lines": "Line rendering"
			},
			"descriptions": {
				"choropleth": "Set fill colors for areas such as countries or regions.",
				"points": "Set display colors for city or transit nodes.",
				"lines": "Set line width and colors for transportation routes."
			}
		},
		"keyColumn": {
			"label": "Property key source",
			"help": "Choose the filtered table column whose value will drive styling keys.",
			"none": "Select a column"
		},
		"valueColumn": {
			"label": "Property value source",
			"help": "Choose the filtered table column whose values will drive styling values.",
			"none": "Select a column"
		},
		"targetProperty": {
			"label": "Target style property",
			"help": "Select the MapLibre paint property to map this value to."
		},
		"validation": { "required": "Select a style type, value source, and target property to continue." }
	},
	steps: {
		"dataSource": "Data Source",
		"filtering": "Filtering",
		"styleSettings": "Style Mapping",
		"styleAlgorithm": "Style Algorithm",
		"preview": "Preview"
	},
	step5: {
		"title": "Style Algorithm",
		"errors": {
			"range": "Maximum value must be greater than minimum value",
			"configure": "Configure styling targets before continuing."
		}
	},
	step6: {
		"title": "Preview with Style Mapping",
		"required": {
			"title": "Configuration Required",
			"body": "Please complete Step 5 configuration before viewing the preview.",
			"property": "Select a MapLibre style property",
			"valueColumn": "Select a value column for mapping"
		},
		"noData": {
			"title": "No Data Available",
			"body": "No tabular data is available for preview. Please ensure data has been loaded in previous steps."
		},
		"truncate": "Showing preview of first 1,000 rows. Full dataset contains",
		"rows": "rows."
	},
	extension: {
		"description": "Configure Styler visualization settings for this folder",
		"styleType": {
			"label": "Style Type",
			"choropleth": "Area fill",
			"points": "Point rendering",
			"lines": "Line rendering"
		},
		"dataSource": {
			"label": "Data Source",
			"placeholder": "e.g., CSV file path or URL"
		},
		"colorScheme": {
			"label": "Color Scheme",
			"blues": "Blues",
			"reds": "Reds",
			"greens": "Greens",
			"viridis": "Viridis",
			"plasma": "Plasma"
		},
		"opacity": { "label": "Opacity" }
	},
	step5_legacy: {
		"title": "Step 5: Style Mapping Configuration",
		"algorithms": {
			"linear": "Linear",
			"quantile": "Quantile",
			"jenks": "Jenks Natural Breaks",
			"equal": "Equal Interval",
			"linearDescription": "Interpolates colors smoothly between minimum and maximum values. Ideal for evenly distributed data or when visualizing continuous transitions.",
			"quantileDescription": "Creates classes with an equal number of features. Produces balanced visuals even for skewed data and is resilient to outliers.",
			"jenksDescription": "Finds natural breaks by minimizing variance within classes and maximizing it between classes. Offers meaningful groupings at a higher computational cost.",
			"equalDescription": "Divides the value range into equal intervals. Suited for continuous, roughly linear distributions such as temperature or elevation, and is fast and easy to understand."
		},
		"recommendation": {
			"summary": "Recommended algorithm: {algorithm}",
			"confidence": "Confidence: {confidence}%",
			"fallback": "Try this algorithm to match your data distribution.",
			"apply": "Apply",
			"suitability": "Suitability score: {{score}} / 100"
		},
		"mappingRange": {
			"title": "Mapping Range",
			"min": "Minimum",
			"max": "Maximum",
			"help": "Define the numeric domain to map onto colors."
		},
		"algorithm": { "title": "Color Algorithm" },
		"advanced": {
			"title": "Advanced color controls",
			"hide": "Hide",
			"show": "Show",
			"description": "Optional tweaks for color interpolation and palettes. Leave hidden for quick setups."
		},
		"colorSpace": {
			"title": "Color Space",
			"hsv": "HSV",
			"rgb": "RGB",
			"lab": "LAB",
			"help": "Choose how colors are interpolated across the range."
		},
		"colorRange": {
			"title": "Color Range & Inversion",
			"start": "Start Color (hex)",
			"end": "End Color (hex)",
			"normal": "Normal",
			"invert": "Invert"
		},
		"hsv": {
			"title": "HSV Controls",
			"hueStart": "Hue Start",
			"hueEnd": "Hue End",
			"saturation": "Saturation",
			"brightness": "Brightness"
		},
		"gradient": {
			"title": "Color Gradient Preview",
			"description": "Preview of the gradient based on current mapping and algorithm."
		},
		"distribution": {
			"title": "Value Distribution (sampled)",
			"analyzing": "Analyzing value distribution…",
			"mean": "Mean: {{value}}",
			"median": "Median: {{value}}",
			"stdDev": "Std Dev: {{value}}",
			"min": "Min: {{value}}",
			"max": "Max: {{value}}"
		}
	}
};

//#endregion
//#region ../../packages/ui/i18n/public/locales/ja/styler-plugin.json
var styler_plugin_default = {
	styleSettings: {
		"title": "スタイル設定",
		"description": "表データの列の組み合わせを、地図上のスタイルへと対応づけします。",
		"source": { "label": "列の組み合わせ" },
		"styleType": {
			"label": "スタイル",
			"help": "このスタイルが適用される描画の種類を選択します。",
			"options": {
				"choropleth": "面の描画",
				"points": "点の描画",
				"lines": "線の描画"
			},
			"descriptions": {
				"choropleth": "国・地域の領域の色を指定します",
				"points": "都市・交通経路の結節点の表示色を指定します",
				"lines": "交通経路の線幅や表示色を指定します"
			}
		},
		"keyColumn": {
			"label": "キーの列",
			"help": "スタイリングのキーとして利用される列を選択してください。",
			"none": "列を選択"
		},
		"valueColumn": {
			"label": "値の列",
			"help": "スタイリングの値として利用される列を選択してください。",
			"none": "列を選択"
		},
		"targetProperty": {
			"label": "対象プロパティ",
			"help": "マッピング先の MapLibreプロパティを選択します。"
		},
		"validation": { "required": "スタイル種別・値の列・対象プロパティを選択してください。" }
	},
	steps: {
		"dataSource": "データソース",
		"filtering": "フィルタリング",
		"styleSettings": "スタイル設定",
		"styleAlgorithm": "スタイルアルゴリズム",
		"preview": "プレビュー"
	},
	step5: {
		"title": "スタイルアルゴリズム",
		"errors": {
			"range": "最大値は最小値より大きくする必要があります",
			"configure": "スタイルターゲットを設定してから次へ進んでください。"
		}
	},
	step6: {
		"title": "スタイル適用プレビュー",
		"required": {
			"title": "設定が必要です",
			"body": "プレビューの前にステップ5の設定を完了してください。",
			"property": "MapLibreのスタイルプロパティを選択してください",
			"valueColumn": "マッピングに使用する値の列を選択してください"
		},
		"noData": {
			"title": "データがありません",
			"body": "プレビュー用の表データがありません。前のステップでデータが読み込まれているか確認してください。"
		},
		"truncate": "先頭1,000行のみプレビュー表示しています。全データ件数:",
		"rows": "行"
	},
	extension: {
		"description": "このフォルダ用の Styler 可視化設定を行います。",
		"styleType": {
			"label": "スタイル種別",
			"choropleth": "面の描画",
			"points": "点の描画",
			"lines": "線の描画"
		},
		"dataSource": {
			"label": "データソース",
			"placeholder": "例: CSV のパスまたは URL"
		},
		"colorScheme": {
			"label": "カラースキーム",
			"blues": "ブルー",
			"reds": "レッド",
			"greens": "グリーン",
			"viridis": "Viridis",
			"plasma": "Plasma"
		},
		"opacity": { "label": "不透明度" }
	},
	step5_legacy: {
		"title": "ステップ5: スタイルマッピング設定",
		"algorithms": {
			"linear": "線形補間",
			"quantile": "分位点",
			"jenks": "ジェンクス自然分類",
			"equal": "等間隔",
			"linearDescription": "最小値と最大値の間を滑らかに補間します。連続値に適しています。",
			"quantileDescription": "要素数が均等になるようクラスを分割します。外れ値に強く、偏った分布でもバランス良く表示します。",
			"jenksDescription": "クラス内分散を最小化しクラス間分散を最大化して自然な区切りを見つけます。意味のあるグルーピングを提供します。",
			"equalDescription": "値域を等しい幅で分割します。連続的でほぼ線形な分布（温度や標高など）に適しています。"
		},
		"recommendation": {
			"summary": "推奨アルゴリズム: {algorithm}",
			"confidence": "確信度: {confidence}%",
			"fallback": "データ分布に合わせるため、このアルゴリズムを試してください。",
			"apply": "適用",
			"suitability": "適合度: {{score}} / 100"
		},
		"mappingRange": {
			"title": "マッピング範囲",
			"min": "最小値",
			"max": "最大値",
			"help": "色にマッピングする数値の範囲を定義します。"
		},
		"algorithm": { "title": "カラーアルゴリズム" },
		"advanced": {
			"title": "高度なカラー設定",
			"hide": "非表示",
			"show": "表示",
			"description": "色補間やパレットの詳細設定です。簡易設定の場合は非表示のままで構いません。"
		},
		"colorSpace": {
			"title": "カラースペース",
			"hsv": "HSV",
			"rgb": "RGB",
			"lab": "LAB",
			"help": "色をどの空間で補間するかを選択します。"
		},
		"colorRange": {
			"title": "カラー範囲と反転",
			"start": "開始色 (hex)",
			"end": "終了色 (hex)",
			"normal": "通常",
			"invert": "反転"
		},
		"hsv": {
			"title": "HSV 調整",
			"hueStart": "色相開始",
			"hueEnd": "色相終了",
			"saturation": "彩度",
			"brightness": "明度"
		},
		"gradient": {
			"title": "カラ―グラデーションのプレビュー",
			"description": "現在のマッピングとアルゴリズムに基づくグラデーションを表示します。"
		},
		"distribution": {
			"title": "値の分布（サンプル）",
			"analyzing": "分布を解析中…",
			"mean": "平均: {{value}}",
			"median": "中央値: {{value}}",
			"stdDev": "標準偏差: {{value}}",
			"min": "最小: {{value}}",
			"max": "最大: {{value}}"
		}
	}
};

//#endregion
//#region ../../packages/ui/i18n/src/i18n/index.ts
/**
* i18next Configuration
*
* This file contains the i18next configuration for the Eria Cartograph application.
*/
const logI18nWarning = (message, error) => {
	if (typeof console === "undefined") return;
	console.warn("[ui-i18n]", message, error);
};
const initReactI18nextModule = ReactI18NextModule.initReactI18next;
const i18n = i18next.default ?? i18next;
const isDevelopment = isDevEnv();
const detectionOptions = {
	order: [
		"localStorage",
		"cookie",
		"navigator"
	],
	lookupQuerystring: "lng",
	lookupCookie: "i18next",
	lookupLocalStorage: "i18nextLng",
	lookupSessionStorage: "i18nextLng",
	caches: ["localStorage"],
	excludeCacheFor: ["cimode"]
};
const backendOptions = {
	loadPath: (languages, namespaces) => {
		return `${computeBasePath()}locales/${Array.isArray(languages) && languages.length ? languages[0] : "en"}/${Array.isArray(namespaces) && namespaces.length ? namespaces[0] : "common"}.json`;
	},
	crossDomain: false,
	withCredentials: false,
	customHeaders: {},
	reloadInterval: isDevelopment ? 6e4 : void 0
};
const reactOptions = {
	useSuspense: false,
	bindI18n: "languageChanged",
	bindI18nStore: "",
	transSupportBasicHtmlNodes: true,
	transKeepBasicHtmlNodesFor: [
		"br",
		"strong",
		"i",
		"em"
	],
	unescape: (str) => {
		if (typeof DOMParser !== "undefined") return new DOMParser().parseFromString(str, "text/html").documentElement.textContent || str;
		return str;
	}
};
const interpolationOptions = { escapeValue: false };
const formatterEntries = [
	["uppercase", (value) => typeof value === "string" ? value.toUpperCase() : String(value)],
	["lowercase", (value) => typeof value === "string" ? value.toLowerCase() : String(value)],
	["date", (value, lng) => {
		const dateValue = value instanceof Date ? value : new Date(String(value));
		return new Intl.DateTimeFormat(lng).format(dateValue);
	}],
	["number", (value, lng) => typeof value === "number" ? new Intl.NumberFormat(lng).format(value) : String(value)],
	["currency", (value, lng) => typeof value === "number" ? new Intl.NumberFormat(lng, {
		style: "currency",
		currency: "USD"
	}).format(value) : String(value)]
];
const baseInitOptions = {
	fallbackLng: "en",
	supportedLngs: ["en", "ja"],
	load: "languageOnly",
	defaultNS: "common",
	ns: [
		"common",
		"guidedTour",
		"plugin-basic-info",
		"styler-plugin"
	],
	resources: {
		en: {
			common: common_default$1,
			guidedTour: guidedTour_default$1,
			"plugin-basic-info": plugin_basic_info_default$1,
			"styler-plugin": styler_plugin_default$1
		},
		ja: {
			common: common_default,
			guidedTour: guidedTour_default,
			"plugin-basic-info": plugin_basic_info_default,
			"styler-plugin": styler_plugin_default
		}
	},
	debug: false,
	interpolation: interpolationOptions,
	react: reactOptions,
	parseMissingKeyHandler: (key, defaultValue) => {
		if (isDevelopment) console.warn(`[ui-i18n] Missing translation key: ${key}`);
		return defaultValue ?? key;
	},
	saveMissing: false,
	saveMissingTo: "fallback",
	cleanCode: true,
	postProcess: false,
	initImmediate: false
};
const getFormatterService = () => {
	return i18n.services?.formatter;
};
const registerFormatters = () => {
	const formatter = getFormatterService();
	if (!formatter) return;
	formatterEntries.forEach(([name$2, fn]) => {
		formatter.add(name$2, fn);
	});
};
function computeBasePath() {
	const toAbs = (v) => {
		if (!v) return "/";
		const withSlash = v.endsWith("/") ? v : `${v}/`;
		if (/^https?:\/\//i.test(withSlash)) return withSlash;
		if (typeof window !== "undefined") {
			if (withSlash.startsWith("/")) return `${window.location.origin}${withSlash}`;
			return `${window.location.origin}/${withSlash}`;
		}
		return withSlash;
	};
	try {
		if (typeof window !== "undefined") {
			const hinted = window.__HDB_APP_BASE__;
			if (typeof hinted === "string") return toAbs(hinted);
		}
	} catch (error) {
		logI18nWarning("Failed to read __HDB_APP_BASE__ hint", error);
	}
	try {
		const envBase = getEnvString("BASE_URL") ?? "";
		if (envBase) return toAbs(envBase);
	} catch (error) {
		logI18nWarning("Failed to read import.meta.env.BASE_URL", error);
	}
	try {
		if (typeof document !== "undefined") {
			const href = document.querySelector("base")?.getAttribute("href");
			if (href) return toAbs(new URL(href, window.location.origin).pathname || "/");
			const scripts = document.getElementsByTagName("script");
			const src = scripts[scripts.length - 1]?.src || "";
			if (src) try {
				const path$1 = new URL(src, window.location.origin).pathname;
				const i = path$1.lastIndexOf("/assets/");
				if (i > 0) return toAbs(path$1.slice(0, i + 1));
			} catch (error) {
				logI18nWarning("Failed to derive base from script src", error);
			}
			try {
				const parts = (window.location.pathname || "/").split("/").filter(Boolean);
				if (parts.length > 0) {
					const seg = parts[0] ?? "";
					if (![
						"node_modules",
						"assets",
						"locales"
					].includes(String(seg))) return toAbs(`/${seg}/`);
				}
			} catch (error) {
				logI18nWarning("Failed to derive base path from window.location", error);
			}
		}
	} catch (error) {
		logI18nWarning("Failed to compute base path from document context", error);
	}
	return toAbs("/");
}
const initializeI18n = () => {
	if (typeof window === "undefined") return;
	const browserInitOptions = {
		...baseInitOptions,
		detection: detectionOptions,
		backend: backendOptions
	};
	const instance = i18n.use(esm_default).use(Browser);
	if (initReactI18nextModule) try {
		instance.use(initReactI18nextModule);
	} catch (error) {
		logI18nWarning("Failed to attach initReactI18next", error);
	}
	else logI18nWarning("initReactI18next is unavailable; skipping React binding", "mocked");
	instance.init(browserInitOptions).then(registerFormatters).catch((error) => {
		logI18nWarning("Failed to initialize i18n", error);
	});
};
if (typeof window !== "undefined") {
	initializeI18n();
	try {
		window.i18next = i18n;
	} catch (error) {
		logI18nWarning("Failed to expose i18next on window", error);
	}
} else {
	const ssrInitOptions = { ...baseInitOptions };
	const instance = i18n;
	if (initReactI18nextModule) try {
		instance.use(initReactI18nextModule);
	} catch (error) {
		logI18nWarning("Failed to attach initReactI18next (SSR)", error);
	}
	instance.init(ssrInitOptions).then(registerFormatters).catch((error) => {
		logI18nWarning("Failed to initialize i18n (SSR)", error);
	});
}
try {
	globalThis.i18next = i18n;
} catch (error) {
	logI18nWarning("Failed to expose i18next on globalThis", error);
}

//#endregion
//#region ../../node_modules/.pnpm/date-fns@4.1.0/node_modules/date-fns/locale/en-US/_lib/formatDistance.js
const formatDistanceLocale$1 = {
	lessThanXSeconds: {
		one: "less than a second",
		other: "less than {{count}} seconds"
	},
	xSeconds: {
		one: "1 second",
		other: "{{count}} seconds"
	},
	halfAMinute: "half a minute",
	lessThanXMinutes: {
		one: "less than a minute",
		other: "less than {{count}} minutes"
	},
	xMinutes: {
		one: "1 minute",
		other: "{{count}} minutes"
	},
	aboutXHours: {
		one: "about 1 hour",
		other: "about {{count}} hours"
	},
	xHours: {
		one: "1 hour",
		other: "{{count}} hours"
	},
	xDays: {
		one: "1 day",
		other: "{{count}} days"
	},
	aboutXWeeks: {
		one: "about 1 week",
		other: "about {{count}} weeks"
	},
	xWeeks: {
		one: "1 week",
		other: "{{count}} weeks"
	},
	aboutXMonths: {
		one: "about 1 month",
		other: "about {{count}} months"
	},
	xMonths: {
		one: "1 month",
		other: "{{count}} months"
	},
	aboutXYears: {
		one: "about 1 year",
		other: "about {{count}} years"
	},
	xYears: {
		one: "1 year",
		other: "{{count}} years"
	},
	overXYears: {
		one: "over 1 year",
		other: "over {{count}} years"
	},
	almostXYears: {
		one: "almost 1 year",
		other: "almost {{count}} years"
	}
};
const formatDistance$1 = (token, count, options) => {
	let result;
	const tokenValue = formatDistanceLocale$1[token];
	if (typeof tokenValue === "string") result = tokenValue;
	else if (count === 1) result = tokenValue.one;
	else result = tokenValue.other.replace("{{count}}", count.toString());
	if (options?.addSuffix) if (options.comparison && options.comparison > 0) return "in " + result;
	else return result + " ago";
	return result;
};

//#endregion
//#region ../../node_modules/.pnpm/date-fns@4.1.0/node_modules/date-fns/locale/_lib/buildFormatLongFn.js
function buildFormatLongFn(args) {
	return (options = {}) => {
		const width = options.width ? String(options.width) : args.defaultWidth;
		return args.formats[width] || args.formats[args.defaultWidth];
	};
}

//#endregion
//#region ../../node_modules/.pnpm/date-fns@4.1.0/node_modules/date-fns/locale/en-US/_lib/formatLong.js
const dateFormats$1 = {
	full: "EEEE, MMMM do, y",
	long: "MMMM do, y",
	medium: "MMM d, y",
	short: "MM/dd/yyyy"
};
const timeFormats$1 = {
	full: "h:mm:ss a zzzz",
	long: "h:mm:ss a z",
	medium: "h:mm:ss a",
	short: "h:mm a"
};
const dateTimeFormats$1 = {
	full: "{{date}} 'at' {{time}}",
	long: "{{date}} 'at' {{time}}",
	medium: "{{date}}, {{time}}",
	short: "{{date}}, {{time}}"
};
const formatLong$1 = {
	date: buildFormatLongFn({
		formats: dateFormats$1,
		defaultWidth: "full"
	}),
	time: buildFormatLongFn({
		formats: timeFormats$1,
		defaultWidth: "full"
	}),
	dateTime: buildFormatLongFn({
		formats: dateTimeFormats$1,
		defaultWidth: "full"
	})
};

//#endregion
//#region ../../node_modules/.pnpm/date-fns@4.1.0/node_modules/date-fns/locale/en-US/_lib/formatRelative.js
const formatRelativeLocale$1 = {
	lastWeek: "'last' eeee 'at' p",
	yesterday: "'yesterday at' p",
	today: "'today at' p",
	tomorrow: "'tomorrow at' p",
	nextWeek: "eeee 'at' p",
	other: "P"
};
const formatRelative$1 = (token, _date, _baseDate, _options) => formatRelativeLocale$1[token];

//#endregion
//#region ../../node_modules/.pnpm/date-fns@4.1.0/node_modules/date-fns/locale/_lib/buildLocalizeFn.js
/**
* The localize function argument callback which allows to convert raw value to
* the actual type.
*
* @param value - The value to convert
*
* @returns The converted value
*/
/**
* The map of localized values for each width.
*/
/**
* The index type of the locale unit value. It types conversion of units of
* values that don't start at 0 (i.e. quarters).
*/
/**
* Converts the unit value to the tuple of values.
*/
/**
* The tuple of localized era values. The first element represents BC,
* the second element represents AD.
*/
/**
* The tuple of localized quarter values. The first element represents Q1.
*/
/**
* The tuple of localized day values. The first element represents Sunday.
*/
/**
* The tuple of localized month values. The first element represents January.
*/
function buildLocalizeFn(args) {
	return (value, options) => {
		const context = options?.context ? String(options.context) : "standalone";
		let valuesArray;
		if (context === "formatting" && args.formattingValues) {
			const defaultWidth = args.defaultFormattingWidth || args.defaultWidth;
			const width = options?.width ? String(options.width) : defaultWidth;
			valuesArray = args.formattingValues[width] || args.formattingValues[defaultWidth];
		} else {
			const defaultWidth = args.defaultWidth;
			const width = options?.width ? String(options.width) : args.defaultWidth;
			valuesArray = args.values[width] || args.values[defaultWidth];
		}
		const index = args.argumentCallback ? args.argumentCallback(value) : value;
		return valuesArray[index];
	};
}

//#endregion
//#region ../../node_modules/.pnpm/date-fns@4.1.0/node_modules/date-fns/locale/en-US/_lib/localize.js
const eraValues$1 = {
	narrow: ["B", "A"],
	abbreviated: ["BC", "AD"],
	wide: ["Before Christ", "Anno Domini"]
};
const quarterValues$1 = {
	narrow: [
		"1",
		"2",
		"3",
		"4"
	],
	abbreviated: [
		"Q1",
		"Q2",
		"Q3",
		"Q4"
	],
	wide: [
		"1st quarter",
		"2nd quarter",
		"3rd quarter",
		"4th quarter"
	]
};
const monthValues$1 = {
	narrow: [
		"J",
		"F",
		"M",
		"A",
		"M",
		"J",
		"J",
		"A",
		"S",
		"O",
		"N",
		"D"
	],
	abbreviated: [
		"Jan",
		"Feb",
		"Mar",
		"Apr",
		"May",
		"Jun",
		"Jul",
		"Aug",
		"Sep",
		"Oct",
		"Nov",
		"Dec"
	],
	wide: [
		"January",
		"February",
		"March",
		"April",
		"May",
		"June",
		"July",
		"August",
		"September",
		"October",
		"November",
		"December"
	]
};
const dayValues$1 = {
	narrow: [
		"S",
		"M",
		"T",
		"W",
		"T",
		"F",
		"S"
	],
	short: [
		"Su",
		"Mo",
		"Tu",
		"We",
		"Th",
		"Fr",
		"Sa"
	],
	abbreviated: [
		"Sun",
		"Mon",
		"Tue",
		"Wed",
		"Thu",
		"Fri",
		"Sat"
	],
	wide: [
		"Sunday",
		"Monday",
		"Tuesday",
		"Wednesday",
		"Thursday",
		"Friday",
		"Saturday"
	]
};
const dayPeriodValues$1 = {
	narrow: {
		am: "a",
		pm: "p",
		midnight: "mi",
		noon: "n",
		morning: "morning",
		afternoon: "afternoon",
		evening: "evening",
		night: "night"
	},
	abbreviated: {
		am: "AM",
		pm: "PM",
		midnight: "midnight",
		noon: "noon",
		morning: "morning",
		afternoon: "afternoon",
		evening: "evening",
		night: "night"
	},
	wide: {
		am: "a.m.",
		pm: "p.m.",
		midnight: "midnight",
		noon: "noon",
		morning: "morning",
		afternoon: "afternoon",
		evening: "evening",
		night: "night"
	}
};
const formattingDayPeriodValues$1 = {
	narrow: {
		am: "a",
		pm: "p",
		midnight: "mi",
		noon: "n",
		morning: "in the morning",
		afternoon: "in the afternoon",
		evening: "in the evening",
		night: "at night"
	},
	abbreviated: {
		am: "AM",
		pm: "PM",
		midnight: "midnight",
		noon: "noon",
		morning: "in the morning",
		afternoon: "in the afternoon",
		evening: "in the evening",
		night: "at night"
	},
	wide: {
		am: "a.m.",
		pm: "p.m.",
		midnight: "midnight",
		noon: "noon",
		morning: "in the morning",
		afternoon: "in the afternoon",
		evening: "in the evening",
		night: "at night"
	}
};
const ordinalNumber$1 = (dirtyNumber, _options) => {
	const number = Number(dirtyNumber);
	const rem100 = number % 100;
	if (rem100 > 20 || rem100 < 10) switch (rem100 % 10) {
		case 1: return number + "st";
		case 2: return number + "nd";
		case 3: return number + "rd";
	}
	return number + "th";
};
const localize$1 = {
	ordinalNumber: ordinalNumber$1,
	era: buildLocalizeFn({
		values: eraValues$1,
		defaultWidth: "wide"
	}),
	quarter: buildLocalizeFn({
		values: quarterValues$1,
		defaultWidth: "wide",
		argumentCallback: (quarter) => quarter - 1
	}),
	month: buildLocalizeFn({
		values: monthValues$1,
		defaultWidth: "wide"
	}),
	day: buildLocalizeFn({
		values: dayValues$1,
		defaultWidth: "wide"
	}),
	dayPeriod: buildLocalizeFn({
		values: dayPeriodValues$1,
		defaultWidth: "wide",
		formattingValues: formattingDayPeriodValues$1,
		defaultFormattingWidth: "wide"
	})
};

//#endregion
//#region ../../node_modules/.pnpm/date-fns@4.1.0/node_modules/date-fns/locale/_lib/buildMatchFn.js
function buildMatchFn(args) {
	return (string, options = {}) => {
		const width = options.width;
		const matchPattern = width && args.matchPatterns[width] || args.matchPatterns[args.defaultMatchWidth];
		const matchResult = string.match(matchPattern);
		if (!matchResult) return null;
		const matchedString = matchResult[0];
		const parsePatterns = width && args.parsePatterns[width] || args.parsePatterns[args.defaultParseWidth];
		const key = Array.isArray(parsePatterns) ? findIndex(parsePatterns, (pattern) => pattern.test(matchedString)) : findKey(parsePatterns, (pattern) => pattern.test(matchedString));
		let value;
		value = args.valueCallback ? args.valueCallback(key) : key;
		value = options.valueCallback ? options.valueCallback(value) : value;
		const rest = string.slice(matchedString.length);
		return {
			value,
			rest
		};
	};
}
function findKey(object, predicate) {
	for (const key in object) if (Object.prototype.hasOwnProperty.call(object, key) && predicate(object[key])) return key;
}
function findIndex(array, predicate) {
	for (let key = 0; key < array.length; key++) if (predicate(array[key])) return key;
}

//#endregion
//#region ../../node_modules/.pnpm/date-fns@4.1.0/node_modules/date-fns/locale/_lib/buildMatchPatternFn.js
function buildMatchPatternFn(args) {
	return (string, options = {}) => {
		const matchResult = string.match(args.matchPattern);
		if (!matchResult) return null;
		const matchedString = matchResult[0];
		const parseResult = string.match(args.parsePattern);
		if (!parseResult) return null;
		let value = args.valueCallback ? args.valueCallback(parseResult[0]) : parseResult[0];
		value = options.valueCallback ? options.valueCallback(value) : value;
		const rest = string.slice(matchedString.length);
		return {
			value,
			rest
		};
	};
}

//#endregion
//#region ../../node_modules/.pnpm/date-fns@4.1.0/node_modules/date-fns/locale/en-US/_lib/match.js
const matchOrdinalNumberPattern$1 = /^(\d+)(th|st|nd|rd)?/i;
const parseOrdinalNumberPattern$1 = /\d+/i;
const matchEraPatterns$1 = {
	narrow: /^(b|a)/i,
	abbreviated: /^(b\.?\s?c\.?|b\.?\s?c\.?\s?e\.?|a\.?\s?d\.?|c\.?\s?e\.?)/i,
	wide: /^(before christ|before common era|anno domini|common era)/i
};
const parseEraPatterns$1 = { any: [/^b/i, /^(a|c)/i] };
const matchQuarterPatterns$1 = {
	narrow: /^[1234]/i,
	abbreviated: /^q[1234]/i,
	wide: /^[1234](th|st|nd|rd)? quarter/i
};
const parseQuarterPatterns$1 = { any: [
	/1/i,
	/2/i,
	/3/i,
	/4/i
] };
const matchMonthPatterns$1 = {
	narrow: /^[jfmasond]/i,
	abbreviated: /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i,
	wide: /^(january|february|march|april|may|june|july|august|september|october|november|december)/i
};
const parseMonthPatterns$1 = {
	narrow: [
		/^j/i,
		/^f/i,
		/^m/i,
		/^a/i,
		/^m/i,
		/^j/i,
		/^j/i,
		/^a/i,
		/^s/i,
		/^o/i,
		/^n/i,
		/^d/i
	],
	any: [
		/^ja/i,
		/^f/i,
		/^mar/i,
		/^ap/i,
		/^may/i,
		/^jun/i,
		/^jul/i,
		/^au/i,
		/^s/i,
		/^o/i,
		/^n/i,
		/^d/i
	]
};
const matchDayPatterns$1 = {
	narrow: /^[smtwf]/i,
	short: /^(su|mo|tu|we|th|fr|sa)/i,
	abbreviated: /^(sun|mon|tue|wed|thu|fri|sat)/i,
	wide: /^(sunday|monday|tuesday|wednesday|thursday|friday|saturday)/i
};
const parseDayPatterns$1 = {
	narrow: [
		/^s/i,
		/^m/i,
		/^t/i,
		/^w/i,
		/^t/i,
		/^f/i,
		/^s/i
	],
	any: [
		/^su/i,
		/^m/i,
		/^tu/i,
		/^w/i,
		/^th/i,
		/^f/i,
		/^sa/i
	]
};
const matchDayPeriodPatterns$1 = {
	narrow: /^(a|p|mi|n|(in the|at) (morning|afternoon|evening|night))/i,
	any: /^([ap]\.?\s?m\.?|midnight|noon|(in the|at) (morning|afternoon|evening|night))/i
};
const parseDayPeriodPatterns$1 = { any: {
	am: /^a/i,
	pm: /^p/i,
	midnight: /^mi/i,
	noon: /^no/i,
	morning: /morning/i,
	afternoon: /afternoon/i,
	evening: /evening/i,
	night: /night/i
} };
const match$1 = {
	ordinalNumber: buildMatchPatternFn({
		matchPattern: matchOrdinalNumberPattern$1,
		parsePattern: parseOrdinalNumberPattern$1,
		valueCallback: (value) => parseInt(value, 10)
	}),
	era: buildMatchFn({
		matchPatterns: matchEraPatterns$1,
		defaultMatchWidth: "wide",
		parsePatterns: parseEraPatterns$1,
		defaultParseWidth: "any"
	}),
	quarter: buildMatchFn({
		matchPatterns: matchQuarterPatterns$1,
		defaultMatchWidth: "wide",
		parsePatterns: parseQuarterPatterns$1,
		defaultParseWidth: "any",
		valueCallback: (index) => index + 1
	}),
	month: buildMatchFn({
		matchPatterns: matchMonthPatterns$1,
		defaultMatchWidth: "wide",
		parsePatterns: parseMonthPatterns$1,
		defaultParseWidth: "any"
	}),
	day: buildMatchFn({
		matchPatterns: matchDayPatterns$1,
		defaultMatchWidth: "wide",
		parsePatterns: parseDayPatterns$1,
		defaultParseWidth: "any"
	}),
	dayPeriod: buildMatchFn({
		matchPatterns: matchDayPeriodPatterns$1,
		defaultMatchWidth: "any",
		parsePatterns: parseDayPeriodPatterns$1,
		defaultParseWidth: "any"
	})
};

//#endregion
//#region ../../node_modules/.pnpm/date-fns@4.1.0/node_modules/date-fns/locale/en-US.js
/**
* @category Locales
* @summary English locale (United States).
* @language English
* @iso-639-2 eng
* @author Sasha Koss [@kossnocorp](https://github.com/kossnocorp)
* @author Lesha Koss [@leshakoss](https://github.com/leshakoss)
*/
const enUS = {
	code: "en-US",
	formatDistance: formatDistance$1,
	formatLong: formatLong$1,
	formatRelative: formatRelative$1,
	localize: localize$1,
	match: match$1,
	options: {
		weekStartsOn: 0,
		firstWeekContainsDate: 1
	}
};

//#endregion
//#region ../../node_modules/.pnpm/date-fns@4.1.0/node_modules/date-fns/locale/ja/_lib/formatDistance.js
const formatDistanceLocale = {
	lessThanXSeconds: {
		one: "1秒未満",
		other: "{{count}}秒未満",
		oneWithSuffix: "約1秒",
		otherWithSuffix: "約{{count}}秒"
	},
	xSeconds: {
		one: "1秒",
		other: "{{count}}秒"
	},
	halfAMinute: "30秒",
	lessThanXMinutes: {
		one: "1分未満",
		other: "{{count}}分未満",
		oneWithSuffix: "約1分",
		otherWithSuffix: "約{{count}}分"
	},
	xMinutes: {
		one: "1分",
		other: "{{count}}分"
	},
	aboutXHours: {
		one: "約1時間",
		other: "約{{count}}時間"
	},
	xHours: {
		one: "1時間",
		other: "{{count}}時間"
	},
	xDays: {
		one: "1日",
		other: "{{count}}日"
	},
	aboutXWeeks: {
		one: "約1週間",
		other: "約{{count}}週間"
	},
	xWeeks: {
		one: "1週間",
		other: "{{count}}週間"
	},
	aboutXMonths: {
		one: "約1か月",
		other: "約{{count}}か月"
	},
	xMonths: {
		one: "1か月",
		other: "{{count}}か月"
	},
	aboutXYears: {
		one: "約1年",
		other: "約{{count}}年"
	},
	xYears: {
		one: "1年",
		other: "{{count}}年"
	},
	overXYears: {
		one: "1年以上",
		other: "{{count}}年以上"
	},
	almostXYears: {
		one: "1年近く",
		other: "{{count}}年近く"
	}
};
const formatDistance = (token, count, options) => {
	options = options || {};
	let result;
	const tokenValue = formatDistanceLocale[token];
	if (typeof tokenValue === "string") result = tokenValue;
	else if (count === 1) if (options.addSuffix && tokenValue.oneWithSuffix) result = tokenValue.oneWithSuffix;
	else result = tokenValue.one;
	else if (options.addSuffix && tokenValue.otherWithSuffix) result = tokenValue.otherWithSuffix.replace("{{count}}", String(count));
	else result = tokenValue.other.replace("{{count}}", String(count));
	if (options.addSuffix) if (options.comparison && options.comparison > 0) return result + "後";
	else return result + "前";
	return result;
};

//#endregion
//#region ../../node_modules/.pnpm/date-fns@4.1.0/node_modules/date-fns/locale/ja/_lib/formatLong.js
const dateFormats = {
	full: "y年M月d日EEEE",
	long: "y年M月d日",
	medium: "y/MM/dd",
	short: "y/MM/dd"
};
const timeFormats = {
	full: "H時mm分ss秒 zzzz",
	long: "H:mm:ss z",
	medium: "H:mm:ss",
	short: "H:mm"
};
const dateTimeFormats = {
	full: "{{date}} {{time}}",
	long: "{{date}} {{time}}",
	medium: "{{date}} {{time}}",
	short: "{{date}} {{time}}"
};
const formatLong = {
	date: buildFormatLongFn({
		formats: dateFormats,
		defaultWidth: "full"
	}),
	time: buildFormatLongFn({
		formats: timeFormats,
		defaultWidth: "full"
	}),
	dateTime: buildFormatLongFn({
		formats: dateTimeFormats,
		defaultWidth: "full"
	})
};

//#endregion
//#region ../../node_modules/.pnpm/date-fns@4.1.0/node_modules/date-fns/locale/ja/_lib/formatRelative.js
const formatRelativeLocale = {
	lastWeek: "先週のeeeeのp",
	yesterday: "昨日のp",
	today: "今日のp",
	tomorrow: "明日のp",
	nextWeek: "翌週のeeeeのp",
	other: "P"
};
const formatRelative = (token, _date, _baseDate, _options) => {
	return formatRelativeLocale[token];
};

//#endregion
//#region ../../node_modules/.pnpm/date-fns@4.1.0/node_modules/date-fns/locale/ja/_lib/localize.js
const eraValues = {
	narrow: ["BC", "AC"],
	abbreviated: ["紀元前", "西暦"],
	wide: ["紀元前", "西暦"]
};
const quarterValues = {
	narrow: [
		"1",
		"2",
		"3",
		"4"
	],
	abbreviated: [
		"Q1",
		"Q2",
		"Q3",
		"Q4"
	],
	wide: [
		"第1四半期",
		"第2四半期",
		"第3四半期",
		"第4四半期"
	]
};
const monthValues = {
	narrow: [
		"1",
		"2",
		"3",
		"4",
		"5",
		"6",
		"7",
		"8",
		"9",
		"10",
		"11",
		"12"
	],
	abbreviated: [
		"1月",
		"2月",
		"3月",
		"4月",
		"5月",
		"6月",
		"7月",
		"8月",
		"9月",
		"10月",
		"11月",
		"12月"
	],
	wide: [
		"1月",
		"2月",
		"3月",
		"4月",
		"5月",
		"6月",
		"7月",
		"8月",
		"9月",
		"10月",
		"11月",
		"12月"
	]
};
const dayValues = {
	narrow: [
		"日",
		"月",
		"火",
		"水",
		"木",
		"金",
		"土"
	],
	short: [
		"日",
		"月",
		"火",
		"水",
		"木",
		"金",
		"土"
	],
	abbreviated: [
		"日",
		"月",
		"火",
		"水",
		"木",
		"金",
		"土"
	],
	wide: [
		"日曜日",
		"月曜日",
		"火曜日",
		"水曜日",
		"木曜日",
		"金曜日",
		"土曜日"
	]
};
const dayPeriodValues = {
	narrow: {
		am: "午前",
		pm: "午後",
		midnight: "深夜",
		noon: "正午",
		morning: "朝",
		afternoon: "午後",
		evening: "夜",
		night: "深夜"
	},
	abbreviated: {
		am: "午前",
		pm: "午後",
		midnight: "深夜",
		noon: "正午",
		morning: "朝",
		afternoon: "午後",
		evening: "夜",
		night: "深夜"
	},
	wide: {
		am: "午前",
		pm: "午後",
		midnight: "深夜",
		noon: "正午",
		morning: "朝",
		afternoon: "午後",
		evening: "夜",
		night: "深夜"
	}
};
const formattingDayPeriodValues = {
	narrow: {
		am: "午前",
		pm: "午後",
		midnight: "深夜",
		noon: "正午",
		morning: "朝",
		afternoon: "午後",
		evening: "夜",
		night: "深夜"
	},
	abbreviated: {
		am: "午前",
		pm: "午後",
		midnight: "深夜",
		noon: "正午",
		morning: "朝",
		afternoon: "午後",
		evening: "夜",
		night: "深夜"
	},
	wide: {
		am: "午前",
		pm: "午後",
		midnight: "深夜",
		noon: "正午",
		morning: "朝",
		afternoon: "午後",
		evening: "夜",
		night: "深夜"
	}
};
const ordinalNumber = (dirtyNumber, options) => {
	const number = Number(dirtyNumber);
	switch (String(options?.unit)) {
		case "year": return `${number}年`;
		case "quarter": return `第${number}四半期`;
		case "month": return `${number}月`;
		case "week": return `第${number}週`;
		case "date": return `${number}日`;
		case "hour": return `${number}時`;
		case "minute": return `${number}分`;
		case "second": return `${number}秒`;
		default: return `${number}`;
	}
};
const localize = {
	ordinalNumber,
	era: buildLocalizeFn({
		values: eraValues,
		defaultWidth: "wide"
	}),
	quarter: buildLocalizeFn({
		values: quarterValues,
		defaultWidth: "wide",
		argumentCallback: (quarter) => Number(quarter) - 1
	}),
	month: buildLocalizeFn({
		values: monthValues,
		defaultWidth: "wide"
	}),
	day: buildLocalizeFn({
		values: dayValues,
		defaultWidth: "wide"
	}),
	dayPeriod: buildLocalizeFn({
		values: dayPeriodValues,
		defaultWidth: "wide",
		formattingValues: formattingDayPeriodValues,
		defaultFormattingWidth: "wide"
	})
};

//#endregion
//#region ../../node_modules/.pnpm/date-fns@4.1.0/node_modules/date-fns/locale/ja/_lib/match.js
const matchOrdinalNumberPattern = /^第?\d+(年|四半期|月|週|日|時|分|秒)?/i;
const parseOrdinalNumberPattern = /\d+/i;
const matchEraPatterns = {
	narrow: /^(B\.?C\.?|A\.?D\.?)/i,
	abbreviated: /^(紀元[前後]|西暦)/i,
	wide: /^(紀元[前後]|西暦)/i
};
const parseEraPatterns = {
	narrow: [/^B/i, /^A/i],
	any: [/^(紀元前)/i, /^(西暦|紀元後)/i]
};
const matchQuarterPatterns = {
	narrow: /^[1234]/i,
	abbreviated: /^Q[1234]/i,
	wide: /^第[1234一二三四１２３４]四半期/i
};
const parseQuarterPatterns = { any: [
	/(1|一|１)/i,
	/(2|二|２)/i,
	/(3|三|３)/i,
	/(4|四|４)/i
] };
const matchMonthPatterns = {
	narrow: /^([123456789]|1[012])/,
	abbreviated: /^([123456789]|1[012])月/i,
	wide: /^([123456789]|1[012])月/i
};
const parseMonthPatterns = { any: [
	/^1\D/,
	/^2/,
	/^3/,
	/^4/,
	/^5/,
	/^6/,
	/^7/,
	/^8/,
	/^9/,
	/^10/,
	/^11/,
	/^12/
] };
const matchDayPatterns = {
	narrow: /^[日月火水木金土]/,
	short: /^[日月火水木金土]/,
	abbreviated: /^[日月火水木金土]/,
	wide: /^[日月火水木金土]曜日/
};
const parseDayPatterns = { any: [
	/^日/,
	/^月/,
	/^火/,
	/^水/,
	/^木/,
	/^金/,
	/^土/
] };
const matchDayPeriodPatterns = { any: /^(AM|PM|午前|午後|正午|深夜|真夜中|夜|朝)/i };
const parseDayPeriodPatterns = { any: {
	am: /^(A|午前)/i,
	pm: /^(P|午後)/i,
	midnight: /^深夜|真夜中/i,
	noon: /^正午/i,
	morning: /^朝/i,
	afternoon: /^午後/i,
	evening: /^夜/i,
	night: /^深夜/i
} };
const match = {
	ordinalNumber: buildMatchPatternFn({
		matchPattern: matchOrdinalNumberPattern,
		parsePattern: parseOrdinalNumberPattern,
		valueCallback: function(value) {
			return parseInt(value, 10);
		}
	}),
	era: buildMatchFn({
		matchPatterns: matchEraPatterns,
		defaultMatchWidth: "wide",
		parsePatterns: parseEraPatterns,
		defaultParseWidth: "any"
	}),
	quarter: buildMatchFn({
		matchPatterns: matchQuarterPatterns,
		defaultMatchWidth: "wide",
		parsePatterns: parseQuarterPatterns,
		defaultParseWidth: "any",
		valueCallback: (index) => index + 1
	}),
	month: buildMatchFn({
		matchPatterns: matchMonthPatterns,
		defaultMatchWidth: "wide",
		parsePatterns: parseMonthPatterns,
		defaultParseWidth: "any"
	}),
	day: buildMatchFn({
		matchPatterns: matchDayPatterns,
		defaultMatchWidth: "wide",
		parsePatterns: parseDayPatterns,
		defaultParseWidth: "any"
	}),
	dayPeriod: buildMatchFn({
		matchPatterns: matchDayPeriodPatterns,
		defaultMatchWidth: "any",
		parsePatterns: parseDayPeriodPatterns,
		defaultParseWidth: "any"
	})
};

//#endregion
//#region ../../node_modules/.pnpm/date-fns@4.1.0/node_modules/date-fns/locale/ja.js
/**
* @category Locales
* @summary Japanese locale.
* @language Japanese
* @iso-639-2 jpn
* @author Thomas Eilmsteiner [@DeMuu](https://github.com/DeMuu)
* @author Yamagishi Kazutoshi [@ykzts](https://github.com/ykzts)
* @author Luca Ban [@mesqueeb](https://github.com/mesqueeb)
* @author Terrence Lam [@skyuplam](https://github.com/skyuplam)
* @author Taiki IKeda [@so99ynoodles](https://github.com/so99ynoodles)
*/
const ja = {
	code: "ja",
	formatDistance,
	formatLong,
	formatRelative,
	localize,
	match,
	options: {
		weekStartsOn: 0,
		firstWeekContainsDate: 1
	}
};

//#endregion
//#region ../../packages/ui/i18n/src/provider/LanguageProvider.tsx
const SUPPORTED_LANGUAGES = [{
	code: "en",
	name: "English",
	nativeName: "English",
	flag: "🇺🇸",
	direction: "ltr",
	dateLocale: enUS
}, {
	code: "ja",
	name: "Japanese",
	nativeName: "日本語",
	flag: "🇯🇵",
	direction: "ltr",
	dateLocale: ja
}];
const LanguageContext = createContext(void 0);
const defaultContextValue = {
	currentLanguage: SUPPORTED_LANGUAGES[0] || {
		code: "en",
		name: "English",
		nativeName: "English",
		flag: "🇺🇸",
		direction: "ltr",
		dateLocale: enUS
	},
	supportedLanguages: SUPPORTED_LANGUAGES,
	changeLanguage: async () => {},
	isLoading: false,
	formatters: {
		number: { format: (n) => n.toString() },
		currency: { format: (n) => `$${n}` },
		date: { format: (d) => d.toLocaleDateString() },
		time: { format: (d) => d.toLocaleTimeString() },
		relativeTime: { format: (value, unit) => `${value} ${unit}s ago` }
	}
};

//#endregion
//#region ../../packages/ui/i18n/src/utils/i18nLogger.ts
const isDev = (() => {
	try {
		return Boolean(typeof globalThis !== "undefined" && globalThis.import?.meta?.env?.DEV || false);
	} catch {
		return false;
	}
})();
const noopVoid = () => void 0;
const i18nGroupEnd = isDev ? console.groupEnd.bind(console) : noopVoid;

//#endregion
//#region src/ui/hooks/useMapStyleStep.ts
const useMapStyleStep = ({ value, onChange }) => {
	const { t: t$1 } = useTranslation("basemap-plugin");
	const style = value?.style || "";
	const url = value?.customStyleUrl || "";
	return {
		t: t$1,
		presets: useMemo(() => [
			"streets",
			"satellite",
			"terrain",
			"dark",
			"light"
		].map((key) => ({
			key,
			label: BUILT_IN_STYLES[key].name,
			description: BUILT_IN_STYLES[key].description
		})), []),
		style,
		url,
		selectPreset: useCallback((_e, next) => {
			if (!next) return;
			onChange({
				...value || { style: next },
				style: next,
				customStyleUrl: void 0,
				customStyleConfig: void 0
			});
		}, [onChange, value]),
		activateCustom: useCallback(() => {
			onChange({
				...value || { style: "custom" },
				style: "custom"
			});
		}, [onChange, value]),
		updateCustomUrl: useCallback((e) => {
			onChange({
				...value || { style: "custom" },
				style: "custom",
				customStyleUrl: e.target.value
			});
		}, [onChange, value])
	};
};

//#endregion
//#region src/ui/components/steps/MapStyleStep.tsx
const MapStyleStep = ({ value, onChange }) => {
	const { t: t$1, presets, style, url, selectPreset, activateCustom, updateCustomUrl } = useMapStyleStep({
		value,
		onChange
	});
	const controlId = useId();
	return /* @__PURE__ */ jsxs(Box, {
		sx: { p: 2 },
		children: [/* @__PURE__ */ jsx(Typography, {
			variant: "body2",
			color: "text.secondary",
			sx: { mb: 2 },
			children: t$1("mapStyle.description", "Choose one of the bundled MapLibre styles or switch to “Custom” to reference your own style JSON.")
		}), /* @__PURE__ */ jsxs(Stack, {
			spacing: 2,
			children: [/* @__PURE__ */ jsx(ToggleButtonGroup, {
				exclusive: true,
				fullWidth: true,
				value: style && style !== "custom" ? style : null,
				onChange: selectPreset,
				sx: {
					display: "flex",
					flexWrap: "wrap",
					gap: 1
				},
				children: presets.map((preset) => /* @__PURE__ */ jsx(ToggleButton, {
					value: preset.key,
					sx: {
						flex: "1 1 160px",
						textTransform: "none",
						borderRadius: 2,
						"&.Mui-selected": {
							borderColor: "primary.main",
							backgroundColor: "primary.main",
							color: "primary.contrastText"
						}
					},
					children: /* @__PURE__ */ jsxs(Stack, {
						spacing: .5,
						alignItems: "flex-start",
						children: [/* @__PURE__ */ jsx(Typography, {
							variant: "subtitle2",
							children: t$1(`mapStyle.presets.${preset.key}.label`, preset.label)
						}), /* @__PURE__ */ jsx(Typography, {
							variant: "caption",
							sx: { textAlign: "left" },
							children: t$1(`mapStyle.presets.${preset.key}.description`, preset.description)
						})]
					})
				}, preset.key))
			}), /* @__PURE__ */ jsx(Card, {
				variant: style === "custom" ? "outlined" : void 0,
				sx: {
					borderColor: style === "custom" ? "primary.main" : "divider",
					borderWidth: 2,
					borderRadius: 2
				},
				children: /* @__PURE__ */ jsx(CardActionArea, {
					onClick: activateCustom,
					disableRipple: true,
					children: /* @__PURE__ */ jsxs(CardContent, { children: [
						/* @__PURE__ */ jsx(Typography, {
							variant: "subtitle2",
							gutterBottom: true,
							children: t$1("mapStyle.custom.title", "Custom Style")
						}),
						/* @__PURE__ */ jsx(Typography, {
							variant: "body2",
							color: "text.secondary",
							children: t$1("mapStyle.custom.description", "Reference your own MapLibre style JSON (hosted URL or inline config). Ideal when you need branded colors or licensed tile providers.")
						}),
						style === "custom" && /* @__PURE__ */ jsx(TextField, {
							sx: { mt: 2 },
							label: String(t$1("mapStyle.custom.urlLabel", "Custom Style URL")),
							id: `${controlId}-custom-style-url`,
							name: "custom-style-url",
							placeholder: String(t$1("mapStyle.custom.urlPlaceholder", "https://example.com/style.json")),
							value: url,
							onChange: updateCustomUrl,
							fullWidth: true,
							inputProps: {
								id: `${controlId}-custom-style-url`,
								name: "custom-style-url"
							}
						})
					] })
				})
			})]
		})]
	});
};

//#endregion
//#region src/ui/components/steps/ViewportStep.tsx
const FALLBACK_VIEWPORT = {
	center: [0, 0],
	zoom: 1,
	bearing: 0,
	pitch: 0
};
const OSM_RASTER_STYLE = {
	version: 8,
	name: "osm-basemap",
	sources: { osm: {
		type: "raster",
		tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
		tileSize: 256,
		attribution: "© OpenStreetMap contributors"
	} },
	layers: [{
		id: "osm",
		type: "raster",
		source: "osm"
	}]
};
const areViewStatesEqual = (a, b) => {
	const eps = 1e-6;
	return Math.abs(a.longitude - b.longitude) < eps && Math.abs(a.latitude - b.latitude) < eps && Math.abs(a.zoom - b.zoom) < eps && Math.abs((a.bearing ?? 0) - (b.bearing ?? 0)) < eps;
};
const LazyMapLibreMap = lazy(async () => {
	return { default: (await loadMapLibreMap()).MapLibreMap };
});
const ViewportStep = ({ value, mapStyle, onChange }) => {
	const { t: t$1 } = useTranslation("basemap-plugin");
	const controlId = useId();
	const initial = useMemo(() => ({
		longitude: value?.center[0] ?? FALLBACK_VIEWPORT.center[0],
		latitude: value?.center[1] ?? FALLBACK_VIEWPORT.center[1],
		zoom: value?.zoom ?? FALLBACK_VIEWPORT.zoom,
		bearing: value?.bearing ?? FALLBACK_VIEWPORT.bearing,
		pitch: 0
	}), [value]);
	const [viewState, setViewState] = useState(initial);
	const [canRenderMap, setCanRenderMap] = useState(false);
	const lastEmittedRef = useRef(initial);
	const mapRef = useRef(null);
	const dragStoreRef = useRef(createStore());
	const dragAtomRef = useRef(atom(initial));
	const setDragViewState = useCallback((next) => {
		dragStoreRef.current.set(dragAtomRef.current, next);
	}, []);
	useEffect(() => {
		setCanRenderMap(true);
	}, []);
	useEffect(() => {
		const next = {
			longitude: value?.center[0] ?? FALLBACK_VIEWPORT.center[0],
			latitude: value?.center[1] ?? FALLBACK_VIEWPORT.center[1],
			zoom: value?.zoom ?? FALLBACK_VIEWPORT.zoom,
			bearing: value?.bearing ?? FALLBACK_VIEWPORT.bearing,
			pitch: 0
		};
		setViewState((prev) => areViewStatesEqual(prev, next) ? prev : next);
		setDragViewState(next);
		lastEmittedRef.current = next;
		if (mapRef.current) {
			if (!areViewStatesEqual({
				longitude: mapRef.current.getCenter().lng,
				latitude: mapRef.current.getCenter().lat,
				zoom: mapRef.current.getZoom(),
				bearing: mapRef.current.getBearing(),
				pitch: mapRef.current.getPitch()
			}, next)) mapRef.current.jumpTo({
				center: [next.longitude, next.latitude],
				zoom: next.zoom,
				bearing: next.bearing ?? 0,
				pitch: 0
			});
		}
	}, [value]);
	const mapStyleSource = useMemo(() => {
		if (mapStyle) return resolveMapStyleSource(mapStyle);
		return OSM_RASTER_STYLE;
	}, [mapStyle]);
	const mapStyleProps = useMemo(() => typeof mapStyleSource === "string" ? { mapStyleUrl: mapStyleSource } : { mapStyleObject: mapStyleSource }, [mapStyleSource]);
	const mapInteractionOptions = useMemo(() => ({
		interactive: true,
		scrollZoom: true,
		dragPan: true,
		dragRotate: false,
		doubleClickZoom: true,
		touchZoomRotate: true
	}), []);
	const navigationControls = useMemo(() => ({ navigation: { position: "top-right" } }), []);
	const commitViewState = useCallback((next, source) => {
		setViewState((prev) => {
			if (areViewStatesEqual(prev, next)) return prev;
			return next;
		});
		if (areViewStatesEqual(lastEmittedRef.current, next)) return;
		lastEmittedRef.current = next;
		if (source === "form" && mapRef.current) mapRef.current.jumpTo({
			center: [next.longitude, next.latitude],
			zoom: next.zoom,
			bearing: next.bearing ?? 0,
			pitch: 0
		});
		onChange({
			center: [next.longitude, next.latitude],
			zoom: next.zoom,
			bearing: next.bearing ?? 0,
			pitch: 0
		});
	}, [onChange]);
	const handleMapLoad = useCallback((map) => {
		mapRef.current = map;
	}, []);
	const handleViewStateChange = useCallback((next) => {
		setDragViewState(next);
		setViewState((prev) => areViewStatesEqual(prev, next) ? prev : next);
	}, [setDragViewState]);
	const handleViewStateChangeEnd = useCallback((next) => {
		setDragViewState(next);
		commitViewState(dragStoreRef.current.get(dragAtomRef.current) ?? next, "map-end");
	}, [commitViewState, setDragViewState]);
	const setViewportFromInput = useCallback((next) => {
		commitViewState({
			longitude: next.center?.[0] ?? viewState.longitude,
			latitude: next.center?.[1] ?? viewState.latitude,
			zoom: next.zoom ?? viewState.zoom,
			bearing: next.bearing ?? viewState.bearing ?? 0,
			pitch: 0
		}, "form");
	}, [commitViewState, viewState]);
	const formatCoord = (val, digits = 4) => {
		if (!Number.isFinite(val)) return "0.0000";
		return val.toFixed(digits);
	};
	return /* @__PURE__ */ jsxs(Box, {
		sx: {
			p: 2,
			overscrollBehavior: "contain",
			height: "100%",
			boxSizing: "border-box",
			display: "flex",
			flexDirection: "column",
			gap: 2,
			overflow: "hidden"
		},
		children: [
			/* @__PURE__ */ jsx(Typography, {
				variant: "body2",
				color: "text.secondary",
				sx: { flexShrink: 0 },
				children: t$1("viewport.description", "Fine-tune the initial viewport. Enter values directly or use the map preview below.")
			}),
			/* @__PURE__ */ jsxs(Stack, {
				direction: {
					xs: "column",
					md: "row"
				},
				spacing: 2,
				sx: { flexShrink: 0 },
				children: [
					/* @__PURE__ */ jsx(TextField, {
						label: t$1("viewport.fields.longitude.label", "Longitude"),
						type: "number",
						id: `${controlId}-longitude`,
						name: "longitude",
						inputProps: {
							step: .01,
							min: -180,
							max: 180,
							id: `${controlId}-longitude`,
							name: "longitude"
						},
						value: viewState.longitude,
						onChange: (e) => setViewportFromInput({ center: [Number(e.target.value), viewState.latitude] }),
						fullWidth: true
					}),
					/* @__PURE__ */ jsx(TextField, {
						label: t$1("viewport.fields.latitude.label", "Latitude"),
						type: "number",
						id: `${controlId}-latitude`,
						name: "latitude",
						inputProps: {
							step: .01,
							min: -90,
							max: 90,
							id: `${controlId}-latitude`,
							name: "latitude"
						},
						value: viewState.latitude,
						onChange: (e) => setViewportFromInput({ center: [viewState.longitude, Number(e.target.value)] }),
						fullWidth: true
					}),
					/* @__PURE__ */ jsx(TextField, {
						label: t$1("viewport.fields.zoom.label", "Zoom"),
						type: "number",
						id: `${controlId}-zoom`,
						name: "zoom",
						inputProps: {
							step: 1,
							min: 0,
							max: 24,
							id: `${controlId}-zoom`,
							name: "zoom"
						},
						value: viewState.zoom,
						onChange: (e) => setViewportFromInput({ zoom: Number(e.target.value) }),
						fullWidth: true
					}),
					/* @__PURE__ */ jsx(TextField, {
						label: t$1("viewport.fields.bearing.label", "Bearing"),
						type: "number",
						id: `${controlId}-bearing`,
						name: "bearing",
						inputProps: {
							step: 1,
							min: -180,
							max: 180,
							id: `${controlId}-bearing`,
							name: "bearing"
						},
						value: viewState.bearing ?? 0,
						onChange: (e) => setViewportFromInput({ bearing: Number(e.target.value) }),
						fullWidth: true
					})
				]
			}),
			/* @__PURE__ */ jsxs(Box, {
				sx: {
					borderRadius: 2,
					border: "1px solid",
					borderColor: "divider",
					overflow: "hidden",
					position: "relative",
					overscrollBehavior: "contain",
					touchAction: "none",
					flexGrow: 1,
					minHeight: 280
				},
				children: [canRenderMap ? /* @__PURE__ */ jsx(Suspense, {
					fallback: /* @__PURE__ */ jsx(Box, {
						sx: {
							width: "100%",
							height: "100%",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							color: "text.secondary",
							fontSize: 12
						},
						children: t$1("viewport.loading", "Loading map…")
					}),
					children: /* @__PURE__ */ jsx(LazyMapLibreMap, {
						initialViewState: initial,
						...mapStyleProps,
						width: "100%",
						height: "100%",
						mapOptions: mapInteractionOptions,
						controls: navigationControls,
						onLoad: handleMapLoad,
						onViewStateChange: handleViewStateChange,
						onMoveEnd: handleViewStateChangeEnd
					})
				}) : /* @__PURE__ */ jsx(Box, {
					sx: {
						width: "100%",
						height: "100%",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						color: "text.secondary",
						fontSize: 12
					},
					children: t$1("viewport.preparing", "Preparing map…")
				}), /* @__PURE__ */ jsx(Box, { sx: {
					position: "absolute",
					inset: 0,
					pointerEvents: "none",
					"&::before": {
						content: "\"\"",
						position: "absolute",
						top: "50%",
						left: "50%",
						width: 32,
						height: 2,
						backgroundColor: "rgba(255,255,255,0.95)",
						transform: "translate(-50%, -50%)",
						boxShadow: "0 0 2px rgba(0,0,0,0.6)"
					},
					"&::after": {
						content: "\"\"",
						position: "absolute",
						top: "50%",
						left: "50%",
						width: 2,
						height: 32,
						backgroundColor: "rgba(255,255,255,0.95)",
						transform: "translate(-50%, -50%)",
						boxShadow: "0 0 2px rgba(0,0,0,0.6)"
					}
				} })]
			}),
			/* @__PURE__ */ jsx(Box, {
				sx: {
					textAlign: "center",
					color: "text.secondary"
				},
				children: /* @__PURE__ */ jsx(Typography, {
					variant: "caption",
					children: t$1("viewport.summary", "Center: {{lng}}, {{lat}} / Zoom: {{zoom}} / Bearing: {{bearing}}", {
						lng: formatCoord(viewState.longitude),
						lat: formatCoord(viewState.latitude),
						zoom: viewState.zoom,
						bearing: viewState.bearing ?? 0
					})
				})
			})
		]
	});
};

//#endregion
//#region src/ui/components/basemapStepConfigs.tsx
const isRecord = (value) => typeof value === "object" && value !== null;
const ensureDraft = (data) => {
	const record = isRecord(data) ? data : {};
	return {
		mapStyle: record.mapStyle ?? DEFAULT_MAP_STYLE,
		viewport: record.viewport ?? DEFAULT_VIEWPORT
	};
};
const mergeDraft = (current, updates) => {
	return {
		mapStyle: updates.mapStyle ?? current.mapStyle ?? DEFAULT_MAP_STYLE,
		viewport: updates.viewport ?? current.viewport ?? DEFAULT_VIEWPORT
	};
};
const hasValidViewport = (value) => {
	if (!value) return false;
	const [lng, lat] = value.center ?? [];
	const zoom = value.zoom;
	return Array.isArray(value.center) && value.center.length === 2 && Number.isFinite(lng) && lng >= -180 && lng <= 180 && Number.isFinite(lat) && lat >= -90 && lat <= 90 && Number.isFinite(zoom) && zoom >= 0 && zoom <= 24;
};
const t = (key, defaultValue) => i18n.t(key, {
	defaultValue,
	ns: "basemap-plugin"
});
const getBasemapStepConfigs = () => [{
	id: "map-style",
	label: t("steps.mapStyle.label", "Map Style"),
	componentFactory: (p) => {
		const draft = ensureDraft(p.data);
		const handleChange = (next) => p.onChange(mergeDraft(draft, { mapStyle: next }));
		return /* @__PURE__ */ jsx(MapStyleStep, {
			value: draft.mapStyle ?? (p.mode === "edit" ? draft.mapStyle : void 0),
			onChange: handleChange
		});
	},
	validate: (data) => {
		try {
			const style = data?.mapStyle?.style;
			if (!style) return false;
			if (style === "custom") {
				const url = data?.mapStyle?.customStyleUrl;
				new URL(String(url));
			}
			return true;
		} catch {
			return false;
		}
	}
}, {
	id: "viewport",
	label: t("steps.viewport.label", "Map Viewport"),
	componentFactory: (p) => {
		const draft = ensureDraft(p.data);
		const handleViewportChange = (next) => p.onChange(mergeDraft(draft, { viewport: next }));
		if (!draft.viewport) throw new Error("[Basemap] Viewport is not initialized");
		return /* @__PURE__ */ jsx(ViewportStep, {
			value: draft.viewport,
			mapStyle: draft.mapStyle,
			onChange: handleViewportChange
		});
	},
	validate: (data) => {
		if (!data?.mapStyle) return false;
		const viewport = data?.viewport;
		return hasValidViewport(viewport);
	}
}];

//#endregion
//#region src/ui/components/steps-provider.tsx
PluginStepRegistry.getInstance().registerConfigProvider({
	nodeType: "basemap",
	getCreateStepConfigs: getBasemapStepConfigs,
	getEditStepConfigs: () => getBasemapStepConfigs()
});

//#endregion
//#region src/ui/i18n.ts
const localeModules = import.meta.glob("./locales/*.json", { eager: true });
Object.entries(localeModules).forEach(([path$1, mod]) => {
	const lng = path$1.match(/locales\/([a-z-]+)\.json$/i)?.[1];
	if (!lng) return;
	const resources = mod.default ?? mod;
	if (!resources) return;
	i18n.addResourceBundle(lng, "basemap-plugin", resources, true, true);
});

//#endregion
export { BaseMapDisplay, BaseMapPreview, DEFAULT_MAP_STYLE, DEFAULT_VIEWPORT, MapStyleStep, ViewportStep, __testUtils, buildBaseMapEntityFromNode, useBaseMapConfiguration, useBaseMapEntity, useBaseMapValidation };
//# sourceMappingURL=index.js.map