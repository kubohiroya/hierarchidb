import { CrossViewSnackbar, useCrossHighlightSync } from "@hierarchidb/ui-data-grid";
import { loadMapLibreMap } from "@hierarchidb/ui-map";
import { Alert, Box, Card, CardActionArea, CardContent, Chip, CircularProgress, Collapse, Divider, IconButton, List, ListItem, ListItemIcon, ListItemText, Paper, Stack, TextField, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from "@mui/material";
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getWorkerClientHook } from "@hierarchidb/runtime-client";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { CameraAlt, DarkMode, Edit, ExpandLess, ExpandMore, Fullscreen, Info, Layers, LightMode, Map, Refresh, Satellite, Terrain, Tune } from "@mui/icons-material";
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
const DEFAULT_VIEWPORT$1 = {
	center: [139.767, 35.681],
	zoom: 10,
	bearing: 0,
	pitch: 0
};
function isRecord$1(value) {
	return typeof value === "object" && value !== null;
}
const toStringArray$1 = (value) => Array.isArray(value) ? value.filter((entry) => typeof entry === "string") : [];
const readNodeData = (node) => {
	if (!node) return {};
	const nodeRecord = node;
	const rawData = nodeRecord.draftData ?? nodeRecord.data;
	return isRecord$1(rawData) ? rawData : {};
};
function normalizeMapStyle(mapStyle) {
	return {
		...DEFAULT_MAP_STYLE,
		...mapStyle ?? {}
	};
}
function normalizeViewport(viewport) {
	return {
		...DEFAULT_VIEWPORT$1,
		...viewport ?? {}
	};
}
function buildBaseMapEntityFromNode(node) {
	if (!node) return null;
	const data = readNodeData(node);
	const mapStyle = normalizeMapStyle(data.mapStyle);
	const viewport = normalizeViewport(data.viewport);
	const createdAt = typeof node.createdAt === "number" ? node.createdAt : Date.now();
	const updatedAt = typeof node.updatedAt === "number" ? node.updatedAt : Date.now();
	const name = typeof node.name === "string" ? node.name : void 0;
	const description = typeof node.description === "string" ? node.description : void 0;
	const tags = toStringArray$1(data.tags);
	return {
		id: node.id,
		nodeId: node.id,
		mapStyle,
		viewport,
		name,
		description,
		tags,
		createdAt,
		updatedAt,
		version: typeof node.version === "number" ? node.version : 1
	};
}
function createFallbackEntity(nodeId) {
	const now = Date.now();
	return {
		id: nodeId,
		nodeId,
		mapStyle: { ...DEFAULT_MAP_STYLE },
		viewport: { ...DEFAULT_VIEWPORT$1 },
		name: "",
		description: "",
		tags: [],
		createdAt: now,
		updatedAt: now,
		version: 1
	};
}
async function ensureWorkerApis(ref) {
	if (!ref) return null;
	try {
		const api = ref.getAPI();
		const [query, workingCopy] = await Promise.all([api.getQueryAPI(), api.getWorkingCopyAPI()]);
		return {
			query,
			workingCopy
		};
	} catch (error) {
		console.error("[useBaseMapEntity] Failed to acquire worker APIs", error);
		return null;
	}
}
async function ensureWorkingCopyNode(nodeId, wcAPI) {
	let wc = await wcAPI.getWorkingCopy(nodeId);
	if (!wc) wc = await wcAPI.createWorkingCopyFromNode(nodeId);
	if (!wc) throw new Error("Working copy creation failed");
	return {
		workingCopyId: wc.id ?? nodeId,
		workingCopyNode: wc
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
	const workerClientHook = useMemo(() => {
		try {
			return getWorkerClientHook();
		} catch {
			return null;
		}
	}, []);
	const workerClient = workerClientHook ? workerClientHook() : null;
	const fetchEntity = useCallback(async () => {
		if (!nodeId || skip) return;
		try {
			setLoading(true);
			setError(null);
			const apis = await ensureWorkerApis(workerClient);
			if (!apis) throw new Error("Worker APIs unavailable");
			const data = buildBaseMapEntityFromNode(await apis.query.getNode(nodeId));
			if (!data) throw new Error("BaseMap entity not found");
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
	const updateEntity = useCallback(async (updates) => {
		if (!nodeId) throw new Error("Cannot update entity without nodeId");
		setLoading(true);
		try {
			const apis = await ensureWorkerApis(workerClient);
			if (!apis) throw new Error("Worker APIs unavailable");
			const { workingCopyId, workingCopyNode } = await ensureWorkingCopyNode(nodeId, apis.workingCopy);
			const current = buildBaseMapEntityFromNode(workingCopyNode) ?? createFallbackEntity(nodeId);
			const next = {
				...current,
				...updates,
				mapStyle: normalizeMapStyle(updates.mapStyle ?? current.mapStyle),
				viewport: normalizeViewport(updates.viewport ?? current.viewport),
				updatedAt: Date.now()
			};
			const existingData = readNodeData(workingCopyNode);
			await apis.workingCopy.updateWorkingCopy(workingCopyId, { draftData: {
				...existingData,
				mapStyle: next.mapStyle,
				viewport: next.viewport,
				tags: next.tags,
				name: next.name,
				description: next.description
			} });
			await apis.workingCopy.commitWorkingCopy(workingCopyId);
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
		workerClient
	]);
	useEffect(() => {
		fetchEntity();
	}, [fetchEntity]);
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
				const errors = [];
				if (config.mapStyle) {
					const { style, customStyleUrl } = config.mapStyle;
					if (![
						"streets",
						"satellite",
						"terrain",
						"dark",
						"light",
						"custom"
					].includes(style)) errors.push("Invalid map style");
					if (style === "custom") if (!customStyleUrl) errors.push("Custom style URL is required when using custom style");
					else try {
						new URL(customStyleUrl);
					} catch {
						errors.push("Invalid custom style URL format");
					}
				}
				if (config.viewport) {
					const { center, zoom, bearing, pitch } = config.viewport;
					if (!Array.isArray(center) || center.length !== 2 || typeof center[0] !== "number" || typeof center[1] !== "number") errors.push("Valid center coordinates are required");
					if (typeof zoom !== "number" || zoom < 0 || zoom > 24) errors.push("Zoom must be a number between 0 and 24");
					if (typeof bearing !== "number" || bearing < 0 || bearing >= 360) errors.push("Bearing must be a number between 0 and 360");
					if (typeof pitch !== "number" || pitch < 0 || pitch > 60) errors.push("Pitch must be a number between 0 and 60");
				}
				setValidation({
					isValid: errors.length === 0,
					errors
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
const __testUtils = {
	normalizeMapStyle,
	normalizeViewport,
	buildBaseMapEntityFromNode
};

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
const BaseMapDisplay = ({ nodeId, entity: providedEntity, width = "100%", height = "400px", style, onLoad, onViewStateChange, showLoadingIndicator = true, interactive = true, datasetId, bindLayerIds, bindSourceId, enableDemoOverlay = false }) => {
	const shouldFetch = !providedEntity && Boolean(nodeId);
	const { entity: fetchedEntity, loading: remoteLoading, error: remoteError } = useBaseMapEntity(shouldFetch ? nodeId : null, { skip: !shouldFetch });
	const entity = providedEntity ?? fetchedEntity ?? void 0;
	const [loading, setLoading] = useState(!providedEntity);
	const [error, setError] = useState(null);
	const [_mapInstance, setMapInstance] = useState(null);
	const unbindRef = useRef(null);
	const dsId = useMemo(() => datasetId ?? `basemap:${nodeId}`, [datasetId, nodeId]);
	const { bindMapLibre } = useCrossHighlightSync({
		datasetId: dsId,
		withDeckAccessors: false
	});
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
	const mapStyleUrl = useMemo(() => {
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
			if (!bindSourceId || !bindLayerIds || bindLayerIds.length === 0) {
				unbindRef.current?.();
				unbindRef.current = bindMapLibre(map, "demo-source", ["demo-fill", "demo-outline"], { selectOnClick: true });
			}
		});
		onLoad?.(map);
	}, [
		bindLayerIds,
		bindMapLibre,
		bindSourceId,
		enableDemoOverlay,
		entity?.viewport?.center,
		onLoad
	]);
	useEffect(() => {
		if (!_mapInstance || !bindSourceId || !bindLayerIds || bindLayerIds.length === 0) return;
		unbindRef.current?.();
		unbindRef.current = bindMapLibre(_mapInstance, bindSourceId, bindLayerIds, { selectOnClick: true });
		return () => {
			unbindRef.current?.();
		};
	}, [
		_mapInstance,
		bindSourceId,
		bindMapLibre,
		bindLayerIds
	]);
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
	return /* @__PURE__ */ jsxs(Box, {
		sx: {
			width,
			height,
			position: "relative",
			...style
		},
		children: [/* @__PURE__ */ jsx(Suspense, {
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
				mapStyle: mapStyleUrl,
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
		}), /* @__PURE__ */ jsx(CrossViewSnackbar, { datasetId: dsId })]
	});
};

//#endregion
//#region src/ui/components/BaseMapPanel.tsx
/**
* BaseMap Panel Component
* Main panel for displaying a configured basemap with controls
*/
const BaseMapPanel = ({ nodeId, height = "500px", showHeader = true, showDetails = true, onEdit, onRefresh, onFullscreen }) => {
	const { entity, loading, error, refetch } = useBaseMapEntity(nodeId);
	const [detailsExpanded, setDetailsExpanded] = useState(false);
	const [currentViewState, setCurrentViewState] = useState(null);
	const handleRefresh = () => {
		refetch();
		onRefresh?.();
	};
	const handleViewStateChange = (viewState) => {
		setCurrentViewState(viewState);
	};
	if (error) return /* @__PURE__ */ jsx(Paper, {
		sx: { p: 3 },
		children: /* @__PURE__ */ jsxs(Alert, {
			severity: "error",
			children: ["Failed to load BaseMap: ", error.message]
		})
	});
	if (!entity && !loading) return /* @__PURE__ */ jsx(Paper, {
		sx: { p: 3 },
		children: /* @__PURE__ */ jsx(Alert, {
			severity: "info",
			children: "No BaseMap configuration found"
		})
	});
	return /* @__PURE__ */ jsxs(Paper, {
		elevation: 2,
		sx: {
			height: showDetails ? "auto" : height,
			display: "flex",
			flexDirection: "column"
		},
		children: [
			showHeader && /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx(Box, {
				sx: { p: 2 },
				children: /* @__PURE__ */ jsxs(Stack, {
					direction: "row",
					alignItems: "center",
					justifyContent: "space-between",
					children: [/* @__PURE__ */ jsxs(Stack, {
						direction: "row",
						alignItems: "center",
						spacing: 1,
						children: [
							/* @__PURE__ */ jsx(Map, { color: "primary" }),
							/* @__PURE__ */ jsx(Typography, {
								variant: "h6",
								children: "BaseMap"
							}),
							/* @__PURE__ */ jsx(Typography, {
								variant: "body2",
								color: "text.secondary",
								children: entity?.mapStyle?.style ?? "loading…"
							}),
							/* @__PURE__ */ jsxs(Typography, {
								variant: "body2",
								color: "text.secondary",
								children: ["#", nodeId]
							})
						]
					}), /* @__PURE__ */ jsxs(Stack, {
						direction: "row",
						spacing: 1,
						children: [
							onEdit && /* @__PURE__ */ jsx(Tooltip, {
								title: "Edit BaseMap",
								children: /* @__PURE__ */ jsx(IconButton, {
									size: "small",
									onClick: onEdit,
									children: /* @__PURE__ */ jsx(Edit, {})
								})
							}),
							/* @__PURE__ */ jsx(Tooltip, {
								title: "Refresh",
								children: /* @__PURE__ */ jsx(IconButton, {
									size: "small",
									onClick: handleRefresh,
									children: /* @__PURE__ */ jsx(Refresh, {})
								})
							}),
							onFullscreen && /* @__PURE__ */ jsx(Tooltip, {
								title: "Fullscreen",
								children: /* @__PURE__ */ jsx(IconButton, {
									size: "small",
									onClick: onFullscreen,
									children: /* @__PURE__ */ jsx(Fullscreen, {})
								})
							}),
							showDetails && /* @__PURE__ */ jsx(Tooltip, {
								title: detailsExpanded ? "Hide details" : "Show details",
								children: /* @__PURE__ */ jsx(IconButton, {
									size: "small",
									onClick: () => setDetailsExpanded(!detailsExpanded),
									children: detailsExpanded ? /* @__PURE__ */ jsx(ExpandLess, {}) : /* @__PURE__ */ jsx(ExpandMore, {})
								})
							})
						]
					})]
				})
			}), /* @__PURE__ */ jsx(Divider, {})] }),
			/* @__PURE__ */ jsx(Box, {
				sx: {
					flexGrow: 1,
					minHeight: height
				},
				children: /* @__PURE__ */ jsx(BaseMapDisplay, {
					nodeId,
					entity: entity || void 0,
					height,
					onViewStateChange: handleViewStateChange,
					showLoadingIndicator: loading
				})
			}),
			showDetails && /* @__PURE__ */ jsxs(Collapse, {
				in: detailsExpanded,
				children: [/* @__PURE__ */ jsx(Divider, {}), /* @__PURE__ */ jsxs(Box, {
					sx: { p: 2 },
					children: [/* @__PURE__ */ jsx(Typography, {
						variant: "subtitle2",
						gutterBottom: true,
						children: "Configuration Details"
					}), /* @__PURE__ */ jsxs(List, {
						dense: true,
						children: [
							/* @__PURE__ */ jsxs(ListItem, { children: [/* @__PURE__ */ jsx(ListItemIcon, { children: /* @__PURE__ */ jsx(Layers, { fontSize: "small" }) }), /* @__PURE__ */ jsx(ListItemText, {
								primary: "Map Style",
								secondary: entity?.mapStyle?.style === "custom" ? entity.mapStyle.customStyleUrl || "Custom configuration" : entity?.mapStyle?.style || "Not configured"
							})] }),
							/* @__PURE__ */ jsxs(ListItem, { children: [/* @__PURE__ */ jsx(ListItemIcon, { children: /* @__PURE__ */ jsx(CameraAlt, { fontSize: "small" }) }), /* @__PURE__ */ jsx(ListItemText, {
								primary: "Viewport",
								secondary: entity?.viewport ? `Center: [${entity.viewport.center[0].toFixed(4)}, ${entity.viewport.center[1].toFixed(4)}], Zoom: ${entity.viewport.zoom.toFixed(1)}` : "Not configured"
							})] }),
							currentViewState && /* @__PURE__ */ jsxs(ListItem, { children: [/* @__PURE__ */ jsx(ListItemIcon, { children: /* @__PURE__ */ jsx(Info, { fontSize: "small" }) }), /* @__PURE__ */ jsx(ListItemText, {
								primary: "Current View",
								secondary: `[${currentViewState.longitude.toFixed(4)}, ${currentViewState.latitude.toFixed(4)}], Zoom: ${currentViewState.zoom.toFixed(1)}`
							})] })
						]
					})]
				})]
			})
		]
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
const BaseMapPreview = ({ mapStyle, viewport, zxy, width = "100%", height = 300, showMetadata = true, interactive = false, title = "BaseMap Preview", datasetId }) => {
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
	const mapStyleUrl = useMemo(() => resolvePreviewMapStyle(mapStyle), [mapStyle]);
	const attribution = useMemo(() => {
		if (mapStyle.style !== "custom") return getStyleAttribution(mapStyle.style);
		return "© Map contributors";
	}, [mapStyle]);
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
					mapStyle: mapStyleUrl,
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
			}), showMetadata && /* @__PURE__ */ jsxs(Fragment, { children: [
				/* @__PURE__ */ jsx(Box, {
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
				}),
				/* @__PURE__ */ jsx(Box, {
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
				}),
				datasetId && /* @__PURE__ */ jsx(Box, {
					sx: {
						position: "absolute",
						inset: 0,
						pointerEvents: "none"
					},
					children: /* @__PURE__ */ jsx(CrossViewSnackbar, { datasetId })
				})
			] })]
		})]
	});
};

