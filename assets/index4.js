import "../env.js";
import { i as i18n, r as useTranslation, t as formatBytes } from "../i18n.js";
import { n as LocationSelectionStep, r as BASE_LOCATION_TYPES, t as LocationMapPreview } from "../LocationMapPreview.js";
import { r as getEphemeralLocationDB } from "../EphemeralLocationDB2.js";
import { i as listLocationPoints, o as LocationVectorTileService } from "../pointRepository.js";
import "../locationEntitiesDB2.js";
import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Box, Button, CircularProgress, Divider, FormControlLabel, Grid, Paper, Slider, Stack, Switch, Tab, Tabs, TextField, Typography } from "@mui/material";
import { jsx, jsxs } from "react/jsx-runtime";
import { toNodeId } from "@hierarchidb/common-types";
import { PluginStepRegistry } from "@hierarchidb/plugin-base";
import { DataSourceWithLicense } from "@hierarchidb/ui-datasource";
import RefreshIcon from "@mui/icons-material/Refresh";
import SettingsIcon from "@mui/icons-material/Settings";
import { BuildStepPanel, notify } from "@hierarchidb/components";

//#region src/ui/i18n.ts
const localeModules = import.meta.glob("./locales/*.json", { eager: true });
Object.entries(localeModules).forEach(([path, mod]) => {
	const lng = path.match(/locales\/([a-z-]+)\.json$/i)?.[1];
	if (!lng) return;
	const resources = mod.default ?? mod;
	if (!resources) return;
	i18n.addResourceBundle(lng, "location-plugin", resources, true, true);
});

