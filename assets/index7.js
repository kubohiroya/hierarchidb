import { n as i18n, t as useTranslation } from "../i18n.js";
import { createElement, useCallback, useEffect, useId, useMemo, useState } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { PluginStepRegistry } from "@hierarchidb/plugin-base";
import { Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Divider, FormControl, FormControlLabel, InputLabel, LinearProgress, MenuItem, Select, Slider, Stack, Switch, TextField, Typography } from "@mui/material";
import { Add, MyLocation, PlayArrow, Remove, Settings, Stop } from "@mui/icons-material";
import { BuildStepPanel, notify } from "@hierarchidb/components";

//#region src/ui/i18n.ts
const localeModules = import.meta.glob("./locales/*.json", { eager: true });
Object.entries(localeModules).forEach(([path, mod]) => {
	const lng = path.match(/locales\/([a-z-]+)\.json$/i)?.[1];
	if (!lng) return;
	const resources = mod.default ?? mod;
	if (!resources) return;
	i18n.addResourceBundle(lng, "route-plugin", resources, true, true);
});

//#endregion
//#region src/common/utils/draft.ts
function toRouteUpdaterPayload(routeDraft, effectiveNodeId) {
	if (!routeDraft) return {
		treeNodeId: effectiveNodeId,
		draftMetadata: {
			name: "",
			description: "",
			tags: []
		},
		draftData: {}
	};
	const baseMeta = routeDraft.draftMetadata ?? {};
	const nextDraftMetadata = {
		name: typeof baseMeta.name === "string" ? baseMeta.name : "",
		description: typeof baseMeta.description === "string" ? baseMeta.description : "",
		tags: Array.isArray(baseMeta.tags) ? baseMeta.tags.map(String) : []
	};
	const nextDraftData = routeDraft.draftData ?? {};
	return {
		...routeDraft,
		treeNodeId: routeDraft.treeNodeId ?? effectiveNodeId,
		draftMetadata: nextDraftMetadata,
		draftData: nextDraftData
	};
}
function getRouteUpdaterPayload(draft) {
	if (draft && typeof draft === "object" && "draftData" in draft && draft.draftData) return draft.draftData;
	return draft;
}