//#endregion
//#region src/ui/components/steps/MapStyleStep.tsx
const MapStyleStep = ({ value, onChange }) => {
	const style = value?.style || "";
	const url = value?.customStyleUrl || "";
	const presets = useMemo(() => [
		"streets",
		"satellite",
		"terrain",
		"dark",
		"light"
	].map((key) => ({
		key,
		label: BUILT_IN_STYLES[key].name,
		description: BUILT_IN_STYLES[key].description
	})), []);
	return /* @__PURE__ */ jsxs(Box, {
		sx: { p: 2 },
		children: [/* @__PURE__ */ jsx(Typography, {
			variant: "body2",
			color: "text.secondary",
			sx: { mb: 2 },
			children: "Choose one of the bundled MapLibre styles or switch to “Custom” to reference your own style JSON."
		}), /* @__PURE__ */ jsxs(Stack, {
			spacing: 2,
			children: [/* @__PURE__ */ jsx(ToggleButtonGroup, {
				exclusive: true,
				fullWidth: true,
				value: style && style !== "custom" ? style : null,
				onChange: (_e, next) => {
					if (!next) return;
					onChange({
						...value || { style: next },
						style: next,
						customStyleUrl: void 0,
						customStyleConfig: void 0
					});
				},
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
							children: preset.label
						}), /* @__PURE__ */ jsx(Typography, {
							variant: "caption",
							sx: { textAlign: "left" },
							children: preset.description
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
					onClick: () => onChange({
						...value || { style: "custom" },
						style: "custom"
					}),
					disableRipple: true,
					children: /* @__PURE__ */ jsxs(CardContent, { children: [
						/* @__PURE__ */ jsx(Typography, {
							variant: "subtitle2",
							gutterBottom: true,
							children: "Custom Style"
						}),
						/* @__PURE__ */ jsx(Typography, {
							variant: "body2",
							color: "text.secondary",
							children: "Reference your own MapLibre style JSON (hosted URL or inline config). Ideal when you need branded colors or licensed tile providers."
						}),
						style === "custom" && /* @__PURE__ */ jsx(TextField, {
							sx: { mt: 2 },
							label: "Custom Style URL",
							placeholder: "https://example.com/style.json",
							value: url,
							onChange: (e) => onChange({
								...value || { style: "custom" },
								style: "custom",
								customStyleUrl: e.target.value
							}),
							fullWidth: true
						})
					] })
				})
			})]
		})]
	});
};