//#endregion
//#region src/ui/components/steps/LocationDataSourceStep.tsx
const ORDERED_DATA_SOURCES = [
	"openstreetmap",
	"overpass",
	"geonames",
	"wikidata",
	"ourairports",
	"openflights",
	"world-port-index",
	"natural-earth",
	"custom",
	"manual"
];
const LICENSE_DETAILS = {
	openstreetmap: {
		licenseName: "ODbL 1.0",
		licenseUrl: "https://opendatacommons.org/licenses/odbl/",
		attribution: "© OpenStreetMap contributors"
	},
	overpass: {
		licenseName: "ODbL 1.0",
		licenseUrl: "https://opendatacommons.org/licenses/odbl/",
		attribution: "© OpenStreetMap contributors"
	},
	geonames: {
		licenseName: "CC BY 4.0",
		licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
		attribution: "Data provided by GeoNames"
	},
	wikidata: {
		licenseName: "CC0 1.0",
		licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
		attribution: "Data from Wikidata contributors"
	},
	ourairports: {
		licenseName: "Public Domain",
		licenseUrl: "https://ourairports.com/data/",
		attribution: "Data courtesy of OurAirports.com"
	},
	openflights: {
		licenseName: "ODbL 1.0",
		licenseUrl: "https://opendatacommons.org/licenses/odbl/",
		attribution: "OpenFlights project"
	},
	"world-port-index": {
		licenseName: "Public Domain",
		licenseUrl: "https://msi.nga.mil/Publications/WPI",
		attribution: "World Port Index (U.S. National Geospatial-Intelligence Agency)"
	},
	"natural-earth": {
		licenseName: "Public Domain",
		licenseUrl: "https://www.naturalearthdata.com/about/terms-of-use/",
		attribution: "Map data by Natural Earth"
	},
	custom: {
		licenseName: "Custom terms",
		licenseUrl: void 0,
		attribution: void 0
	},
	manual: {
		licenseName: "User provided",
		licenseUrl: void 0,
		attribution: void 0
	}
};
const SOURCE_DESCRIPTIONS = {
	openstreetmap: "OpenStreetMap default pipeline for general points",
	overpass: "OpenStreetMap Overpass API for custom queries",
	geonames: "GeoNames worldwide place names with population attributes",
	wikidata: "Wikidata places and facilities (community maintained)",
	ourairports: "OurAirports global airport database (public domain)",
	openflights: "OpenFlights airport dataset with IATA/ICAO codes",
	"world-port-index": "World Port Index (NGA) major ports worldwide",
	"natural-earth": "Natural Earth populated places and transport hubs",
	custom: "Upload your own tabular dataset",
	manual: "Enter locations manually"
};
const TYPE_ICONS = {
	area_centroid: "🎯",
	airport: "✈️",
	port: "🚢",
	railway_station: "🚉",
	interchange: "🛣️"
};
const SOURCE_TYPES = {
	openstreetmap: [
		"area_centroid",
		"airport",
		"port",
		"railway_station",
		"interchange"
	],
	overpass: [
		"area_centroid",
		"airport",
		"port",
		"railway_station",
		"interchange"
	],
	geonames: [
		"area_centroid",
		"airport",
		"port"
	],
	wikidata: [
		"area_centroid",
		"airport",
		"port",
		"railway_station",
		"interchange"
	],
	ourairports: ["airport"],
	openflights: ["airport"],
	"world-port-index": ["port"],
	"natural-earth": [
		"area_centroid",
		"airport",
		"port"
	],
	custom: [
		"area_centroid",
		"airport",
		"port",
		"railway_station",
		"interchange"
	],
	manual: [
		"area_centroid",
		"airport",
		"port",
		"railway_station",
		"interchange"
	]
};
const LocationDataSourceStep = ({ draft, onUpdate, licenseRequired = true, disabled }) => {
	const { t } = useTranslation();
	const value = useMemo(() => draft.dataSource ?? "openstreetmap", [draft.dataSource]);
	const options = useMemo(() => ORDERED_DATA_SOURCES.map((sourceId) => {
		const license = LICENSE_DETAILS[sourceId];
		return {
			id: sourceId,
			name: t(`dataSource.options.${sourceId}.name`, sourceId),
			description: SOURCE_DESCRIPTIONS[sourceId],
			licenseName: license?.licenseName ?? "License",
			licenseUrl: license?.licenseUrl,
			attribution: license?.attribution
		};
	}), [t]);
	const description = t("dataSource.description", "Choose a dataset source to fetch location data.");
	const renderOption = (option) => {
		const icons = (SOURCE_TYPES[option.id] ?? SOURCE_TYPES.openstreetmap).map((type) => TYPE_ICONS[type] ?? "").filter(Boolean).join(" ");
		return /* @__PURE__ */ jsxs(Stack, {
			spacing: .5,
			children: [
				/* @__PURE__ */ jsxs(Typography, {
					variant: "subtitle1",
					children: [
						option.icon,
						" ",
						option.name
					]
				}),
				option.description && /* @__PURE__ */ jsx(Typography, {
					variant: "body2",
					color: "text.secondary",
					children: option.description
				}),
				/* @__PURE__ */ jsxs(Box, {
					display: "flex",
					gap: 1,
					alignItems: "center",
					children: [/* @__PURE__ */ jsx(Typography, {
						variant: "caption",
						color: "text.secondary",
						children: "Supported types:"
					}), /* @__PURE__ */ jsx(Typography, {
						variant: "caption",
						children: icons
					})]
				})
			]
		});
	};
	return /* @__PURE__ */ jsx(DataSourceWithLicense, {
		options,
		state: {
			dataSourceId: value,
			licenseAgreement: Boolean(draft.licenseAgreement),
			licenseAgreedAt: draft.licenseAgreedAt
		},
		onChange: (next) => {
			onUpdate({
				dataSource: next.dataSourceId ?? value,
				licenseAgreement: next.licenseAgreement,
				licenseAgreedAt: next.licenseAgreedAt
			});
		},
		licenseRequired,
		disabled,
		description: /* @__PURE__ */ jsx(Typography, {
			variant: "body2",
			color: "text.secondary",
			children: description
		}),
		renderOption,
		createAgreedAt: () => Date.now()
	});
};

