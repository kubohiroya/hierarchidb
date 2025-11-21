import "../locationEntitiesDB2.js";
import "../normalizers.js";
import { l as listLocationPoints, t as LocationVectorTileService } from "../LocationVectorTileService.js";
import "../env.js";
import { i as useTranslation, r as translations, t as formatBytes } from "../i18n.js";
import { n as LocationSelectionStep, t as LocationMapPreview } from "../LocationMapPreview.js";
import { r as getEphemeralLocationDB } from "../EphemeralLocationDB2.js";
import "../RuntimeWorkerClient.js";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Box, Button, CircularProgress, Divider, Grid, Slider, Stack, TextField, Typography } from "@mui/material";
import { jsx, jsxs } from "react/jsx-runtime";
import { toNodeId } from "@hierarchidb/common-types";
import { PluginStepRegistry } from "@hierarchidb/plugin-base";
import { BasicInfoStep } from "@hierarchidb/ui-plugin-basic-info";
import { DataSourceSelector } from "@hierarchidb/ui-datasource";
import { LicenseAgreementStep } from "@hierarchidb/ui-license";
import RefreshIcon from "@mui/icons-material/Refresh";
import { notify } from "@hierarchidb/components";

//#region src/common/components/steps/LocationDataSourceStep.tsx
const ORDERED_DATA_SOURCES = [
	"openstreetmap",
	"overpass",
	"geonames",
	"wikidata",
	"custom",
	"manual"
];
const LocationDataSourceStep = ({ workingCopy, onUpdate }) => {
	const { translations: translations$1 } = useTranslation();
	const value = useMemo(() => workingCopy.draft.dataSource ?? "openstreetmap", [workingCopy.draft.dataSource]);
	const options = useMemo(() => ORDERED_DATA_SOURCES.map((sourceId) => ({
		id: sourceId,
		name: translations$1.dataSources?.[sourceId] ?? sourceId,
		description: translations$1.dataSourceDescriptions?.[sourceId] ?? translations$1.dialog.datasetDescription
	})), [
		translations$1.dataSources,
		translations$1.dataSourceDescriptions,
		translations$1.dialog.datasetDescription
	]);
	const handleChange = (next) => {
		onUpdate({ draft: {
			dataSource: next,
			licenseAgreement: false,
			licenseAgreedAt: void 0
		} });
	};
	return /* @__PURE__ */ jsxs(Box, {
		display: "flex",
		flexDirection: "column",
		gap: 3,
		children: [/* @__PURE__ */ jsx(Typography, {
			variant: "body2",
			color: "text.secondary",
			children: translations$1.dialog.dataSourceDescription ?? translations$1.dialog.datasetDescription
		}), /* @__PURE__ */ jsx(DataSourceSelector, {
			options,
			value,
			onChange: handleChange
		})]
	});
};