//#endregion
//#region src/ui/components/steps/ViewportStep.tsx
const LOCAL_STORAGE_KEY = "zxy";
const DEFAULT_GEO_VIEWPORT = {
	center: [139.767, 35.681],
	zoom: 10,
	bearing: 0,
	pitch: 0
};
const FALLBACK_VIEWPORT = {
	center: [0, 0],
	zoom: 2,
	bearing: 0,
	pitch: 0
};
const DEFAULT_STYLE$1 = { style: "streets" };
const LazyMapLibreMap = lazy(async () => {
	return { default: (await loadMapLibreMap()).MapLibreMap };
});
const ViewportStep = ({ value, mapStyle, onChange, mode, nodeId }) => {
	const readPersistedViewport = useCallback(() => {
		if (typeof window === "undefined" || !window.localStorage) return null;
		try {
			const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
			if (!raw) return null;
			const parsed = JSON.parse(raw);
			if (typeof parsed.longitude === "number" && Number.isFinite(parsed.longitude) && typeof parsed.latitude === "number" && Number.isFinite(parsed.latitude) && typeof parsed.zoom === "number" && Number.isFinite(parsed.zoom)) return {
				center: [parsed.longitude, parsed.latitude],
				zoom: parsed.zoom,
				bearing: 0,
				pitch: 0
			};
			return null;
		} catch {
			return null;
		}
	}, []);
	const persistViewportDefaults = useCallback((viewport) => {
		if (typeof window === "undefined" || !window.localStorage) return;
		try {
			window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({
				longitude: viewport.center[0],
				latitude: viewport.center[1],
				zoom: viewport.zoom
			}));
		} catch {}
	}, []);
	const mapRef = useRef(null);
	const initialViewStateRef = useRef(null);
	const pendingSyncRef = useRef(false);
	const geolocationAppliedRef = useRef(false);
	const initialPersistedRef = useRef(null);
	if (initialPersistedRef.current === null && typeof window !== "undefined") initialPersistedRef.current = readPersistedViewport();
	const [mapInstance, setMapInstance] = useState(null);
	useEffect(() => {
		if (value) return;
		if (geolocationAppliedRef.current) return;
		const applyViewport = (next, persist = false) => {
			if (value) return;
			geolocationAppliedRef.current = true;
			pendingSyncRef.current = true;
			onChange(next);
			if (persist) persistViewportDefaults(next);
		};
		let cancelled = false;
		if (initialPersistedRef.current) {
			applyViewport(initialPersistedRef.current);
			return;
		}
		if (typeof window !== "undefined" && typeof navigator !== "undefined" && navigator.geolocation && typeof navigator.geolocation.getCurrentPosition === "function") navigator.geolocation.getCurrentPosition((pos) => {
			if (cancelled || value || geolocationAppliedRef.current) return;
			const { longitude, latitude, accuracy } = pos.coords;
			const boundedZoom = accuracy && Number.isFinite(accuracy) ? Math.max(5, Math.min(14, 16 - Math.log10(accuracy))) : 10;
			applyViewport({
				center: [longitude, latitude],
				zoom: boundedZoom,
				bearing: 0,
				pitch: 0
			}, true);
		}, () => {
			if (cancelled || value || geolocationAppliedRef.current) return;
			applyViewport(FALLBACK_VIEWPORT);
		}, {
			enableHighAccuracy: true,
			timeout: 5e3,
			maximumAge: 6e4
		});
		else applyViewport(FALLBACK_VIEWPORT);
		return () => {
			cancelled = true;
		};
	}, [
		onChange,
		persistViewportDefaults,
		readPersistedViewport,
		value
	]);
	const vp = value || DEFAULT_GEO_VIEWPORT;
	const selectedStyle = mapStyle || DEFAULT_STYLE$1;
	if (!initialViewStateRef.current) initialViewStateRef.current = {
		longitude: vp.center[0],
		latitude: vp.center[1],
		zoom: vp.zoom,
		bearing: vp.bearing ?? 0,
		pitch: 0
	};
	const setViewport = useCallback((next) => {
		onChange({
			...vp,
			...next,
			pitch: 0
		});
	}, [onChange, vp]);
	const setViewportFromInput = useCallback((next) => {
		pendingSyncRef.current = true;
		setViewport(next);
	}, [setViewport]);
	const mapStyleSource = useMemo(() => resolveMapStyleSource(selectedStyle), [selectedStyle]);
	const resolvedNodeId = useMemo(() => {
		if (mode !== "edit") return void 0;
		if (!nodeId || nodeId === "undefined") return void 0;
		return nodeId;
	}, [mode, nodeId]);
	const hasViewportValue = useMemo(() => {
		if (!value) return false;
		const [lng, lat] = value.center ?? [];
		return Array.isArray(value.center) && value.center.length === 2 && Number.isFinite(lng) && Number.isFinite(lat) && Number.isFinite(value.zoom);
	}, [value]);
	const shouldHydrateViewport = Boolean(resolvedNodeId) && mode === "edit" && !hasViewportValue;
	const hydrationNodeId = shouldHydrateViewport && resolvedNodeId ? resolvedNodeId : null;
	const { entity: baselineEntity } = useBaseMapEntity(hydrationNodeId, { skip: !hydrationNodeId });
	useEffect(() => {
		if (!shouldHydrateViewport) return;
		if (!baselineEntity) return;
		pendingSyncRef.current = true;
		setViewport(baselineEntity.viewport ?? DEFAULT_GEO_VIEWPORT);
	}, [
		baselineEntity,
		shouldHydrateViewport,
		setViewport
	]);
	const handleViewStateChange = useCallback((viewState) => {
		pendingSyncRef.current = false;
		const nextViewport = {
			center: [viewState.longitude, viewState.latitude],
			zoom: viewState.zoom,
			bearing: viewState.bearing ?? 0,
			pitch: 0
		};
		persistViewportDefaults(nextViewport);
		setViewport(nextViewport);
	}, [persistViewportDefaults, setViewport]);
	const handleMapLoad = useCallback((map) => {
		mapRef.current = map;
		setMapInstance(map);
	}, []);
	useEffect(() => {
		if (!mapInstance) return;
		const container = mapInstance.getContainer();
		if (!container) return;
		const handleWheel = (event) => {
			const target = event.target;
			if (!(target instanceof Node)) return;
			if (!container.contains(target)) return;
			if (event.defaultPrevented) return;
			event.preventDefault();
			event.stopPropagation();
		};
		const handleTouchMove = (event) => {
			const target = event.target;
			if (!(target instanceof Node)) return;
			if (!container.contains(target)) return;
			if (event.defaultPrevented) return;
			event.preventDefault();
			event.stopPropagation();
		};
		container.addEventListener("wheel", handleWheel, { passive: false });
		container.addEventListener("touchmove", handleTouchMove, { passive: false });
		return () => {
			container.removeEventListener("wheel", handleWheel);
			container.removeEventListener("touchmove", handleTouchMove);
		};
	}, [mapInstance]);
	useEffect(() => {
		if (!mapRef.current) return;
		if (!pendingSyncRef.current) return;
		mapRef.current.flyTo({
			center: vp.center,
			zoom: vp.zoom,
			bearing: vp.bearing ?? 0,
			pitch: 0
		});
		pendingSyncRef.current = false;
	}, [
		vp.center,
		vp.zoom,
		vp.bearing
	]);
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
				children: "Fine-tune the initial viewport. Enter values directly or drag / zoom the map below."
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
						label: "Longitude",
						type: "number",
						inputProps: {
							step: 1e-4,
							min: -180,
							max: 180
						},
						value: vp.center[0],
						onChange: (e) => setViewportFromInput({ center: [Number(e.target.value), vp.center[1]] }),
						fullWidth: true
					}),
					/* @__PURE__ */ jsx(TextField, {
						label: "Latitude",
						type: "number",
						inputProps: {
							step: 1e-4,
							min: -90,
							max: 90
						},
						value: vp.center[1],
						onChange: (e) => setViewportFromInput({ center: [vp.center[0], Number(e.target.value)] }),
						fullWidth: true
					}),
					/* @__PURE__ */ jsx(TextField, {
						label: "Zoom",
						type: "number",
						inputProps: {
							step: .1,
							min: 0,
							max: 24
						},
						value: vp.zoom,
						onChange: (e) => setViewportFromInput({ zoom: Number(e.target.value) }),
						fullWidth: true
					}),
					/* @__PURE__ */ jsx(TextField, {
						label: "Bearing",
						type: "number",
						inputProps: {
							step: 1,
							min: -180,
							max: 180
						},
						value: vp.bearing,
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
				children: [/* @__PURE__ */ jsx(Suspense, {
					fallback: /* @__PURE__ */ jsx(Box, {
						sx: {
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							height: "100%"
						},
						children: /* @__PURE__ */ jsx(Typography, {
							variant: "caption",
							color: "text.secondary",
							children: "Loading interactive map…"
						})
					}),
					children: /* @__PURE__ */ jsx(LazyMapLibreMap, {
						initialViewState: initialViewStateRef.current,
						mapStyle: mapStyleSource,
						width: "100%",
						height: "100%",
						mapOptions: {
							interactive: true,
							scrollZoom: true,
							dragPan: true,
							dragRotate: false,
							doubleClickZoom: true,
							touchZoomRotate: true
						},
						controls: { navigation: { position: "top-right" } },
						onLoad: handleMapLoad,
						onViewStateChange: handleViewStateChange
					})
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
			})
		]
	});
};