//#endregion
//#region src/ui/components/steps/RouteSelectionStep.tsx
const RouteSelectionStep = ({ draft: draftProp, onUpdate, onValidationChange }) => {
	const { t } = useTranslation();
	const draft = useMemo(() => getRouteUpdaterPayload(draftProp), [draftProp]);
	const emitUpdate = useCallback((updates) => {
		onUpdate({ ...updates });
	}, [onUpdate]);
	const [waypoints, setWaypoints] = useState([{
		id: "1",
		name: t("selection.startPoint", "Start Point")
	}, {
		id: "2",
		name: t("selection.endPoint", "End Point")
	}]);
	const [isCalculating, setIsCalculating] = useState(false);
	const handleAddWaypoint = () => {
		const newWaypoint = {
			id: `waypoint-${Date.now()}`,
			name: t("selection.waypoint", "Waypoint") + ` ${waypoints.length - 1}`
		};
		const newWaypoints = [...waypoints];
		newWaypoints.splice(-1, 0, newWaypoint);
		setWaypoints(newWaypoints);
	};
	const handleRemoveWaypoint = (waypointId) => {
		if (waypoints.length <= 2) return;
		setWaypoints(waypoints.filter((wp) => wp.id !== waypointId));
	};
	const handleWaypointChange = (waypointId, field, value) => {
		const newWaypoints = waypoints.map((wp) => wp.id === waypointId ? {
			...wp,
			[field]: value
		} : wp);
		setWaypoints(newWaypoints);
		onValidationChange(Boolean(newWaypoints[0]?.name?.trim()) && Boolean(newWaypoints[newWaypoints.length - 1]?.name?.trim()));
	};
	const handleGetCurrentLocation = async (waypointId) => {
		if (!navigator.geolocation) {
			alert(t("errors.geolocationNotSupported", "Geolocation is not supported"));
			return;
		}
		navigator.geolocation.getCurrentPosition((position) => {
			const { latitude, longitude } = position.coords;
			setWaypoints(waypoints.map((wp) => wp.id === waypointId ? {
				...wp,
				coordinates: [longitude, latitude]
			} : wp));
		}, (error) => {
			console.error("Geolocation error:", error);
			alert(t("errors.geolocationError", "Failed to get current location"));
		});
	};
	const handleCalculateRoute = async () => {
		setIsCalculating(true);
		try {
			await new Promise((resolve) => setTimeout(resolve, 2e3));
			emitUpdate({ waypoints: waypoints.map((wp) => Array.isArray(wp.coordinates) ? {
				coordinates: wp.coordinates,
				name: wp.name
			} : null).filter((wp) => wp !== null && Array.isArray(wp.coordinates)) });
			onValidationChange(true);
		} catch (error) {
			console.error("Route calculation error:", error);
		} finally {
			setIsCalculating(false);
		}
	};
	return /* @__PURE__ */ jsxs(Box, {
		sx: { width: "100%" },
		children: [
			/* @__PURE__ */ jsx(Typography, {
				variant: "h6",
				gutterBottom: true,
				children: t("selection.title", "Route Selection")
			}),
			/* @__PURE__ */ jsx(Typography, {
				variant: "body2",
				color: "text.secondary",
				sx: { mb: 3 },
				children: t("selection.description", "Configure waypoints and route options")
			}),
			/* @__PURE__ */ jsxs(Box, {
				sx: { mb: 3 },
				children: [
					/* @__PURE__ */ jsx(Typography, {
						variant: "subtitle1",
						gutterBottom: true,
						children: t("selection.waypoints", "Waypoints")
					}),
					/* @__PURE__ */ jsx(Stack, {
						spacing: 2,
						children: waypoints.map((waypoint, index) => /* @__PURE__ */ jsxs(Box, {
							sx: {
								display: "flex",
								gap: 2,
								alignItems: "center"
							},
							children: [
								/* @__PURE__ */ jsx(Chip, {
									label: index === 0 ? "S" : index === waypoints.length - 1 ? "E" : `${index}`,
									color: index === 0 ? "success" : index === waypoints.length - 1 ? "error" : "primary",
									size: "small",
									sx: { minWidth: 32 }
								}),
								/* @__PURE__ */ jsx(TextField, {
									fullWidth: true,
									size: "small",
									value: waypoint.name,
									onChange: (e) => handleWaypointChange(waypoint.id, "name", e.target.value),
									placeholder: index === 0 ? t("selection.startPlaceholder", "Enter start location") : index === waypoints.length - 1 ? t("selection.endPlaceholder", "Enter destination") : t("selection.waypointPlaceholder", "Enter waypoint location")
								}),
								/* @__PURE__ */ jsx(Button, {
									size: "small",
									variant: "outlined",
									onClick: () => handleGetCurrentLocation(waypoint.id),
									startIcon: /* @__PURE__ */ jsx(MyLocation, {}),
									sx: { minWidth: 120 },
									children: t("selection.currentLocation", "Current")
								}),
								waypoints.length > 2 && index !== 0 && index !== waypoints.length - 1 && /* @__PURE__ */ jsx(Button, {
									size: "small",
									color: "error",
									onClick: () => handleRemoveWaypoint(waypoint.id),
									sx: { minWidth: 40 },
									children: /* @__PURE__ */ jsx(Remove, {})
								})
							]
						}, waypoint.id))
					}),
					/* @__PURE__ */ jsx(Box, {
						sx: {
							mt: 2,
							display: "flex",
							justifyContent: "center"
						},
						children: /* @__PURE__ */ jsx(Button, {
							startIcon: /* @__PURE__ */ jsx(Add, {}),
							onClick: handleAddWaypoint,
							disabled: waypoints.length >= 10,
							children: t("selection.addWaypoint", "Add Waypoint")
						})
					})
				]
			}),
			/* @__PURE__ */ jsx(Box, {
				sx: {
					display: "flex",
					justifyContent: "center",
					mb: 2
				},
				children: /* @__PURE__ */ jsx(Button, {
					variant: "contained",
					onClick: handleCalculateRoute,
					disabled: isCalculating || !waypoints[0]?.name || !waypoints[waypoints.length - 1]?.name,
					startIcon: isCalculating ? /* @__PURE__ */ jsx(CircularProgress, { size: 20 }) : null,
					children: isCalculating ? t("selection.calculating", "Calculating...") : t("selection.calculateRoute", "Calculate Route")
				})
			}),
			Array.isArray(draft.waypoints) && draft.waypoints.length > 0 && /* @__PURE__ */ jsx(Alert, {
				severity: "success",
				sx: { mt: 2 },
				children: t("selection.routeCalculated", "Route calculated successfully!")
			})
		]
	});
};