//#endregion
//#region src/common/datasources/LocationDataSourceDefinitions.ts
/**
* OpenStreetMap (Overpass API) data source definition
*/
const OpenStreetMapOverpassDataSource = {
	id: "openstreetmap-overpass",
	name: "OpenStreetMap (Overpass API)",
	baseUrl: "https://overpass-api.de/",
	license: "ODbL 1.0",
	licenseUrl: "https://opendatacommons.org/licenses/odbl/",
	attribution: "© OpenStreetMap contributors",
	updateFrequency: "realtime",
	supportedTypes: ["all"],
	availableAttributes: [
		"name",
		"name:en",
		"name:ja",
		"lat",
		"lon",
		"amenity",
		"aeroway",
		"railway",
		"highway",
		"place"
	],
	endpoints: { interpreter: "https://overpass-api.de/api/interpreter" },
	defaultOptions: {
		format: "json",
		timeout: 25
	}
};
/**
* OpenStreetMap (Nominatim) data source definition
*/
const OpenStreetMapNominatimDataSource = {
	id: "openstreetmap-nominatim",
	name: "OpenStreetMap (Nominatim)",
	baseUrl: "https://nominatim.openstreetmap.org/",
	license: "ODbL 1.0",
	licenseUrl: "https://opendatacommons.org/licenses/odbl/",
	attribution: "© OpenStreetMap contributors",
	updateFrequency: "realtime",
	supportedTypes: ["all"],
	availableAttributes: [
		"display_name",
		"lat",
		"lon",
		"place_id",
		"osm_type",
		"osm_id",
		"class",
		"type",
		"importance",
		"boundingbox"
	],
	endpoints: { search: "https://nominatim.openstreetmap.org/search" },
	defaultOptions: {
		format: "json",
		limit: 50,
		addressdetails: 1
	}
};
/**
* GeoNames data source definition
*/
const GeoNamesDataSource = {
	id: "geonames",
	name: "GeoNames",
	baseUrl: "https://www.geonames.org/",
	license: "CC BY 4.0",
	licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
	attribution: "Data provided by GeoNames",
	updateFrequency: "daily",
	supportedTypes: ["all"],
	availableAttributes: [
		"name",
		"asciiname",
		"alternatenames",
		"latitude",
		"longitude",
		"feature_class",
		"feature_code",
		"country_code",
		"admin1_code",
		"population",
		"elevation"
	],
	endpoints: {
		api: "http://api.geonames.org/",
		search: "http://api.geonames.org/searchJSON"
	},
	defaultOptions: {
		maxRows: 100,
		style: "full"
	}
};
/**
* Natural Earth data source definition
*/
const NaturalEarthDataSource = {
	id: "natural-earth",
	name: "Natural Earth",
	baseUrl: "https://www.naturalearthdata.com/",
	license: "Public Domain",
	licenseUrl: "https://www.naturalearthdata.com/about/terms-of-use/",
	attribution: "Map data by Natural Earth",
	updateFrequency: "irregular",
	supportedTypes: [
		"administrative",
		"airport",
		"port"
	],
	availableAttributes: [
		"name",
		"nameascii",
		"latitude",
		"longitude",
		"scalerank",
		"featurecla",
		"adm0name",
		"adm1name"
	],
	endpoints: { download: "https://www.naturalearthdata.com/http//www.naturalearthdata.com/download/" }
};
/**
* OurAirports data source definition
*/
const OurAirportsDataSource = {
	id: "ourairports",
	name: "OurAirports",
	baseUrl: "https://ourairports.com/data/",
	license: "Public Domain",
	licenseUrl: "https://ourairports.com/data/",
	attribution: "Data courtesy of OurAirports.com",
	updateFrequency: "weekly",
	supportedTypes: ["airport"],
	availableAttributes: [
		"ident",
		"name",
		"latitude_deg",
		"longitude_deg",
		"elevation_ft",
		"type",
		"municipality",
		"iso_country",
		"iso_region"
	],
	endpoints: { airports: "https://davidmegginson.github.io/ourairports-data/airports.csv" }
};
/**
* OpenFlights data source definition
*/
const OpenFlightsDataSource = {
	id: "openflights",
	name: "OpenFlights",
	baseUrl: "https://openflights.org/data.html",
	license: "ODbL 1.0",
	licenseUrl: "https://opendatacommons.org/licenses/odbl/",
	attribution: "OpenFlights project",
	updateFrequency: "irregular",
	supportedTypes: ["airport", "station"],
	availableAttributes: [
		"name",
		"city",
		"country",
		"IATA",
		"ICAO",
		"latitude",
		"longitude",
		"altitude",
		"timezone",
		"DST"
	],
	endpoints: { airports: "https://raw.githubusercontent.com/jpatokal/openflights/master/data/airports.dat" }
};
/**
* World Port Index data source definition
*/
const WorldPortIndexDataSource = {
	id: "world-port-index",
	name: "World Port Index",
	baseUrl: "https://msi.nga.mil/Publications/WPI",
	license: "Public Domain",
	licenseUrl: "https://msi.nga.mil/Publications/WPI",
	attribution: "World Port Index (U.S. National Geospatial-Intelligence Agency)",
	updateFrequency: "yearly",
	supportedTypes: ["port"],
	availableAttributes: [
		"port_name",
		"country",
		"latitude",
		"longitude",
		"harbor_size",
		"harbor_type",
		"shelter",
		"tide_range"
	]
};
/**
* Collection of all available location data sources
*/
const LocationDataSources = {
	"openstreetmap-overpass": OpenStreetMapOverpassDataSource,
	"openstreetmap-nominatim": OpenStreetMapNominatimDataSource,
	"geonames": GeoNamesDataSource,
	"natural-earth": NaturalEarthDataSource,
	"ourairports": OurAirportsDataSource,
	"openflights": OpenFlightsDataSource,
	"world-port-index": WorldPortIndexDataSource
};
/**
* Get data source by ID
*/
function getLocationDataSource(id) {
	return LocationDataSources[id];
}