//#endregion
//#region src/ui/components/steps/LocationBatchParametersStep.tsx
const MIN_CONCURRENCY$1 = 1;
const MAX_CONCURRENCY$1 = 16;
const MIN_ZOOM_LEVEL = 0;
const MAX_ZOOM_LEVEL = 22;
function clamp$1(value, min, max) {
	if (Number.isNaN(value)) return min;
	return Math.min(max, Math.max(min, value));
}
const LocationBatchParametersStep = ({ draft: draftProp, onUpdate }) => {
	const fieldId = useId();
	const { translations } = useTranslation();
	const draft = draftProp ?? {};
	const rawConcurrent = draft.concurrentDownloads ?? 2;
	const concurrentDownloads = clamp$1(Number(rawConcurrent) || 2, MIN_CONCURRENCY$1, MAX_CONCURRENCY$1);
	const rawMinZoom = draft.tilesMinZoom ?? 4;
	const rawMaxZoom = draft.tilesMaxZoom ?? 12;
	const minZoom = clamp$1(Number(rawMinZoom) || 4, MIN_ZOOM_LEVEL, MAX_ZOOM_LEVEL);
	const maxZoom = clamp$1(Number(rawMaxZoom) || 12, MIN_ZOOM_LEVEL, MAX_ZOOM_LEVEL);
	const handleConcurrentDownloadsChange = (_, value) => {
		onUpdate({ concurrentDownloads: clamp$1(Array.isArray(value) ? value[0] ?? concurrentDownloads : value ?? concurrentDownloads, MIN_CONCURRENCY$1, MAX_CONCURRENCY$1) });
	};
	const handleMinZoomChange = (event) => {
		const nextMin = clamp$1(Number(event.target.value), MIN_ZOOM_LEVEL, MAX_ZOOM_LEVEL);
		onUpdate({
			tilesMinZoom: nextMin,
			tilesMaxZoom: Math.max(nextMin, maxZoom)
		});
	};
	const handleMaxZoomChange = (event) => {
		const nextMax = clamp$1(Number(event.target.value), MIN_ZOOM_LEVEL, MAX_ZOOM_LEVEL);
		onUpdate({
			tilesMinZoom: Math.min(nextMax, minZoom),
			tilesMaxZoom: nextMax
		});
	};
	return /* @__PURE__ */ jsxs(Box, {
		display: "flex",
		flexDirection: "column",
		gap: 3,
		children: [/* @__PURE__ */ jsx(Typography, {
			variant: "body2",
			color: "text.secondary",
			children: translations.processing?.description ?? "Configure download and tiling parameters for batch processing."
		}), /* @__PURE__ */ jsxs(Grid, {
			container: true,
			spacing: 3,
			columns: { xs: 12 },
			children: [/* @__PURE__ */ jsxs(Grid, {
				size: {
					xs: 12,
					md: 6
				},
				children: [/* @__PURE__ */ jsxs(Typography, {
					gutterBottom: true,
					children: [
						translations.processing?.concurrentDownloadsLabel ?? "Concurrent Downloads",
						": ",
						concurrentDownloads
					]
				}), /* @__PURE__ */ jsx(Slider, {
					min: MIN_CONCURRENCY$1,
					max: MAX_CONCURRENCY$1,
					value: concurrentDownloads,
					valueLabelDisplay: "auto",
					onChange: handleConcurrentDownloadsChange
				})]
			}), /* @__PURE__ */ jsxs(Grid, {
				size: {
					xs: 12,
					md: 6
				},
				children: [/* @__PURE__ */ jsx(Typography, {
					gutterBottom: true,
					children: translations.processing?.tilingZoomLabel ?? "Tile Zoom Range"
				}), /* @__PURE__ */ jsxs(Grid, {
					container: true,
					spacing: 2,
					columns: { xs: 12 },
					children: [/* @__PURE__ */ jsx(Grid, {
						size: { xs: 6 },
						children: /* @__PURE__ */ jsx(TextField, {
							type: "number",
							label: translations.processing?.minZoom ?? "Min zoom",
							id: `${fieldId}-min-zoom`,
							name: "min-zoom",
							value: minZoom,
							inputProps: {
								min: MIN_ZOOM_LEVEL,
								max: MAX_ZOOM_LEVEL,
								id: `${fieldId}-min-zoom`,
								name: "min-zoom"
							},
							onChange: handleMinZoomChange
						})
					}), /* @__PURE__ */ jsx(Grid, {
						size: { xs: 6 },
						children: /* @__PURE__ */ jsx(TextField, {
							type: "number",
							label: translations.processing?.maxZoom ?? "Max zoom",
							id: `${fieldId}-max-zoom`,
							name: "max-zoom",
							value: maxZoom,
							inputProps: {
								min: MIN_ZOOM_LEVEL,
								max: MAX_ZOOM_LEVEL,
								id: `${fieldId}-max-zoom`,
								name: "max-zoom"
							},
							onChange: handleMaxZoomChange
						})
					})]
				})]
			})]
		})]
	});
};