//#endregion
//#region src/ui/components/steps/RouteProcessingStep.tsx
const RouteProcessingStep = ({ draft: draftProp, onUpdate, onValidationChange }) => {
	const { t } = useTranslation();
	const draft = useMemo(() => getRouteUpdaterPayload(draftProp), [draftProp]);
	const resolvedCategory = draft.category ?? "transportation";
	const [category, setCategory] = useState(resolvedCategory);
	useEffect(() => {
		setCategory(resolvedCategory);
	}, [resolvedCategory]);
	const emitUpdate = useCallback((updates) => {
		onUpdate({ ...updates });
	}, [onUpdate]);
	const [simplificationLevel, setSimplificationLevel] = useState(3);
	const [generateElevation, setGenerateElevation] = useState(true);
	const [generateTurns, setGenerateturns] = useState(true);
	const [maxFileSize, setMaxFileSize] = useState(50);
	const [processingStatus, setProcessingStatus] = useState({
		isProcessing: false,
		progress: 0,
		stage: "",
		message: ""
	});
	const handleCategoryChange = (newCategory) => {
		setCategory(newCategory);
		emitUpdate({ category: newCategory });
	};
	const handleSimplificationChange = (_event, newValue) => {
		const value = Array.isArray(newValue) ? newValue[0] : newValue;
		if (typeof value === "number") setSimplificationLevel(value);
		emitUpdate({});
	};
	const handleProcessingOptionChange = (option, value) => {
		emitUpdate({ metadata: {
			...draft.metadata ?? {},
			[option]: value
		} });
		if (option === "generateElevation") setGenerateElevation(Boolean(value));
		if (option === "generateTurns") setGenerateturns(Boolean(value));
		if (option === "maxFileSize") setMaxFileSize(Number(value));
	};
	const startProcessing = async () => {
		setProcessingStatus({
			isProcessing: true,
			progress: 0,
			stage: "initializing",
			message: t("processing.initializing", "Initializing route processing...")
		});
		const stages = [
			{
				key: "fetching",
				message: t("processing.fetchingData", "Fetching route data...")
			},
			{
				key: "calculating",
				message: t("processing.calculating", "Calculating route segments...")
			},
			{
				key: "elevation",
				message: t("processing.elevation", "Processing elevation data...")
			},
			{
				key: "simplifying",
				message: t("processing.simplifying", "Simplifying route geometry...")
			},
			{
				key: "optimizing",
				message: t("processing.optimizing", "Optimizing route data...")
			},
			{
				key: "finalizing",
				message: t("processing.finalizing", "Finalizing route...")
			}
		];
		try {
			for (let i = 0; i < stages.length; i++) {
				const stage = stages[i];
				if (stage) setProcessingStatus((prev) => ({
					...prev,
					progress: i / stages.length * 100,
					stage: stage.key,
					message: stage.message
				}));
				await new Promise((resolve) => setTimeout(resolve, 1500 + Math.random() * 1e3));
			}
			setProcessingStatus({
				isProcessing: false,
				progress: 100,
				stage: "completed",
				message: t("processing.completed", "Route processing completed!")
			});
			emitUpdate({});
			onValidationChange(true);
		} catch (error) {
			setProcessingStatus({
				isProcessing: false,
				progress: 0,
				stage: "error",
				message: t("processing.error", "Processing failed. Please try again.")
			});
			console.error("Route processing error:", error);
		}
	};
	const stopProcessing = () => {
		setProcessingStatus({
			isProcessing: false,
			progress: 0,
			stage: "stopped",
			message: t("processing.stopped", "Processing stopped by user.")
		});
	};
	const getSimplificationLabel = (value) => {
		const labels = [
			t("processing.min", "Minimal"),
			t("processing.min", "Low"),
			t("processing.med", "Medium"),
			t("processing.high", "High"),
			t("processing.max", "Maximum")
		];
		return labels[Math.min(value - 1, labels.length - 1)] || labels[2];
	};
	return /* @__PURE__ */ jsxs(Box, {
		sx: { width: "100%" },
		children: [
			/* @__PURE__ */ jsx(Typography, {
				variant: "h6",
				gutterBottom: true,
				children: t("processing.title", "Route Processing")
			}),
			/* @__PURE__ */ jsx(Typography, {
				variant: "body2",
				color: "text.secondary",
				sx: { mb: 3 },
				children: t("processing.description", "Configure processing options for route generation")
			}),
			/* @__PURE__ */ jsxs(Box, {
				sx: { mb: 3 },
				children: [/* @__PURE__ */ jsx(Typography, {
					variant: "subtitle1",
					gutterBottom: true,
					children: t("processing.routeCategory", "Route Category")
				}), /* @__PURE__ */ jsxs(FormControl, {
					fullWidth: true,
					size: "small",
					children: [/* @__PURE__ */ jsx(InputLabel, { children: t("processing.category", "Category") }), /* @__PURE__ */ jsxs(Select, {
						value: category,
						label: t("processing.category", "Category"),
						onChange: (e) => handleCategoryChange(String(e.target.value)),
						children: [
							/* @__PURE__ */ jsx(MenuItem, {
								value: "transportation",
								children: t("categories.transportation", "Transportation")
							}),
							/* @__PURE__ */ jsx(MenuItem, {
								value: "recreation",
								children: t("categories.recreation", "Recreation")
							}),
							/* @__PURE__ */ jsx(MenuItem, {
								value: "logistics",
								children: t("categories.logistics", "Logistics")
							}),
							/* @__PURE__ */ jsx(MenuItem, {
								value: "emergency",
								children: t("categories.emergency", "Emergency")
							})
						]
					})]
				})]
			}),
			/* @__PURE__ */ jsxs(Box, {
				sx: { mb: 3 },
				children: [/* @__PURE__ */ jsx(Typography, {
					variant: "subtitle1",
					gutterBottom: true,
					children: t("processing.options", "Processing Options")
				}), /* @__PURE__ */ jsxs(Stack, {
					spacing: 3,
					children: [
						/* @__PURE__ */ jsxs(Box, { children: [/* @__PURE__ */ jsxs(Typography, {
							variant: "body2",
							gutterBottom: true,
							children: [
								t("processing.simplificationLevel", "Simplification Level"),
								":",
								" ",
								getSimplificationLabel(simplificationLevel)
							]
						}), /* @__PURE__ */ jsx(Slider, {
							value: simplificationLevel,
							onChange: handleSimplificationChange,
							min: 1,
							max: 5,
							step: 1,
							marks: [
								{
									value: 1,
									label: t("processing.min", "Min")
								},
								{
									value: 3,
									label: t("processing.med", "Med")
								},
								{
									value: 5,
									label: t("processing.max", "Max")
								}
							]
						})] }),
						/* @__PURE__ */ jsx(FormControlLabel, {
							control: /* @__PURE__ */ jsx(Switch, {
								checked: generateElevation,
								onChange: (e) => handleProcessingOptionChange("generateElevation", e.target.checked)
							}),
							label: t("processing.generateElevation", "Generate Elevation Profile")
						}),
						/* @__PURE__ */ jsx(FormControlLabel, {
							control: /* @__PURE__ */ jsx(Switch, {
								checked: generateTurns,
								onChange: (e) => handleProcessingOptionChange("generateTurns", e.target.checked)
							}),
							label: t("processing.generateTurns", "Generate Turn Instructions")
						}),
						/* @__PURE__ */ jsx(TextField, {
							label: t("processing.maxFileSize", "Max File Size (MB)"),
							type: "number",
							value: maxFileSize,
							onChange: (e) => handleProcessingOptionChange("maxFileSize", Number(e.target.value)),
							size: "small",
							inputProps: {
								min: 1,
								max: 500
							}
						})
					]
				})]
			}),
			(processingStatus.isProcessing || processingStatus.progress > 0) && /* @__PURE__ */ jsx(Card, {
				sx: { mb: 3 },
				children: /* @__PURE__ */ jsxs(CardContent, { children: [
					/* @__PURE__ */ jsx(Typography, {
						variant: "subtitle2",
						gutterBottom: true,
						children: t("processing.status", "Processing Status")
					}),
					/* @__PURE__ */ jsxs(Box, {
						sx: {
							display: "flex",
							alignItems: "center",
							gap: 2,
							mb: 2
						},
						children: [/* @__PURE__ */ jsx(Chip, {
							label: processingStatus.stage,
							color: processingStatus.isProcessing ? "primary" : processingStatus.progress === 100 ? "success" : "default",
							size: "small"
						}), /* @__PURE__ */ jsx(Typography, {
							variant: "body2",
							sx: { flex: 1 },
							children: processingStatus.message
						})]
					}),
					/* @__PURE__ */ jsx(LinearProgress, {
						variant: "determinate",
						value: processingStatus.progress,
						sx: { mb: 1 }
					}),
					/* @__PURE__ */ jsxs(Typography, {
						variant: "caption",
						color: "text.secondary",
						children: [
							Math.round(processingStatus.progress),
							"%",
							" ",
							t("processing.complete", "complete")
						]
					})
				] })
			}),
			/* @__PURE__ */ jsxs(Box, {
				sx: {
					display: "flex",
					gap: 2,
					justifyContent: "center"
				},
				children: [
					!processingStatus.isProcessing && processingStatus.progress < 100 && /* @__PURE__ */ jsx(Button, {
						variant: "contained",
						startIcon: /* @__PURE__ */ jsx(PlayArrow, {}),
						onClick: startProcessing,
						disabled: !Array.isArray(draft.waypoints) || draft.waypoints.length < 2,
						children: t("processing.startProcessing", "Start Processing")
					}),
					processingStatus.isProcessing && /* @__PURE__ */ jsx(Button, {
						variant: "outlined",
						color: "error",
						startIcon: /* @__PURE__ */ jsx(Stop, {}),
						onClick: stopProcessing,
						children: t("processing.stopProcessing", "Stop Processing")
					}),
					/* @__PURE__ */ jsx(Button, {
						variant: "outlined",
						startIcon: /* @__PURE__ */ jsx(Settings, {}),
						disabled: processingStatus.isProcessing,
						children: t("processing.advancedSettings", "Advanced Settings")
					})
				]
			}),
			processingStatus.progress === 100 && !processingStatus.isProcessing && /* @__PURE__ */ jsx(Alert, {
				severity: "success",
				sx: { mt: 2 },
				children: /* @__PURE__ */ jsx(Typography, {
					variant: "body2",
					children: t("processing.successMessage", "Route has been processed successfully and is ready to use!")
				})
			})
		]
	});
};