//#endregion
//#region src/common/components/steps/LocationLicenseStep.tsx
const LocationLicenseStep = ({ workingCopy, onUpdate }) => {
	const { translations: translations$1 } = useTranslation();
	const dataSource = getLocationDataSource(workingCopy.draft.dataSource ?? "openstreetmap");
	if (!dataSource) return /* @__PURE__ */ jsx(Box, { children: /* @__PURE__ */ jsx(Typography, {
		variant: "body2",
		color: "text.secondary",
		children: translations$1.dialog.selectDataSourceFirst ?? "Please select a data source first."
	}) });
	return /* @__PURE__ */ jsx(LicenseAgreementStep, {
		sourceName: dataSource.name,
		details: {
			licenseName: dataSource.license,
			attribution: dataSource.attribution,
			url: dataSource.licenseUrl
		},
		state: {
			agreed: Boolean(workingCopy.draft.licenseAgreement),
			agreedAt: workingCopy.draft.licenseAgreedAt ? new Date(workingCopy.draft.licenseAgreedAt).toISOString() : void 0
		},
		onAgree: () => {
			onUpdate({ draft: {
				licenseAgreement: true,
				licenseAgreedAt: Date.now()
			} });
		}
	});
};

//#endregion
//#region src/common/components/steps/LocationBatchParametersStep.tsx
const MIN_CONCURRENCY$1 = 1;
const MAX_CONCURRENCY$1 = 16;
const MIN_ZOOM_LEVEL = 0;
const MAX_ZOOM_LEVEL = 22;
function clamp$1(value, min, max) {
	if (Number.isNaN(value)) return min;
	return Math.min(max, Math.max(min, value));
}
const LocationBatchParametersStep = ({ workingCopy, onUpdate }) => {
	const { translations: translations$1 } = useTranslation();
	const draft = workingCopy.draft ?? {};
	const rawConcurrent = draft.concurrentDownloads ?? 2;
	const concurrentDownloads = clamp$1(Number(rawConcurrent) || 2, MIN_CONCURRENCY$1, MAX_CONCURRENCY$1);
	const rawMinZoom = draft.tilesMinZoom ?? 4;
	const rawMaxZoom = draft.tilesMaxZoom ?? 12;
	const minZoom = clamp$1(Number(rawMinZoom) || 4, MIN_ZOOM_LEVEL, MAX_ZOOM_LEVEL);
	const maxZoom = clamp$1(Number(rawMaxZoom) || 12, MIN_ZOOM_LEVEL, MAX_ZOOM_LEVEL);
	const handleConcurrentDownloadsChange = (_, value) => {
		onUpdate({ draft: { concurrentDownloads: clamp$1(Array.isArray(value) ? value[0] ?? concurrentDownloads : value ?? concurrentDownloads, MIN_CONCURRENCY$1, MAX_CONCURRENCY$1) } });
	};
	const handleMinZoomChange = (event) => {
		const nextMin = clamp$1(Number(event.target.value), MIN_ZOOM_LEVEL, MAX_ZOOM_LEVEL);
		onUpdate({ draft: {
			tilesMinZoom: nextMin,
			tilesMaxZoom: Math.max(nextMin, maxZoom)
		} });
	};
	const handleMaxZoomChange = (event) => {
		const nextMax = clamp$1(Number(event.target.value), MIN_ZOOM_LEVEL, MAX_ZOOM_LEVEL);
		onUpdate({ draft: {
			tilesMinZoom: Math.min(nextMax, minZoom),
			tilesMaxZoom: nextMax
		} });
	};
	return /* @__PURE__ */ jsxs(Box, {
		display: "flex",
		flexDirection: "column",
		gap: 3,
		children: [/* @__PURE__ */ jsx(Typography, {
			variant: "body2",
			color: "text.secondary",
			children: translations$1.processing?.description ?? "Configure download and tiling parameters for batch processing."
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
						translations$1.processing?.concurrentDownloadsLabel ?? "Concurrent Downloads",
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
					children: translations$1.processing?.tilingZoomLabel ?? "Tile Zoom Range"
				}), /* @__PURE__ */ jsxs(Grid, {
					container: true,
					spacing: 2,
					columns: { xs: 12 },
					children: [/* @__PURE__ */ jsx(Grid, {
						size: { xs: 6 },
						children: /* @__PURE__ */ jsx(TextField, {
							type: "number",
							label: translations$1.processing?.minZoom ?? "Min zoom",
							value: minZoom,
							inputProps: {
								min: MIN_ZOOM_LEVEL,
								max: MAX_ZOOM_LEVEL
							},
							onChange: handleMinZoomChange
						})
					}), /* @__PURE__ */ jsx(Grid, {
						size: { xs: 6 },
						children: /* @__PURE__ */ jsx(TextField, {
							type: "number",
							label: translations$1.processing?.maxZoom ?? "Max zoom",
							value: maxZoom,
							inputProps: {
								min: MIN_ZOOM_LEVEL,
								max: MAX_ZOOM_LEVEL
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
//#region src/common/components/steps/LocationMapPreviewStep.tsx
const KNOWN_LOCATION_TYPES = [
	"airport",
	"railway_station",
	"bus_stop",
	"port",
	"parking",
	"government",
	"religious",
	"post_office",
	"fire_station",
	"police",
	"hospital",
	"clinic",
	"pharmacy",
	"school",
	"university",
	"library",
	"shopping_mall",
	"supermarket",
	"restaurant",
	"hotel",
	"bank",
	"museum",
	"theater",
	"monument",
	"park",
	"stadium",
	"beach",
	"mountain",
	"lake",
	"river",
	"interchange",
	"tourist_attraction",
	"custom"
];
const resolveLocationType = (kind) => KNOWN_LOCATION_TYPES.includes(kind) ? kind : "custom";
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
const LocationMapPreviewStep = ({ workingCopy }) => {
	const { translations: translations$1, locale } = useTranslation();
	const nodeId = workingCopy?.treeNodeId ?? workingCopy?.nodeId ?? "preview";
	const [summary, setSummary] = useState(null);
	const [locations, setLocations] = useState([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(null);
	const serviceRef = useRef(null);
	const isMountedRef = useRef(true);
	if (!serviceRef.current) serviceRef.current = new LocationVectorTileService();
	const loadData = useCallback(async () => {
		if (!isMountedRef.current) return;
		if (typeof window === "undefined") {
			setSummary(null);
			setLocations([]);
			return;
		}
		if (!nodeId || nodeId === "preview") {
			setSummary(null);
			setLocations([]);
			return;
		}
		const resolvedNodeId = nodeId;
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
			const records = await sessions.where("nodeId").equals(nodeId).toArray();
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
			const [summaryResponse, pointRecords] = await Promise.all([serviceRef.current.getSessionSummary(latest.sessionId), listLocationPoints(resolvedNodeId)]);
			if (!isMountedRef.current) return;
			setSummary({
				...summaryResponse,
				sessionId: latest.sessionId
			});
			setLocations(pointRecords.map(toPreviewLocationPoint));
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
			setSummary(null);
			setLocations([]);
		} finally {
			if (isMountedRef.current) setLoading(false);
		}
	}, [nodeId]);
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
				children: translations$1.mapPreview?.loading ?? "Loading map preview..."
			})]
		});
		if (error) return /* @__PURE__ */ jsx(Typography, {
			variant: "body2",
			color: "error",
			children: translations$1.mapPreview?.error?.replace("{message}", error) ?? `Failed to load map preview: ${error}`
		});
		if (!summary || !summary.exists || summary.tiles === 0) return /* @__PURE__ */ jsx(Typography, {
			variant: "body2",
			color: "text.secondary",
			children: translations$1.mapPreview?.summary?.noData ?? "No vector tiles generated yet."
		});
		const zoomRange = summary.zoomRange;
		const zoomText = zoomRange ? translations$1.mapPreview?.summary?.zoomRange?.replace("{min}", String(zoomRange[0]))?.replace("{max}", String(zoomRange[1])) : void 0;
		const sizeBytes = summary.sizeBytes ?? 0;
		const sizeText = translations$1.mapPreview?.summary?.size?.replace("{size}", formatBytes(sizeBytes, locale)) ?? `Total size: ${formatBytes(sizeBytes, locale)}`;
		return /* @__PURE__ */ jsxs(Stack, {
			spacing: .5,
			children: [
				/* @__PURE__ */ jsx(Typography, {
					variant: "body2",
					children: translations$1.mapPreview?.summary?.tiles?.replace("{count}", String(summary.tiles)) ?? `Generated tiles: ${summary.tiles}`
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
					children: translations$1.mapPreview?.summary?.layers?.replace("{layers}", summary.layers.join(", ")) ?? `Layers: ${summary.layers.join(", ")}`
				}) : null
			]
		});
	}, [
		error,
		loading,
		locale,
		summary,
		translations$1.mapPreview
	]);
	return /* @__PURE__ */ jsxs(Box, {
		display: "flex",
		flexDirection: "column",
		gap: 2,
		sx: { height: "100%" },
		children: [
			/* @__PURE__ */ jsxs(Stack, {
				direction: "row",
				alignItems: "center",
				justifyContent: "space-between",
				spacing: 2,
				children: [/* @__PURE__ */ jsx(Typography, {
					variant: "body2",
					color: "text.secondary",
					children: translations$1.mapPreview?.description ?? "Preview the generated points on the map."
				}), /* @__PURE__ */ jsx(Button, {
					size: "small",
					variant: "outlined",
					startIcon: /* @__PURE__ */ jsx(RefreshIcon, { fontSize: "small" }),
					onClick: loadData,
					children: translations$1.panel.refresh
				})]
			}),
			/* @__PURE__ */ jsx(Box, { children: summaryContent }),
			/* @__PURE__ */ jsx(Divider, {}),
			/* @__PURE__ */ jsx(Box, {
				flex: 1,
				minHeight: 320,
				children: /* @__PURE__ */ jsx(LocationMapPreview, {
					nodeId,
					locations
				})
			})
		]
	});
};

//#endregion
//#region src/ui/components/steps/LocationBuildStep.tsx
const clamp = (value, min, max) => {
	if (Number.isNaN(value)) return min;
	return Math.min(max, Math.max(min, value));
};
const MIN_CONCURRENCY = 1;
const MAX_CONCURRENCY = 16;
const DEFAULT_MIN_ZOOM = 5;
const DEFAULT_MAX_ZOOM = 12;
const LocationBuildStep = ({ nodeId, workingCopy }) => {
	const { translations: translations$1 } = useTranslation();
	const [isBuilding, setIsBuilding] = useState(false);
	const serviceRef = useRef(null);
	const draft = useMemo(() => workingCopy.draft ?? {}, [workingCopy.draft]);
	const canBuild = Boolean(nodeId && draft.licenseAgreement && draft.dataSource && workingCopy.treeNodeId);
	const concurrency = useMemo(() => {
		return clamp(Number(draft.concurrentDownloads ?? 4) || 4, MIN_CONCURRENCY, MAX_CONCURRENCY);
	}, [draft.concurrentDownloads]);
	const zoomRange = useMemo(() => {
		const minZoom = clamp(Number(draft.tilesMinZoom ?? DEFAULT_MIN_ZOOM), 0, 24);
		return {
			minZoom,
			maxZoom: clamp(Number(draft.tilesMaxZoom ?? DEFAULT_MAX_ZOOM), minZoom, 24)
		};
	}, [draft]);
	const getService = () => {
		if (!serviceRef.current) serviceRef.current = new LocationVectorTileService();
		return serviceRef.current;
	};
	const handleBuild = useCallback(async () => {
		if (!nodeId) return;
		setIsBuilding(true);
		try {
			const pointsRaw = await listLocationPoints(nodeId);
			if (!pointsRaw.length) {
				notify.info(translations$1.build?.noPoints ?? "No location points available to process.");
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
				zoomMinGenerate: zoomRange.minZoom,
				zoomMaxGenerate: zoomRange.maxZoom,
				zoomMaxServe: zoomRange.maxZoom
			};
			const summary = await getService().startSession(nodeId, points, settings, { concurrency });
			notify.success(translations$1.build?.success?.replace?.("{sessionId}", summary.sessionId) ?? `Build started (session ${summary.sessionId})`);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			notify.error(translations$1.build?.error?.replace?.("{message}", message) ?? `Build failed: ${message}`);
		} finally {
			setIsBuilding(false);
		}
	}, [
		concurrency,
		nodeId,
		translations$1,
		zoomRange.maxZoom,
		zoomRange.minZoom
	]);
	return /* @__PURE__ */ jsxs(Box, {
		display: "flex",
		flexDirection: "column",
		gap: 3,
		children: [
			!canBuild && /* @__PURE__ */ jsx(Alert, {
				severity: "info",
				children: translations$1.build?.requiresApproval ?? "Provide a data source, accept license terms, and save the node before building."
			}),
			/* @__PURE__ */ jsxs(Box, { children: [/* @__PURE__ */ jsx(Typography, {
				variant: "h6",
				gutterBottom: true,
				children: translations$1.basicInfo?.title ?? "Build vector tiles"
			}), /* @__PURE__ */ jsx(Typography, {
				variant: "body2",
				color: "text.secondary",
				children: translations$1.basicInfo?.descriptionHelperText ?? "Prepare the selected locations and start the batch pipeline to generate the basemap layers."
			})] }),
			/* @__PURE__ */ jsx(Box, {
				display: "flex",
				gap: 2,
				flexWrap: "wrap",
				children: /* @__PURE__ */ jsx(Button, {
					variant: "contained",
					color: "primary",
					onClick: handleBuild,
					disabled: !canBuild || isBuilding,
					children: isBuilding ? translations$1.build?.inProgress ?? "Building…" : translations$1.build?.actionLabel ?? "Build"
				})
			})
		]
	});
};

//#endregion
//#region src/ui/components/steps-provider.tsx
const registry = PluginStepRegistry.getInstance();
const ensureWorkingCopy = (data) => {
	if (data) return {
		...data,
		treeNodeId: data.treeNodeId ?? "",
		draft: { ...data.draft ?? {} },
		createdAt: data.createdAt ?? Date.now(),
		updatedAt: data.updatedAt ?? Date.now(),
		tags: data.tags ?? []
	};
	return {
		treeNodeId: "",
		draft: {},
		createdAt: Date.now(),
		updatedAt: Date.now(),
		tags: []
	};
};
const mergeWorkingCopy = (current, updates) => ({
	...current,
	...updates,
	draft: {
		...current.draft ?? {},
		...updates.draft ?? {}
	}
});
const hasSelection = (data) => {
	const matrix = data?.draft?.selectionMatrix;
	if (!Array.isArray(matrix)) return false;
	return matrix.some((row) => Array.isArray(row) && row.some(Boolean));
};
registry.registerConfigProvider({
	nodeType: "location",
	getCreateStepConfigs() {
		const t = translations;
		return [
			{
				id: "basic-info",
				label: t.en.basicInfo.title,
				componentFactory: (p) => {
					const workingCopy = ensureWorkingCopy(p.data);
					return /* @__PURE__ */ jsx(BasicInfoStep, {
						name: workingCopy.draft?.name ?? "",
						description: workingCopy.draft?.description ?? "",
						tags: workingCopy.tags ?? [],
						mode: p.mode,
						tagSuggestions: t.en.basicInfo.tagSuggestions ?? [],
						validate: ({ name }) => name.trim().length ? null : t.en.errors.nameRequired,
						onChange: (value) => {
							p.onChange(mergeWorkingCopy(workingCopy, {
								draft: {
									...workingCopy.draft,
									name: value.name,
									description: value.description
								},
								tags: value.tags
							}));
						}
					});
				},
				validate: (data) => Boolean(data?.draft?.name?.trim())
			},
			{
				id: "data-source",
				label: t.en.dialog.dataSourceLabel,
				componentFactory: (p) => {
					const workingCopy = ensureWorkingCopy(p.data);
					return /* @__PURE__ */ jsx(LocationDataSourceStep, {
						workingCopy,
						onUpdate: (updates) => p.onChange(mergeWorkingCopy(workingCopy, updates))
					});
				},
				validate: (data) => Boolean(data?.draft?.dataSource)
			},
			{
				id: "license",
				label: t.en.dialog.licenseAgreementLabel,
				componentFactory: (p) => {
					const workingCopy = ensureWorkingCopy(p.data);
					return /* @__PURE__ */ jsx(LocationLicenseStep, {
						workingCopy,
						onUpdate: (updates) => p.onChange(mergeWorkingCopy(workingCopy, updates))
					});
				},
				validate: (data) => Boolean(data?.draft?.licenseAgreement)
			},
			{
				id: "selection",
				label: t.en.selection.title,
				componentFactory: (p) => {
					const workingCopy = ensureWorkingCopy(p.data);
					return /* @__PURE__ */ jsx(LocationSelectionStep, {
						workingCopy,
						onUpdate: (updates) => p.onChange(mergeWorkingCopy(workingCopy, updates))
					});
				},
				validate: (data) => hasSelection(data)
			},
			{
				id: "batch-parameters",
				label: t.en.panel.processingSettings,
				componentFactory: (p) => {
					const workingCopy = ensureWorkingCopy(p.data);
					return /* @__PURE__ */ jsx(LocationBatchParametersStep, {
						workingCopy,
						onUpdate: (updates) => p.onChange(mergeWorkingCopy(workingCopy, updates))
					});
				},
				validate: () => true
			},
			{
				id: "map-preview",
				label: t.en.mapPreview?.title ?? "Map Preview",
				optional: true,
				componentFactory: (p) => {
					return /* @__PURE__ */ jsx(LocationMapPreviewStep, { workingCopy: ensureWorkingCopy(p.data) });
				},
				validate: () => true
			},
			{
				id: "build",
				label: t.en.build?.actionLabel ?? "Build",
				optional: true,
				componentFactory: (p) => {
					const workingCopy = ensureWorkingCopy(p.data);
					return /* @__PURE__ */ jsx(LocationBuildStep, {
						nodeId: p.nodeId,
						workingCopy
					});
				},
				capabilities: { canStartBatch: (data) => Boolean(data?.treeNodeId && data?.draft?.dataSource && data?.draft?.licenseAgreement) },
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