//#endregion
//#region src/ui/components/steps/LocationMapPreviewStep.tsx
const KNOWN_LOCATION_TYPES = [
	"area_centroid",
	"airport",
	"port",
	"railway_station",
	"interchange"
];
const resolveLocationType = (kind) => KNOWN_LOCATION_TYPES.includes(kind) ? kind : "area_centroid";
const toPreviewLocationPoint = (point) => {
	const properties = { ...point.payload ?? {} };
	if (point.gid1) properties.gid1 = point.gid1;
	if (point.gid2) properties.gid2 = point.gid2;
	if (point.source) properties.source = point.source;
	return {
		id: point.pid,
		name: point.name,
		type: resolveLocationType(point.kind),
		countryCode: point.gid0 || "UNK",
		coordinates: [point.longitude, point.latitude],
		properties
	};
};
const LocationMapPreviewStep = ({ draft: _draft, nodeId }) => {
	const { translations, locale } = useTranslation();
	const panelTranslations = translations.panel ?? {};
	const selectionTranslations = translations.selection ?? {};
	const selectionSettings = translations.selectionSettings ?? {};
	const typeLabels = translations.locationTypes ?? {};
	const typeDescriptions = selectionTranslations.typeDescriptions ?? {};
	const controlId = useId();
	const previewNodeId = nodeId ?? "preview";
	const [summary, setSummary] = useState(null);
	const [locations, setLocations] = useState([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(null);
	const serviceRef = useRef(null);
	const isMountedRef = useRef(true);
	const [activeTypeTab, setActiveTypeTab] = useState(0);
	if (!serviceRef.current) serviceRef.current = new LocationVectorTileService();
	const loadData = useCallback(async () => {
		if (!isMountedRef.current) return;
		if (typeof window === "undefined") {
			setSummary(null);
			setLocations([]);
			return;
		}
		if (!previewNodeId || previewNodeId === "preview") {
			setSummary(null);
			setLocations([]);
			return;
		}
		const resolvedNodeId = previewNodeId;
		setLoading(true);
		setError(null);
		try {
			const sessions = getEphemeralLocationDB().sessions;
			if (!sessions || typeof sessions.where !== "function") {
				setSummary(null);
				const pointRecords$1 = await listLocationPoints(resolvedNodeId);
				if (!isMountedRef.current) return;
				setLocations(pointRecords$1.map(toPreviewLocationPoint));
				return;
			}
			const records = await sessions.where("nodeId").equals(previewNodeId).toArray();
			if (!records?.length) {
				setSummary(null);
				const pointRecords$1 = await listLocationPoints(resolvedNodeId);
				if (!isMountedRef.current) return;
				setLocations(pointRecords$1.map(toPreviewLocationPoint));
				return;
			}
			const latest = records.reduce((acc, current) => {
				if (!acc) return current;
				return (current.createdAt ?? 0) > (acc.createdAt ?? 0) ? current : acc;
			}, null);
			if (!latest?.sessionId) {
				setSummary(null);
				const pointRecords$1 = await listLocationPoints(resolvedNodeId);
				if (!isMountedRef.current) return;
				setLocations(pointRecords$1.map(toPreviewLocationPoint));
				return;
			}
			const [summaryResponse, pointRecords] = await Promise.all([serviceRef.current?.getSessionSummary(latest.sessionId), listLocationPoints(resolvedNodeId)]);
			if (!isMountedRef.current) return;
			setSummary((prev) => {
				if (!summaryResponse) return prev ?? null;
				return {
					exists: summaryResponse.exists ?? false,
					layers: summaryResponse.layers ?? [],
					zoomRange: summaryResponse.zoomRange,
					tiles: summaryResponse.tiles ?? 0,
					sizeBytes: summaryResponse.sizeBytes ?? 0,
					bbox: summaryResponse.bbox,
					sessionId: latest.sessionId
				};
			});
			setLocations(pointRecords.map(toPreviewLocationPoint));
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
			setSummary(null);
			setLocations([]);
		} finally {
			if (isMountedRef.current) setLoading(false);
		}
	}, [previewNodeId]);
	const locationTypes = useMemo(() => BASE_LOCATION_TYPES.map((t) => {
		const name = typeLabels[t.id] ?? t.id;
		const descriptionKey = t.id;
		return {
			...t,
			name,
			description: typeDescriptions[descriptionKey] ?? name
		};
	}), [typeDescriptions, typeLabels]);
	const activeType = locationTypes[activeTypeTab];
	const airportSettings = selectionSettings.airport ?? {};
	const railwaySettings = selectionSettings.railway_station ?? selectionSettings.railway ?? {};
	const genericSettings = selectionSettings.generic ?? {};
	useEffect(() => () => {
		isMountedRef.current = false;
	}, []);
	useEffect(() => {
		loadData();
	}, [loadData]);
	const summaryContent = useMemo(() => {
		if (loading) return /* @__PURE__ */ jsxs(Stack, {
			direction: "row",
			alignItems: "center",
			spacing: 1,
			children: [/* @__PURE__ */ jsx(CircularProgress, { size: 16 }), /* @__PURE__ */ jsx(Typography, {
				variant: "body2",
				color: "text.secondary",
				children: translations.mapPreview?.loading ?? "Loading map preview..."
			})]
		});
		if (error) return /* @__PURE__ */ jsx(Typography, {
			variant: "body2",
			color: "error",
			children: translations.mapPreview?.error?.replace("{message}", error) ?? `Failed to load map preview: ${error}`
		});
		if (!summary || !summary.exists || summary.tiles === 0) return /* @__PURE__ */ jsx(Typography, {
			variant: "body2",
			color: "text.secondary",
			children: translations.mapPreview?.summary?.noData ?? "No vector tiles generated yet."
		});
		const zoomRange = summary.zoomRange;
		const zoomText = zoomRange ? translations.mapPreview?.summary?.zoomRange?.replace("{min}", String(zoomRange[0]))?.replace("{max}", String(zoomRange[1])) : void 0;
		const sizeBytes = summary.sizeBytes ?? 0;
		const sizeText = translations.mapPreview?.summary?.size?.replace("{size}", formatBytes(sizeBytes, locale)) ?? `Total size: ${formatBytes(sizeBytes, locale)}`;
		return /* @__PURE__ */ jsxs(Stack, {
			spacing: .5,
			children: [
				/* @__PURE__ */ jsx(Typography, {
					variant: "body2",
					children: translations.mapPreview?.summary?.tiles?.replace("{count}", String(summary.tiles)) ?? `Generated tiles: ${summary.tiles}`
				}),
				zoomText && /* @__PURE__ */ jsx(Typography, {
					variant: "body2",
					color: "text.secondary",
					children: zoomText
				}),
				/* @__PURE__ */ jsx(Typography, {
					variant: "body2",
					color: "text.secondary",
					children: sizeText
				}),
				summary.layers?.length ? /* @__PURE__ */ jsx(Typography, {
					variant: "caption",
					color: "text.secondary",
					children: translations.mapPreview?.summary?.layers?.replace("{layers}", summary.layers.join(", ")) ?? `Layers: ${summary.layers.join(", ")}`
				}) : null
			]
		});
	}, [
		error,
		loading,
		locale,
		summary,
		translations.mapPreview
	]);
	return /* @__PURE__ */ jsxs(Box, {
		display: "flex",
		flexDirection: "column",
		gap: 2,
		sx: { height: "100%" },
		children: [
			/* @__PURE__ */ jsxs(Paper, {
				elevation: 1,
				sx: { p: 3 },
				children: [
					/* @__PURE__ */ jsxs(Box, {
						display: "flex",
						alignItems: "center",
						gap: 1,
						mb: 2,
						children: [/* @__PURE__ */ jsx(SettingsIcon, {
							color: "primary",
							fontSize: "small"
						}), /* @__PURE__ */ jsx(Typography, {
							variant: "h6",
							children: selectionTranslations.settingsTitle ?? "Location type settings"
						})]
					}),
					selectionTranslations.settingsDescription && /* @__PURE__ */ jsx(Typography, {
						variant: "body2",
						color: "text.secondary",
						sx: { mb: 2 },
						children: selectionTranslations.settingsDescription
					}),
					/* @__PURE__ */ jsx(Tabs, {
						value: activeTypeTab,
						onChange: (_, value) => setActiveTypeTab(value),
						variant: "scrollable",
						scrollButtons: "auto",
						sx: {
							mb: 3,
							borderBottom: 1,
							borderColor: "divider"
						},
						children: locationTypes.map((type) => /* @__PURE__ */ jsx(Tab, { label: /* @__PURE__ */ jsxs(Box, {
							display: "flex",
							alignItems: "center",
							gap: 1,
							children: [/* @__PURE__ */ jsx("span", { children: type.icon }), /* @__PURE__ */ jsx("span", { children: type.name })]
						}) }, type.id))
					}),
					activeType && /* @__PURE__ */ jsxs(Box, { children: [
						/* @__PURE__ */ jsxs(Typography, {
							variant: "subtitle1",
							gutterBottom: true,
							children: [
								activeType.icon,
								" ",
								activeType.description
							]
						}),
						/* @__PURE__ */ jsx(Typography, {
							variant: "body2",
							color: "text.secondary",
							gutterBottom: true,
							children: genericSettings.advancedFilters ?? "Configure advanced filters for this type."
						}),
						activeType.id === "airport" && /* @__PURE__ */ jsxs(Box, {
							display: "grid",
							gridTemplateColumns: {
								xs: "1fr",
								md: "1fr 1fr"
							},
							gap: 3,
							children: [
								/* @__PURE__ */ jsx(FormControlLabel, {
									control: /* @__PURE__ */ jsx(Switch, {
										defaultChecked: true,
										inputProps: {
											id: `${controlId}-airport-include-heliports`,
											name: "airport-include-heliports"
										}
									}),
									label: airportSettings.includeHeliports ?? "Include heliports"
								}),
								/* @__PURE__ */ jsx(FormControlLabel, {
									control: /* @__PURE__ */ jsx(Switch, {
										defaultChecked: true,
										inputProps: {
											id: `${controlId}-airport-active-only`,
											name: "airport-active-only"
										}
									}),
									label: airportSettings.activeOnly ?? "Active airports only"
								}),
								/* @__PURE__ */ jsx(FormControlLabel, {
									control: /* @__PURE__ */ jsx(Switch, { inputProps: {
										id: `${controlId}-airport-commercial-only`,
										name: "airport-commercial-only"
									} }),
									label: airportSettings.commercialOnly ?? "Commercial airports only"
								}),
								/* @__PURE__ */ jsxs(Box, { children: [/* @__PURE__ */ jsx(Typography, {
									gutterBottom: true,
									children: (airportSettings.minRunwayLengthLabel ?? "Minimum runway length: {value} m").replace("{value}", "1500")
								}), /* @__PURE__ */ jsx(Slider, {
									min: 300,
									max: 5e3,
									step: 100,
									defaultValue: 1500
								})] })
							]
						}),
						activeType.id === "railway_station" && /* @__PURE__ */ jsxs(Box, {
							display: "grid",
							gridTemplateColumns: {
								xs: "1fr",
								md: "1fr 1fr"
							},
							gap: 3,
							children: [
								/* @__PURE__ */ jsx(FormControlLabel, {
									control: /* @__PURE__ */ jsx(Switch, {
										defaultChecked: true,
										inputProps: {
											id: `${controlId}-railway-include-metro`,
											name: "railway-include-metro"
										}
									}),
									label: railwaySettings.includeMetro ?? "Include metro/light rail"
								}),
								/* @__PURE__ */ jsx(FormControlLabel, {
									control: /* @__PURE__ */ jsx(Switch, { inputProps: {
										id: `${controlId}-railway-include-abandoned`,
										name: "railway-include-abandoned"
									} }),
									label: railwaySettings.includeAbandoned ?? "Include abandoned lines"
								}),
								/* @__PURE__ */ jsx(FormControlLabel, {
									control: /* @__PURE__ */ jsx(Switch, { inputProps: {
										id: `${controlId}-railway-intercity-only`,
										name: "railway-intercity-only"
									} }),
									label: railwaySettings.intercityOnly ?? "Intercity only"
								}),
								/* @__PURE__ */ jsx(TextField, {
									type: "number",
									label: railwaySettings.minPlatformsLabel ?? "Minimum platforms",
									defaultValue: 1,
									size: "small",
									id: `${controlId}-railway-min-platforms`,
									name: "railway-min-platforms",
									inputProps: {
										id: `${controlId}-railway-min-platforms`,
										name: "railway-min-platforms"
									}
								})
							]
						})
					] })
				]
			}),
			/* @__PURE__ */ jsxs(Stack, {
				direction: "row",
				alignItems: "center",
				justifyContent: "space-between",
				spacing: 2,
				children: [/* @__PURE__ */ jsx(Typography, {
					variant: "body2",
					color: "text.secondary",
					children: translations.mapPreview?.description ?? "Preview the generated points on the map."
				}), /* @__PURE__ */ jsx(Button, {
					size: "small",
					variant: "outlined",
					startIcon: /* @__PURE__ */ jsx(RefreshIcon, { fontSize: "small" }),
					onClick: loadData,
					children: panelTranslations.refresh ?? "Refresh"
				})]
			}),
			/* @__PURE__ */ jsx(Box, { children: summaryContent }),
			/* @__PURE__ */ jsx(Divider, {}),
			/* @__PURE__ */ jsx(Box, {
				flex: 1,
				minHeight: 320,
				children: /* @__PURE__ */ jsx(LocationMapPreview, {
					nodeId: previewNodeId,
					locations
				})
			})
		]
	});
};

//#endregion
//#region src/ui/components/steps/LocationBuildStep.tsx
const STAGES = [
	{
		id: "prepare",
		title: "Prepare",
		description: "Validate inputs and stage tasks."
	},
	{
		id: "fetch",
		title: "Fetch",
		description: "Download points and metadata."
	},
	{
		id: "tile",
		title: "Tile",
		description: "Generate vector tiles for selections."
	},
	{
		id: "finalize",
		title: "Finalize",
		description: "Persist results and indexes."
	}
];
const LocationBuildStep = ({ nodeId, draft }) => {
	const { t } = useTranslation();
	const [status, setStatus] = useState("idle");
	const [overallProgress, setOverallProgress] = useState(0);
	const stageProgress = useMemo(() => {
		const map = {};
		STAGES.forEach((stage, idx) => {
			map[stage.id] = Math.min(100, Math.max(0, overallProgress - idx * 10));
		});
		return map;
	}, [overallProgress]);
	const hasPrerequisites = Boolean(nodeId && draft.dataSource);
	return /* @__PURE__ */ jsxs(Box, {
		display: "flex",
		flexDirection: "column",
		gap: 3,
		children: [/* @__PURE__ */ jsxs(Box, { children: [/* @__PURE__ */ jsx(Typography, {
			variant: "h6",
			gutterBottom: true,
			children: t("build.title", "Build vector tiles")
		}), /* @__PURE__ */ jsx(Typography, {
			variant: "body2",
			color: "text.secondary",
			children: hasPrerequisites ? t("build.description", "Review progress and control the build. Use the footer Build button to start when prerequisites are met.") : t("build.prereq", "Select a data source and complete previous steps before building.")
		})] }), /* @__PURE__ */ jsx(BuildStepPanel, {
			title: t("build.title", "Build vector tiles"),
			description: t("build.panelDescription", "Review progress and control the build. Use the footer Build button to start when prerequisites are met."),
			status,
			overallProgress,
			stages: STAGES,
			stageProgress,
			onPause: () => setStatus("paused"),
			onResume: () => setStatus("running"),
			onComplete: () => {
				setStatus("completed");
				setOverallProgress(100);
			}
		})]
	});
};

//#endregion
//#region src/ui/components/steps-provider.tsx
const registry = PluginStepRegistry.getInstance();
const ensureData = (data) => ({
	...data ?? {},
	draftMetadata: data?.draftMetadata ?? {
		name: "",
		description: "",
		tags: []
	}
});
const mergeData = (current, updates) => ({
	...current,
	...updates
});
const hasSelection = (data) => {
	const matrix = data?.selectionMatrix;
	if (!Array.isArray(matrix)) return false;
	return matrix.some((row) => Array.isArray(row) && row.some(Boolean));
};
const clamp = (value, min, max) => {
	if (Number.isNaN(value)) return min;
	return Math.min(max, Math.max(min, value));
};
const MIN_CONCURRENCY = 1;
const MAX_CONCURRENCY = 16;
const DEFAULT_MIN_ZOOM = 5;
const DEFAULT_MAX_ZOOM = 12;
const LICENSE_REQUIRED = false;
const canStartLocationBatch = (data) => Boolean(data?.dataSource && hasSelection(data));
const tNs = (key, fallback) => String(i18n.t(key, {
	ns: "location-plugin",
	defaultValue: fallback
}));
const startLocationBatch = async (data, context) => {
	const draft = data ?? {};
	const nodeId = context.nodeId;
	if (!nodeId) {
		notify.error(tNs("build.errors.saveFirst", "Save changes before starting a build."));
		return;
	}
	if (!draft.dataSource) {
		notify.info(tNs("build.requiresApproval", "Provide a data source and save the node before building."));
		return;
	}
	const pointsRaw = await listLocationPoints(nodeId);
	if (!pointsRaw.length) {
		notify.info(tNs("build.noPoints", "No location points available to process."));
		return;
	}
	const points = pointsRaw.map((point) => ({
		lon: Number(point.longitude) || 0,
		lat: Number(point.latitude) || 0,
		id: point.pid,
		properties: {
			name: point.name,
			kind: point.kind,
			gid0: point.gid0,
			gid1: point.gid1,
			gid2: point.gid2,
			...point.payload ?? {}
		}
	}));
	const settings = {
		zoomMinGenerate: draft.tilesMinZoom ?? DEFAULT_MIN_ZOOM,
		zoomMaxGenerate: draft.tilesMaxZoom ?? DEFAULT_MAX_ZOOM,
		zoomMaxServe: draft.tilesMaxZoom ?? DEFAULT_MAX_ZOOM
	};
	const concurrency = clamp((draft.concurrentDownloads ?? 4) || 4, MIN_CONCURRENCY, MAX_CONCURRENCY);
	const summary = await new LocationVectorTileService().startSession(nodeId, points, settings, { concurrency });
	notify.success(tNs("build.success", "Build started (session {{sessionId}})").replace("{{sessionId}}", summary.sessionId));
};
registry.registerConfigProvider({
	nodeType: "location",
	getCreateStepConfigs() {
		return [
			{
				id: "data-source",
				label: String(i18n.t("steps.dataSource.label", {
					ns: "location-plugin",
					defaultValue: "Data Source"
				})),
				componentFactory: (p) => {
					const draft = ensureData(p.data);
					return /* @__PURE__ */ jsx(LocationDataSourceStep, {
						draft,
						onUpdate: (updates) => p.onChange(mergeData(draft, updates)),
						licenseRequired: LICENSE_REQUIRED,
						disabled: Boolean(p.disabled)
					});
				},
				validate: (data) => Boolean(data?.dataSource)
			},
			{
				id: "selection",
				label: String(i18n.t("steps.selection.label", {
					ns: "location-plugin",
					defaultValue: "Location Selection"
				})),
				componentFactory: (p) => {
					const draft = ensureData(p.data);
					return /* @__PURE__ */ jsx(LocationSelectionStep, {
						draft,
						onUpdate: (updates) => p.onChange(mergeData(draft, updates))
					});
				},
				validate: (data) => hasSelection(data)
			},
			{
				id: "batch-parameters",
				label: String(i18n.t("steps.batchParameters.label", {
					ns: "location-plugin",
					defaultValue: "Processing Settings"
				})),
				componentFactory: (p) => {
					const draft = ensureData(p.data);
					return /* @__PURE__ */ jsx(LocationBatchParametersStep, {
						draft,
						onUpdate: (updates) => p.onChange(mergeData(draft, updates))
					});
				},
				validate: () => true
			},
			{
				id: "build",
				label: String(i18n.t("steps.build.label", {
					ns: "location-plugin",
					defaultValue: "Build"
				})),
				optional: false,
				componentFactory: (p) => {
					return /* @__PURE__ */ jsx(LocationBuildStep, {
						draft: ensureData(p.data),
						nodeId: p.nodeId
					});
				},
				validate: (data) => canStartLocationBatch(data),
				capabilities: {
					canStartBatch: canStartLocationBatch,
					startBatch: (data, context) => startLocationBatch(data, context)
				}
			},
			{
				id: "map-preview",
				label: String(i18n.t("steps.mapPreview.label", {
					ns: "location-plugin",
					defaultValue: "Map Preview"
				})),
				optional: true,
				componentFactory: (p) => {
					return /* @__PURE__ */ jsx(LocationMapPreviewStep, {
						draft: ensureData(p.data),
						nodeId: p.nodeId
					});
				},
				validate: () => true
			}
		];
	},
	getEditStepConfigs(_nodeId) {
		return this.getCreateStepConfigs();
	}
});

//#endregion
//#region src/ui/index.ts
const toOptionalNodeId = (value) => typeof value === "string" ? toNodeId(value) : void 0;
const isVoidFn = (value) => typeof value === "function";
async function getDialogComponent() {
	const Adapter = () => {
		if (typeof console !== "undefined" && typeof console.warn === "function") console.warn("[location-plugin] getDialogComponent() is deprecated. Dialogs are now provided via PluginDialogHost.");
		return null;
	};
	return Adapter;
}
async function getPanelComponent() {
	const { LocationPanel } = await import("../LocationPanel.js");
	const Adapter = (props) => {
		const rawNodeId = props["nodeId"];
		const nodeId = toOptionalNodeId(rawNodeId);
		if (!nodeId) throw new Error("LocationPanel requires `nodeId` string prop.");
		const rawOnEdit = props["onEdit"];
		const onEdit = isVoidFn(rawOnEdit) ? rawOnEdit : void 0;
		return React.createElement(LocationPanel, {
			nodeId,
			onEdit
		});
	};
	return Adapter;
}

//#endregion
export { getDialogComponent, getPanelComponent };
//# sourceMappingURL=index.js.map