//#endregion
//#region src/common/entities/RouteEntity.ts
const ROUTE_TYPES = {
	ROAD: "road",
	RAILWAY: "railway",
	WATERWAY: "waterway",
	AIRWAY: "airway",
	WALKING: "walking",
	CYCLING: "cycling",
	HIKING: "hiking",
	SHIPPING: "shipping",
	PIPELINE: "pipeline",
	POWERLINE: "powerline"
};

//#endregion
//#region src/ui/components/steps/RouteDetailsStep.tsx
/**
* @file RouteDetailsStep.tsx
* @description Route configuration step following the shared BasicInfo step.
*/
const RouteDetailsStep = ({ draft: draftProp, onUpdate, onValidationChange, disabled = false }) => {
	const { t } = useTranslation();
	const fieldId = useId();
	const draft = useMemo(() => getRouteUpdaterPayload(draftProp), [draftProp]);
	const resolvedRouteType = draft.routeType ?? ROUTE_TYPES.ROAD;
	const resolvedDataSource = draft.dataSourceName ?? "openstreetmap";
	useEffect(() => {
		onValidationChange(Boolean(resolvedRouteType) && Boolean(resolvedDataSource));
	}, [
		onValidationChange,
		resolvedRouteType,
		resolvedDataSource
	]);
	const emitUpdate = useCallback((updates) => {
		onUpdate({ ...updates });
	}, [onUpdate]);
	const handleRouteTypeChange = useCallback((routeType) => {
		emitUpdate({ routeType });
	}, [emitUpdate]);
	return /* @__PURE__ */ jsxs(Box, {
		sx: {
			p: 3,
			maxWidth: 700,
			margin: "0 auto"
		},
		children: [
			/* @__PURE__ */ jsx(Divider, { sx: { my: 2 } }),
			/* @__PURE__ */ jsx(TextField, {
				select: true,
				label: t("details.routeTypeLabel", "Route Type"),
				id: `${fieldId}-route-type`,
				name: "route-type",
				value: resolvedRouteType,
				onChange: (event) => handleRouteTypeChange(event.target.value),
				required: true,
				fullWidth: true,
				disabled,
				helperText: t("details.routeTypeHelperText", "Select the type of route"),
				error: !resolvedRouteType,
				sx: { mb: 3 },
				inputProps: {
					id: `${fieldId}-route-type`,
					name: "route-type"
				},
				children: Object.values(ROUTE_TYPES).map((type) => /* @__PURE__ */ jsx(MenuItem, {
					value: type,
					children: t(`routeTypes.${type}`, type)
				}, type))
			}),
			/* @__PURE__ */ jsxs(TextField, {
				select: true,
				label: t("details.dataSourceLabel", "Data source"),
				id: `${fieldId}-data-source`,
				name: "data-source",
				value: resolvedDataSource,
				onChange: (event) => emitUpdate({ dataSourceName: event.target.value }),
				required: true,
				fullWidth: true,
				disabled,
				helperText: t("details.dataSourceHelperText", "Choose openstreetmap for OSRM/Overpass or custom for tabular import"),
				inputProps: {
					id: `${fieldId}-data-source`,
					name: "data-source"
				},
				children: [/* @__PURE__ */ jsx(MenuItem, {
					value: "openstreetmap",
					children: "OpenStreetMap"
				}), /* @__PURE__ */ jsx(MenuItem, {
					value: "custom",
					children: "Custom (tabular)"
				})]
			})
		]
	});
};

