import { c as translations, l as useTranslation } from "../i18n.js";
import { n as TransportMode, t as RouteType } from "../types.js";
import { createEntityWorkingCopyAdapter } from "@hierarchidb/plugin-service-sdk";
import { createElement, useCallback, useEffect, useMemo, useState } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { PluginStepRegistry } from "@hierarchidb/plugin-base";
import { BasicInfoStep } from "@hierarchidb/ui-plugin-basic-info";
import { Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Divider, FormControl, FormControlLabel, InputLabel, LinearProgress, MenuItem, OutlinedInput, Select, Slider, Stack, Switch, TextField, Typography } from "@mui/material";
import { Add, MyLocation, PlayArrow, Remove, Settings, Stop } from "@mui/icons-material";

//#region src/common/utils/workingCopy.ts
const DEFAULT_TRANSPORT_MODES = [TransportMode.CAR];
const DEFAULT_PROCESSING_CONFIG = {
	concurrentRequests: 4,
	enableRouteOptimization: true,
	enableElevationData: false,
	enableTrafficData: false
};
const adapter = createEntityWorkingCopyAdapter({
	draftFromEntity(entity) {
		return {
			name: entity.name,
			description: entity.description,
			category: entity.category,
			routeType: entity.routeType,
			transportModes: entity.transportModes,
			startPoint: entity.startPoint,
			endPoint: entity.endPoint,
			waypoints: entity.waypoints,
			boundingBox: entity.boundingBox,
			distance: entity.distance,
			duration: entity.duration,
			elevation: entity.elevation,
			dataSourceName: entity.dataSourceName,
			licenseAgreement: entity.licenseAgreement,
			licenseAgreedAt: entity.licenseAgreedAt,
			processingConfig: entity.processingConfig,
			batchSessionId: entity.batchSessionId,
			processingStatus: entity.processingStatus,
			metadata: entity.metadata,
			customFields: entity.customFields,
			createdAt: entity.createdAt,
			updatedAt: entity.updatedAt,
			version: entity.version
		};
	},
	draftDefaults(treeNodeId, overrides = {}) {
		const now = Date.now();
		return {
			name: overrides?.name ?? "",
			description: overrides?.description ?? "",
			category: overrides?.category,
			routeType: overrides?.routeType ?? RouteType.ROAD,
			transportModes: overrides?.transportModes ?? DEFAULT_TRANSPORT_MODES,
			startPoint: overrides?.startPoint,
			endPoint: overrides?.endPoint,
			waypoints: overrides?.waypoints ?? [],
			boundingBox: overrides?.boundingBox,
			distance: overrides?.distance,
			duration: overrides?.duration,
			elevation: overrides?.elevation,
			dataSourceName: overrides?.dataSourceName ?? "openstreetmap",
			licenseAgreement: overrides?.licenseAgreement ?? false,
			licenseAgreedAt: overrides?.licenseAgreedAt,
			processingConfig: overrides?.processingConfig ?? DEFAULT_PROCESSING_CONFIG,
			batchSessionId: overrides?.batchSessionId,
			processingStatus: overrides?.processingStatus ?? "idle",
			metadata: overrides?.metadata ?? {},
			customFields: overrides?.customFields ?? {},
			createdAt: overrides?.createdAt ?? now,
			updatedAt: overrides?.updatedAt ?? now,
			version: overrides?.version ?? 1,
			nodeId: overrides?.nodeId ?? treeNodeId
		};
	},
	finalize(workingCopy, source) {
		return {
			...workingCopy,
			id: workingCopy.treeNodeId,
			nodeId: workingCopy.nodeId ?? source.nodeId ?? workingCopy.treeNodeId,
			parentId: workingCopy.parentId ?? workingCopy.treeNodeId,
			isDraft: false
		};
	},
	finalizeDraft(workingCopy, treeNodeId) {
		return {
			...workingCopy,
			id: workingCopy.treeNodeId,
			nodeId: workingCopy.treeNodeId,
			parentId: workingCopy.parentId ?? treeNodeId,
			isDraft: true,
			resumeStep: 0
		};
	}
});
function getRouteDraft(workingCopy) {
	if (workingCopy && typeof workingCopy === "object" && workingCopy.draft && typeof workingCopy.draft === "object") return workingCopy.draft;
	return workingCopy;
}