//#endregion
//#region src/ui/components/basemapStepConfigs.tsx
const isRecord = (value) => typeof value === "object" && value !== null;
const toStringArray = (value) => Array.isArray(value) ? value.filter((entry) => typeof entry === "string") : [];
const DEFAULT_STYLE = { style: "streets" };
const DEFAULT_VIEWPORT = {
	center: [139.767, 35.681],
	zoom: 10,
	bearing: 0,
	pitch: 0
};
const normalizeUiState = (current, fallbackTouched) => ({
	mapStyleTouched: typeof current?.mapStyleTouched === "boolean" ? current.mapStyleTouched : fallbackTouched,
	viewportTouched: typeof current?.viewportTouched === "boolean" ? current.viewportTouched : fallbackTouched
});
const readBasicInfoOverrides = (data) => {
	const record = isRecord(data) ? data : void 0;
	const draftRecord = isRecord(record?.draft) ? record.draft : void 0;
	const nameCandidate = typeof record?.name === "string" ? record.name : typeof draftRecord?.name === "string" ? draftRecord.name : void 0;
	const descriptionCandidate = typeof record?.description === "string" ? record.description : typeof draftRecord?.description === "string" ? draftRecord.description : void 0;
	const tags = toStringArray(record?.tags ?? draftRecord?.tags);
	return {
		name: nameCandidate,
		description: descriptionCandidate,
		tags: tags.length ? tags : void 0
	};
};
const isBasemapWorkingCopyRecord = (value) => isRecord(value) && "draft" in value && "treeNodeId" in value && "createdAt" in value && "updatedAt" in value;
const ensureWorkingCopy = (data) => {
	const now = Date.now();
	if (isBasemapWorkingCopyRecord(data)) {
		const cast = data;
		const fallbackTouched = typeof cast.originalVersion === "number";
		const normalizedStyle$1 = normalizeMapStyle(cast.draft?.mapStyle ?? cast.mapStyle ?? DEFAULT_STYLE);
		const normalizedViewport$1 = normalizeViewport(cast.draft?.viewport ?? cast.viewport ?? DEFAULT_VIEWPORT);
		const overrides$1 = readBasicInfoOverrides(cast);
		const rootName = overrides$1.name ?? cast.name;
		const rootDescription = overrides$1.description ?? cast.description;
		const normalizedTags = overrides$1.tags ?? cast.tags ?? toStringArray(cast.draft?.tags);
		return {
			...cast,
			treeNodeId: cast.treeNodeId ?? "",
			createdAt: cast.createdAt ?? now,
			updatedAt: cast.updatedAt ?? now,
			draft: {
				...cast.draft ?? {},
				mapStyle: normalizedStyle$1,
				viewport: normalizedViewport$1,
				name: typeof cast.draft?.name === "string" ? cast.draft.name : rootName,
				description: typeof cast.draft?.description === "string" ? cast.draft.description : rootDescription
			},
			mapStyle: normalizedStyle$1,
			viewport: normalizedViewport$1,
			tags: normalizedTags,
			uiState: normalizeUiState(cast.uiState, fallbackTouched)
		};
	}
	const record = isRecord(data) ? data : {};
	const normalizedStyle = normalizeMapStyle(record.mapStyle);
	const normalizedViewport = normalizeViewport(record.viewport);
	const overrides = readBasicInfoOverrides(record);
	const hasPersistedStyle = isRecord(record.mapStyle);
	const hasPersistedViewport = isRecord(record.viewport);
	return {
		treeNodeId: "",
		createdAt: now,
		updatedAt: now,
		version: 1,
		mapStyle: normalizedStyle,
		viewport: normalizedViewport,
		draft: {
			mapStyle: void 0,
			viewport: void 0,
			name: overrides.name,
			description: overrides.description
		},
		tags: overrides.tags ?? toStringArray(record.tags),
		uiState: {
			mapStyleTouched: hasPersistedStyle,
			viewportTouched: hasPersistedViewport
		}
	};
};
const mergeWorkingCopy = (current, updates) => ({
	...current,
	...updates,
	draft: {
		...current.draft ?? {},
		...updates.draft ?? {}
	},
	mapStyle: updates.draft?.mapStyle ?? updates.mapStyle ?? current.mapStyle,
	viewport: updates.draft?.viewport ?? updates.viewport ?? current.viewport,
	uiState: {
		mapStyleTouched: updates.uiState?.mapStyleTouched ?? current.uiState?.mapStyleTouched ?? false,
		viewportTouched: updates.uiState?.viewportTouched ?? current.uiState?.viewportTouched ?? false
	}
});
const hasValidViewport = (value) => {
	if (!value) return false;
	const [lng, lat] = value.center ?? [];
	const zoom = value.zoom;
	return Array.isArray(value.center) && value.center.length === 2 && Number.isFinite(lng) && lng >= -180 && lng <= 180 && Number.isFinite(lat) && lat >= -90 && lat <= 90 && Number.isFinite(zoom) && zoom >= 0 && zoom <= 24;
};
const getBasemapStepConfigs = () => [{
	id: "map-style",
	label: "Map Style",
	componentFactory: (p) => {
		const workingCopy = ensureWorkingCopy(p.data);
		const handleChange = (next) => p.onChange(mergeWorkingCopy(workingCopy, {
			draft: {
				...workingCopy.draft,
				mapStyle: next
			},
			uiState: {
				...workingCopy.uiState ?? {},
				mapStyleTouched: true
			}
		}));
		return /* @__PURE__ */ jsx(MapStyleStep, {
			value: workingCopy.draft?.mapStyle ?? (p.mode === "edit" ? workingCopy.mapStyle : void 0),
			onChange: handleChange
		});
	},
	validate: (data) => {
		try {
			const style = data?.draft?.mapStyle?.style ?? data?.mapStyle?.style;
			if (!style) return false;
			const touched = Boolean(data?.uiState?.mapStyleTouched);
			const hasPersistedStyle = Boolean(data?.mapStyle?.style);
			if (!touched && !hasPersistedStyle) return false;
			if (style === "custom") {
				const url = data?.draft?.mapStyle?.customStyleUrl;
				new URL(String(url));
			}
			return true;
		} catch {
			return false;
		}
	}
}, {
	id: "viewport",
	label: "Map Viewport",
	componentFactory: (p) => {
		const workingCopy = ensureWorkingCopy(p.data);
		const handleViewportChange = (next) => p.onChange(mergeWorkingCopy(workingCopy, {
			draft: {
				...workingCopy.draft,
				viewport: next
			},
			uiState: {
				...workingCopy.uiState ?? {},
				viewportTouched: true
			}
		}));
		return /* @__PURE__ */ jsx(ViewportStep, {
			value: workingCopy.draft?.viewport ?? workingCopy.viewport,
			mapStyle: workingCopy.draft?.mapStyle ?? workingCopy.mapStyle,
			mode: p.mode,
			nodeId: p.nodeId,
			onChange: handleViewportChange
		});
	},
	validate: (data) => {
		if (!Boolean(data?.uiState?.mapStyleTouched || data?.mapStyle)) return false;
		return hasValidViewport(data?.draft?.viewport ?? data?.viewport);
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
export { BaseMapDisplay, BaseMapPanel, BaseMapPreview, MapStyleStep, ViewportStep, __testUtils, buildBaseMapEntityFromNode, normalizeMapStyle, normalizeViewport, useBaseMapConfiguration, useBaseMapEntity, useBaseMapValidation };
//# sourceMappingURL=index.js.map