//#endregion
//#region src/ui/components/steps/RouteBuildStep.tsx
const STAGES = [
	{
		id: "prepare",
		title: "Prepare",
		description: "Validate route parameters."
	},
	{
		id: "fetch",
		title: "Fetch",
		description: "Fetch route graph data."
	},
	{
		id: "compute",
		title: "Compute",
		description: "Calculate routes and metrics."
	},
	{
		id: "finalize",
		title: "Finalize",
		description: "Persist results and indexes."
	}
];
const toList = (value) => {
	if (Array.isArray(value)) return value.filter((item) => typeof item === "string");
	return [];
};
const RouteBuildStep = ({ draft: draftProp }) => {
	const { t } = useTranslation();
	const draft = draftProp.draftData ?? {};
	const routeType = draft.routeType ?? "unknown";
	const transportModes = toList(draft.transportModes);
	const hasRequiredFields = Boolean(routeType && transportModes.length);
	const [status, setStatus] = useState("idle");
	const [overallProgress, setOverallProgress] = useState(0);
	const stageProgress = useMemo(() => {
		const map = {};
		STAGES.forEach((stage, idx) => {
			map[stage.id] = Math.min(100, Math.max(0, overallProgress - idx * 10));
		});
		return map;
	}, [overallProgress]);
	return /* @__PURE__ */ jsxs(Box, {
		display: "flex",
		flexDirection: "column",
		gap: 2,
		children: [
			/* @__PURE__ */ jsx(Typography, {
				variant: "body2",
				color: "text.secondary",
				children: t("build.review", "Review the configuration and press Build to start the batch route generation.")
			}),
			/* @__PURE__ */ jsxs(Stack, {
				direction: "row",
				spacing: 1,
				flexWrap: "wrap",
				alignItems: "center",
				children: [/* @__PURE__ */ jsx(Typography, {
					variant: "subtitle2",
					children: t("build.routeType", "Route Type:")
				}), /* @__PURE__ */ jsx(Chip, {
					size: "small",
					label: String(routeType)
				})]
			}),
			/* @__PURE__ */ jsxs(Stack, {
				direction: "row",
				spacing: 1,
				flexWrap: "wrap",
				alignItems: "center",
				children: [/* @__PURE__ */ jsx(Typography, {
					variant: "subtitle2",
					children: t("build.transportModes", "Transport Modes:")
				}), transportModes.length ? transportModes.map((mode) => /* @__PURE__ */ jsx(Chip, {
					size: "small",
					label: mode
				}, mode)) : /* @__PURE__ */ jsx(Chip, {
					size: "small",
					label: t("build.notConfigured", "Not configured")
				})]
			}),
			!hasRequiredFields && /* @__PURE__ */ jsx(Alert, {
				severity: "info",
				children: t("build.missing", "Provide a name, route type, and at least one transport mode before building.")
			}),
			/* @__PURE__ */ jsx(BuildStepPanel, {
				title: t("build.title", "Build routes"),
				description: t("build.panelDescription", "Monitor and control route build progress."),
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
			})
		]
	});
};