//#endregion
//#region src/common/components/RouteSelectionStep.tsx
const RouteSelectionStep = ({ workingCopy, onUpdate, onValidationChange }) => {
	const { t } = useTranslation();
	const draft = useMemo(() => getRouteDraft(workingCopy), [workingCopy]);
	const draftVersion = draft.version;
	const computeNextVersion = useCallback(() => {
		const base = typeof draftVersion === "number" ? draftVersion : typeof workingCopy.originalVersion === "number" ? workingCopy.originalVersion : 0;
		return typeof base === "number" ? base + 1 : 0;
	}, [draftVersion, workingCopy.originalVersion]);
	const emitUpdate = useCallback((updates) => {
		onUpdate({
			...updates,
			updatedAt: Date.now(),
			version: computeNextVersion()
		});
	}, [computeNextVersion, onUpdate]);
	const [waypoints, setWaypoints] = useState([{
		id: "1",
		name: t("base-dialog.routeSelection.startPoint", "Start Point")
	}, {
		id: "2",
		name: t("base-dialog.routeSelection.endPoint", "End Point")
	}]);
	const [avoidTolls, setAvoidTolls] = useState(false);
	const [avoidHighways, setAvoidHighways] = useState(false);
	const [routeAlgorithm, setRouteAlgorithm] = useState("fastest");
	const [isCalculating, setIsCalculating] = useState(false);
	const handleAddWaypoint = () => {
		const newWaypoint = {
			id: `waypoint-${Date.now()}`,
			name: t("base-dialog.routeSelection.waypoint", "Waypoint") + ` ${waypoints.length - 1}`
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
			emitUpdate({ waypoints: waypoints.map((wp) => wp.coordinates).filter((coords) => Array.isArray(coords)) });
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
				children: t("base-dialog.routeSelection.title", "Route Selection")
			}),
			/* @__PURE__ */ jsx(Typography, {
				variant: "body2",
				color: "text.secondary",
				sx: { mb: 3 },
				children: t("base-dialog.routeSelection.description", "Configure waypoints and route options")
			}),
			/* @__PURE__ */ jsxs(Box, {
				sx: { mb: 3 },
				children: [
					/* @__PURE__ */ jsx(Typography, {
						variant: "subtitle1",
						gutterBottom: true,
						children: t("base-dialog.routeSelection.waypoints", "Waypoints")
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
									placeholder: index === 0 ? t("base-dialog.routeSelection.startPlaceholder", "Enter start location") : index === waypoints.length - 1 ? t("base-dialog.routeSelection.endPlaceholder", "Enter destination") : t("base-dialog.routeSelection.waypointPlaceholder", "Enter waypoint location")
								}),
								/* @__PURE__ */ jsx(Button, {
									size: "small",
									variant: "outlined",
									onClick: () => handleGetCurrentLocation(waypoint.id),
									startIcon: /* @__PURE__ */ jsx(MyLocation, {}),
									sx: { minWidth: 120 },
									children: t("base-dialog.routeSelection.currentLocation", "Current")
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
							children: t("base-dialog.routeSelection.addWaypoint", "Add Waypoint")
						})
					})
				]
			}),
			/* @__PURE__ */ jsxs(Box, {
				sx: { mb: 3 },
				children: [/* @__PURE__ */ jsx(Typography, {
					variant: "subtitle1",
					gutterBottom: true,
					children: t("base-dialog.routeSelection.routeOptions", "Route Options")
				}), /* @__PURE__ */ jsxs(Stack, {
					spacing: 2,
					children: [
						/* @__PURE__ */ jsxs(FormControl, {
							size: "small",
							children: [/* @__PURE__ */ jsx(InputLabel, { children: t("base-dialog.routeSelection.algorithm", "Route Algorithm") }), /* @__PURE__ */ jsxs(Select, {
								value: routeAlgorithm,
								label: t("base-dialog.routeSelection.algorithm", "Route Algorithm"),
								onChange: (e) => setRouteAlgorithm(e.target.value),
								children: [
									/* @__PURE__ */ jsx(MenuItem, {
										value: "fastest",
										children: t("base-dialog.routeSelection.fastest", "Fastest Route")
									}),
									/* @__PURE__ */ jsx(MenuItem, {
										value: "shortest",
										children: t("base-dialog.routeSelection.shortest", "Shortest Route")
									}),
									/* @__PURE__ */ jsx(MenuItem, {
										value: "scenic",
										children: t("base-dialog.routeSelection.scenic", "Scenic Route")
									})
								]
							})]
						}),
						/* @__PURE__ */ jsx(FormControlLabel, {
							control: /* @__PURE__ */ jsx(Switch, {
								checked: avoidTolls,
								onChange: (e) => setAvoidTolls(e.target.checked)
							}),
							label: t("base-dialog.routeSelection.avoidTolls", "Avoid Tolls")
						}),
						/* @__PURE__ */ jsx(FormControlLabel, {
							control: /* @__PURE__ */ jsx(Switch, {
								checked: avoidHighways,
								onChange: (e) => setAvoidHighways(e.target.checked)
							}),
							label: t("base-dialog.routeSelection.avoidHighways", "Avoid Highways")
						})
					]
				})]
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
					children: isCalculating ? t("base-dialog.routeSelection.calculating", "Calculating...") : t("base-dialog.routeSelection.calculateRoute", "Calculate Route")
				})
			}),
			Array.isArray(draft.waypoints) && draft.waypoints.length > 0 && /* @__PURE__ */ jsx(Alert, {
				severity: "success",
				sx: { mt: 2 },
				children: t("base-dialog.routeSelection.routeCalculated", "Route calculated successfully!")
			})
		]
	});
};