//#endregion
//#region src/ui/components/steps-provider.tsx
const registry = PluginStepRegistry.getInstance();
const ensureDraft = (data) => {
	const fallbackId = "route-draft";
	if (data && typeof data === "object") {
		const cast = data;
		return { ...toRouteUpdaterPayload(cast, cast.treeNodeId ?? cast.id ?? fallbackId) };
	}
	return { ...toRouteUpdaterPayload(null, fallbackId) };
};
const mergeDraft = (current, updates) => {
	const nextDraftMetadata = updates.draftMetadata ?? current.draftMetadata ?? null;
	const nextDraftData = {
		...current.draftData ?? {},
		...updates.draftData ?? {}
	};
	return {
		...current,
		...updates,
		draftMetadata: nextDraftMetadata,
		draftData: nextDraftData
	};
};
const hasRouteDetails = (data) => {
	const draftData = data?.draftData ?? {};
	const routeType = typeof draftData.routeType === "string" ? draftData.routeType : void 0;
	const transportModes = Array.isArray(draftData.transportModes) ? draftData.transportModes : [];
	return Boolean(routeType && transportModes.length > 0);
};
const startRouteBatch = async (data, _context) => {
	const { t } = useTranslation();
	const draft = data?.draftData ?? {};
	if (!Boolean(typeof draft.name === "string" && draft.name.trim() && draft.routeType && Array.isArray(draft.transportModes) && draft.transportModes.length > 0)) {
		notify.info(t("messages.completeBeforeBuild", "Complete the required route settings before starting a build."));
		return;
	}
	notify.info(t("messages.batchNotImplemented", "Route batch launch is not yet implemented in this dialog."));
};
registry.registerConfigProvider({
	nodeType: "route",
	getCreateStepConfigs() {
		const { t } = useTranslation();
		return [
			{
				id: "route-details",
				label: t("steps.details.label", "Route Settings"),
				componentFactory: (p) => {
					const draft = ensureDraft(p.data);
					return /* @__PURE__ */ jsx(RouteDetailsStep, {
						draft,
						onUpdate: (updates) => p.onChange(mergeDraft(draft, { draftData: updates })),
						onValidationChange: p.setValid
					});
				},
				validate: hasRouteDetails
			},
			{
				id: "route-selection",
				label: t("steps.selection.label", "Route Selection"),
				componentFactory: (p) => {
					const draft = ensureDraft(p.data);
					return /* @__PURE__ */ jsx(RouteSelectionStep, {
						draft,
						onUpdate: (updates) => p.onChange(mergeDraft(draft, { draftData: updates })),
						onValidationChange: p.setValid
					});
				},
				validate: () => true
			},
			{
				id: "processing",
				label: t("steps.processing.label", "Processing"),
				componentFactory: (p) => {
					const draft = ensureDraft(p.data);
					return /* @__PURE__ */ jsx(RouteProcessingStep, {
						draft,
						onUpdate: (updates) => p.onChange(mergeDraft(draft, { draftData: updates })),
						onValidationChange: p.setValid
					});
				},
				validate: () => true
			},
			{
				id: "build",
				label: t("steps.build.label", "Build"),
				optional: false,
				componentFactory: (p) => {
					return /* @__PURE__ */ jsx(RouteBuildStep, { draft: ensureDraft(p.data) });
				},
				capabilities: {
					canStartBatch: (data) => {
						const draft = data?.draftData ?? {};
						return Boolean(typeof draft.name === "string" && draft.name.trim() && draft.routeType && Array.isArray(draft.transportModes) && draft.transportModes.length > 0);
					},
					startBatch: (data, context) => startRouteBatch(data, context)
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
async function getDialogComponent() {
	const Adapter = () => {
		if (typeof console !== "undefined" && typeof console.warn === "function") console.warn("[route-plugin] getDialogComponent() is deprecated. Dialogs are provided via PluginDialogHost.");
		return null;
	};
	return Adapter;
}
async function getPanelComponent() {
	const { RoutePanel } = await import("../RoutePanel.js");
	const Adapter = (props) => createElement(RoutePanel, toRoutePanelProps(props));
	return Adapter;
}
function toRoutePanelProps(props) {
	const record = props;
	const nodeId = record.nodeId;
	if (typeof nodeId !== "string") throw new Error("RoutePanel requires nodeId");
	return {
		nodeId,
		entity: record.entity ?? null,
		onEdit: typeof record.onEdit === "function" ? record.onEdit : () => {},
		onDelete: typeof record.onDelete === "function" ? record.onDelete : () => {},
		onToggleVisibility: typeof record.onToggleVisibility === "function" ? record.onToggleVisibility : () => {}
	};
}

//#endregion
export { getDialogComponent, getPanelComponent };
//# sourceMappingURL=index.js.map