//#endregion
//#region src/common/components/RouteProcessingStep.tsx
const RouteProcessingStep = ({ workingCopy, onUpdate, onValidationChange }) => {
	const { t } = useTranslation();
	const draft = useMemo(() => getRouteDraft(workingCopy), [workingCopy]);
	const draftVersion = draft.version;
	const computeNextVersion = useCallback(() => {
		const base = typeof draftVersion === "number" ? draftVersion : typeof workingCopy.originalVersion === "number" ? workingCopy.originalVersion : 0;
		return typeof base === "number" ? base + 1 : 0;
	}, [draftVersion, workingCopy.originalVersion]);
	const resolvedCategory = draft.category ?? "transportation";
	const [category, setCategory] = useState(resolvedCategory);
	useEffect(() => {
		setCategory(resolvedCategory);
	}, [resolvedCategory]);
	const emitUpdate = useCallback((updates) => {
		onUpdate({
			...updates,
			updatedAt: Date.now(),
			version: computeNextVersion()
		});
	}, [computeNextVersion, onUpdate]);
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
		emitUpdate({ [option]: value });
		if (option === "generateElevation") setGenerateElevation(value);
		if (option === "generateTurns") setGenerateturns(value);
		if (option === "maxFileSize") setMaxFileSize(value);
	};
	const startProcessing = async () => {
		setProcessingStatus({
			isProcessing: true,
			progress: 0,
			stage: "initializing",
			message: t("base-dialog.processing.initializing", "Initializing route processing...")
		});
		const stages = [
			{
				key: "fetching",
				message: t("base-dialog.processing.fetchingData", "Fetching route data...")
			},
			{
				key: "calculating",
				message: t("base-dialog.processing.calculating", "Calculating route segments...")
			},
			{
				key: "elevation",
				message: t("base-dialog.processing.elevation", "Processing elevation data...")
			},
			{
				key: "simplifying",
				message: t("base-dialog.processing.simplifying", "Simplifying route geometry...")
			},
			{
				key: "optimizing",
				message: t("base-dialog.processing.optimizing", "Optimizing route data...")
			},
			{
				key: "finalizing",
				message: t("base-dialog.processing.finalizing", "Finalizing route...")
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
				message: t("base-dialog.processing.completed", "Route processing completed!")
			});
			emitUpdate({});
			onValidationChange(true);
		} catch (error) {
			setProcessingStatus({
				isProcessing: false,
				progress: 0,
				stage: "error",
				message: t("base-dialog.processing.error", "Processing failed. Please try again.")
			});
			console.error("Route processing error:", error);
		}
	};
	const stopProcessing = () => {
		setProcessingStatus({
			isProcessing: false,
			progress: 0,
			stage: "stopped",
			message: t("base-dialog.processing.stopped", "Processing stopped by user.")
		});
	};
	const getSimplificationLabel = (value) => {
		const labels = [
			t("base-dialog.processing.minimal", "Minimal"),
			t("base-dialog.processing.low", "Low"),
			t("base-dialog.processing.medium", "Medium"),
			t("base-dialog.processing.high", "High"),
			t("base-dialog.processing.maximum", "Maximum")
		];
		return labels[Math.min(value - 1, labels.length - 1)] || labels[2];
	};
	return /* @__PURE__ */ jsxs(Box, {
		sx: { width: "100%" },
		children: [
			/* @__PURE__ */ jsx(Typography, {
				variant: "h6",
				gutterBottom: true,
				children: t("base-dialog.processing.title", "Route Processing")
			}),
			/* @__PURE__ */ jsx(Typography, {
				variant: "body2",
				color: "text.secondary",
				sx: { mb: 3 },
				children: t("base-dialog.processing.description", "Configure processing options for route generation")
			}),
			/* @__PURE__ */ jsxs(Box, {
				sx: { mb: 3 },
				children: [/* @__PURE__ */ jsx(Typography, {
					variant: "subtitle1",
					gutterBottom: true,
					children: t("base-dialog.processing.routeCategory", "Route Category")
				}), /* @__PURE__ */ jsxs(FormControl, {
					fullWidth: true,
					size: "small",
					children: [/* @__PURE__ */ jsx(InputLabel, { children: t("base-dialog.processing.category", "Category") }), /* @__PURE__ */ jsxs(Select, {
						value: category,
						label: t("base-dialog.processing.category", "Category"),
						onChange: (e) => handleCategoryChange(e.target.value),
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
					children: t("base-dialog.processing.options", "Processing Options")
				}), /* @__PURE__ */ jsxs(Stack, {
					spacing: 3,
					children: [
						/* @__PURE__ */ jsxs(Box, { children: [/* @__PURE__ */ jsxs(Typography, {
							variant: "body2",
							gutterBottom: true,
							children: [
								t("base-dialog.processing.simplificationLevel", "Simplification Level"),
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
									label: t("base-dialog.processing.min", "Min")
								},
								{
									value: 3,
									label: t("base-dialog.processing.med", "Med")
								},
								{
									value: 5,
									label: t("base-dialog.processing.max", "Max")
								}
							]
						})] }),
						/* @__PURE__ */ jsx(FormControlLabel, {
							control: /* @__PURE__ */ jsx(Switch, {
								checked: generateElevation,
								onChange: (e) => handleProcessingOptionChange("generateElevation", e.target.checked)
							}),
							label: t("base-dialog.processing.generateElevation", "Generate Elevation Profile")
						}),
						/* @__PURE__ */ jsx(FormControlLabel, {
							control: /* @__PURE__ */ jsx(Switch, {
								checked: generateTurns,
								onChange: (e) => handleProcessingOptionChange("generateTurns", e.target.checked)
							}),
							label: t("base-dialog.processing.generateTurns", "Generate Turn Instructions")
						}),
						/* @__PURE__ */ jsx(TextField, {
							label: t("base-dialog.processing.maxFileSize", "Max File Size (MB)"),
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
						children: t("base-dialog.processing.status", "Processing Status")
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
							t("base-dialog.processing.complete", "complete")
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
						children: t("base-dialog.processing.startProcessing", "Start Processing")
					}),
					processingStatus.isProcessing && /* @__PURE__ */ jsx(Button, {
						variant: "outlined",
						color: "error",
						startIcon: /* @__PURE__ */ jsx(Stop, {}),
						onClick: stopProcessing,
						children: t("base-dialog.processing.stopProcessing", "Stop Processing")
					}),
					/* @__PURE__ */ jsx(Button, {
						variant: "outlined",
						startIcon: /* @__PURE__ */ jsx(Settings, {}),
						disabled: processingStatus.isProcessing,
						children: t("base-dialog.processing.advancedSettings", "Advanced Settings")
					})
				]
			}),
			processingStatus.progress === 100 && !processingStatus.isProcessing && /* @__PURE__ */ jsx(Alert, {
				severity: "success",
				sx: { mt: 2 },
				children: /* @__PURE__ */ jsx(Typography, {
					variant: "body2",
					children: t("base-dialog.processing.successMessage", "Route has been processed successfully and is ready to use!")
				})
			})
		]
	});
};

//#endregion
//#region src/common/components/RouteDetailsStep.tsx
/**
* @file RouteDetailsStep.tsx
* @description Route configuration step following the shared BasicInfo step.
*/
const RouteDetailsStep = ({ workingCopy, onUpdate, onValidationChange, disabled = false }) => {
	const { translations: translations$1 } = useTranslation();
	const draft = useMemo(() => getRouteDraft(workingCopy), [workingCopy]);
	const resolvedRouteType = draft.routeType ?? RouteType.ROAD;
	const resolvedTransportModes = Array.isArray(draft.transportModes) ? draft.transportModes : [];
	const resolvedCategory = draft.category ?? "transportation";
	useEffect(() => {
		onValidationChange(Boolean(resolvedRouteType) && resolvedTransportModes.length > 0);
	}, [
		onValidationChange,
		resolvedRouteType,
		resolvedTransportModes.length
	]);
	const emitUpdate = useCallback((updates) => {
		onUpdate({
			...updates,
			updatedAt: Date.now()
		});
	}, [onUpdate]);
	const handleRouteTypeChange = useCallback((routeType) => {
		emitUpdate({ routeType });
	}, [emitUpdate]);
	const handleTransportModesChange = useCallback((event) => {
		const value = event.target.value;
		emitUpdate({ transportModes: Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [] });
	}, [emitUpdate]);
	const handleCategoryChange = useCallback((category) => {
		emitUpdate({ category });
	}, [emitUpdate]);
	return /* @__PURE__ */ jsxs(Box, {
		sx: {
			p: 3,
			maxWidth: 700,
			margin: "0 auto"
		},
		children: [
			/* @__PURE__ */ jsx(Typography, {
				variant: "h6",
				gutterBottom: true,
				children: translations$1.basicInfo.nameLabel ?? translations$1.basicInfo.title
			}),
			/* @__PURE__ */ jsx(Typography, {
				variant: "body2",
				color: "text.secondary",
				paragraph: true,
				children: translations$1.basicInfo.descriptionLabel ?? translations$1.basicInfo.subtitle
			}),
			/* @__PURE__ */ jsx(Divider, { sx: { my: 2 } }),
			/* @__PURE__ */ jsx(TextField, {
				select: true,
				label: translations$1.basicInfo.routeTypeLabel,
				value: resolvedRouteType,
				onChange: (event) => handleRouteTypeChange(event.target.value),
				required: true,
				fullWidth: true,
				disabled,
				helperText: translations$1.basicInfo.routeTypeHelperText,
				error: !resolvedRouteType,
				sx: { mb: 3 },
				children: Object.values(RouteType).map((type) => /* @__PURE__ */ jsx(MenuItem, {
					value: type,
					children: translations$1.routeTypes[type]
				}, type))
			}),
			/* @__PURE__ */ jsxs(FormControl, {
				required: true,
				fullWidth: true,
				disabled,
				sx: { mb: 3 },
				children: [
					/* @__PURE__ */ jsx(InputLabel, { children: translations$1.basicInfo.transportModesLabel }),
					/* @__PURE__ */ jsx(Select, {
						multiple: true,
						value: resolvedTransportModes,
						onChange: handleTransportModesChange,
						input: /* @__PURE__ */ jsx(OutlinedInput, { label: translations$1.basicInfo.transportModesLabel }),
						renderValue: (selected) => /* @__PURE__ */ jsx(Box, {
							sx: {
								display: "flex",
								flexWrap: "wrap",
								gap: .5
							},
							children: selected.map((mode) => /* @__PURE__ */ jsx(Chip, {
								label: translations$1.transportModes[mode],
								size: "small"
							}, mode))
						}),
						children: Object.values(TransportMode).map((mode) => /* @__PURE__ */ jsx(MenuItem, {
							value: mode,
							children: translations$1.transportModes[mode]
						}, mode))
					}),
					/* @__PURE__ */ jsx(Typography, {
						variant: "caption",
						color: "text.secondary",
						sx: {
							mt: .5,
							ml: 1.5
						},
						children: translations$1.basicInfo.transportModesHelperText
					})
				]
			}),
			/* @__PURE__ */ jsxs(TextField, {
				select: true,
				label: translations$1.basicInfo.categoryLabel,
				value: resolvedCategory,
				onChange: (event) => handleCategoryChange(event.target.value),
				fullWidth: true,
				disabled,
				helperText: translations$1.basicInfo.categoryHelperText,
				SelectProps: { native: true },
				children: [
					/* @__PURE__ */ jsx("option", {
						value: "transportation",
						children: translations$1.categories.transportation
					}),
					/* @__PURE__ */ jsx("option", {
						value: "recreation",
						children: translations$1.categories.recreation
					}),
					/* @__PURE__ */ jsx("option", {
						value: "logistics",
						children: translations$1.categories.logistics
					}),
					/* @__PURE__ */ jsx("option", {
						value: "emergency",
						children: translations$1.categories.emergency
					})
				]
			})
		]
	});
};

//#endregion
//#region src/ui/components/steps/RouteBuildStep.tsx
const toList = (value) => {
	if (Array.isArray(value)) return value.filter((item) => typeof item === "string");
	return [];
};
const RouteBuildStep = ({ workingCopy }) => {
	const draft = workingCopy.draft ?? {};
	const routeType = draft.routeType ?? "unknown";
	const transportModes = toList(draft.transportModes);
	const hasRequiredFields = Boolean(draft.name?.trim() && routeType && transportModes.length);
	return /* @__PURE__ */ jsxs(Box, {
		display: "flex",
		flexDirection: "column",
		gap: 2,
		children: [
			/* @__PURE__ */ jsxs(Typography, {
				variant: "body2",
				color: "text.secondary",
				children: [
					"Review the configuration and press ",
					/* @__PURE__ */ jsx("strong", { children: "Build" }),
					" to start the batch route generation."
				]
			}),
			/* @__PURE__ */ jsxs(Stack, {
				direction: "row",
				spacing: 1,
				flexWrap: "wrap",
				alignItems: "center",
				children: [/* @__PURE__ */ jsx(Typography, {
					variant: "subtitle2",
					children: "Route Type:"
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
					children: "Transport Modes:"
				}), transportModes.length ? transportModes.map((mode) => /* @__PURE__ */ jsx(Chip, {
					size: "small",
					label: mode
				}, mode)) : /* @__PURE__ */ jsx(Chip, {
					size: "small",
					label: "Not configured"
				})]
			}),
			!hasRequiredFields && /* @__PURE__ */ jsx(Alert, {
				severity: "info",
				children: "Provide a name, route type, and at least one transport mode before building."
			}),
			/* @__PURE__ */ jsxs(Alert, {
				severity: "success",
				children: [
					"When ready, click the ",
					/* @__PURE__ */ jsx("strong", { children: "Build" }),
					" button below to start the batch session."
				]
			})
		]
	});
};

//#endregion
//#region src/ui/components/steps-provider.tsx
const registry = PluginStepRegistry.getInstance();
const ensureWorkingCopy = (data) => {
	if (data && typeof data === "object") {
		const cast = data;
		return {
			...cast,
			treeNodeId: cast.treeNodeId ?? cast.id ?? "",
			draft: { ...cast.draft ?? {} },
			tags: cast.tags ?? [],
			createdAt: cast.createdAt ?? Date.now(),
			updatedAt: cast.updatedAt ?? Date.now()
		};
	}
	return {
		treeNodeId: "",
		draft: {},
		tags: [],
		createdAt: Date.now(),
		updatedAt: Date.now()
	};
};
const mergeWorkingCopy = (current, updates) => ({
	...current,
	...updates,
	draft: {
		...current.draft ?? {},
		...updates.draft ?? {}
	},
	tags: updates.tags ?? current.tags ?? []
});
const hasRouteDetails = (data) => {
	const draft = data?.draft;
	const routeType = draft && typeof draft.routeType === "string" ? draft.routeType : void 0;
	const transportModes = Array.isArray(draft.transportModes) ? draft.transportModes : [];
	return Boolean(routeType && transportModes.length > 0);
};
registry.registerConfigProvider({
	nodeType: "route",
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
						validate: ({ name }) => name.trim().length ? null : t.en.errors.nameRequired,
						onChange: (value) => p.onChange(mergeWorkingCopy(workingCopy, {
							draft: {
								...workingCopy.draft,
								name: value.name,
								description: value.description
							},
							tags: value.tags
						}))
					});
				},
				validate: (data) => Boolean(data?.draft?.name?.trim())
			},
			{
				id: "route-details",
				label: t.en.routeDetails.title,
				componentFactory: (p) => {
					const workingCopy = ensureWorkingCopy(p.data);
					return /* @__PURE__ */ jsx(RouteDetailsStep, {
						workingCopy,
						onUpdate: (updates) => p.onChange(mergeWorkingCopy(workingCopy, updates)),
						onValidationChange: p.setValid
					});
				},
				validate: hasRouteDetails
			},
			{
				id: "route-selection",
				label: t.en.routeSelection.title,
				componentFactory: (p) => {
					const workingCopy = ensureWorkingCopy(p.data);
					return /* @__PURE__ */ jsx(RouteSelectionStep, {
						workingCopy,
						onUpdate: (updates) => p.onChange(mergeWorkingCopy(workingCopy, updates)),
						onValidationChange: p.setValid
					});
				},
				validate: () => true
			},
			{
				id: "processing",
				label: t.en.processing.title,
				componentFactory: (p) => {
					const workingCopy = ensureWorkingCopy(p.data);
					return /* @__PURE__ */ jsx(RouteProcessingStep, {
						workingCopy,
						onUpdate: (updates) => p.onChange(mergeWorkingCopy(workingCopy, updates)),
						onValidationChange: p.setValid
					});
				},
				validate: () => true
			},
			{
				id: "build",
				label: "Build",
				optional: true,
				componentFactory: (p) => {
					return /* @__PURE__ */ jsx(RouteBuildStep, { workingCopy: ensureWorkingCopy(p.data) });
				},
				capabilities: { canStartBatch: (data) => {
					const draft = data?.draft ?? {};
					return Boolean(draft.name?.trim() && draft.routeType && Array.isArray(draft.transportModes) && draft.transportModes.length > 0);
				} },
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