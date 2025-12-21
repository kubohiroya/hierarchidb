import { t as isDevEnvironment } from "./env.js";
import "./registerLocationWorkerStores.js";
import { t as worker_exports } from "./worker/index.js";
import { n as formatNumber, r as useTranslation, t as formatBytes } from "./i18n.js";
import { n as LocationSelectionStep, t as LocationMapPreview } from "./LocationMapPreview.js";
import { r as getEphemeralLocationDB } from "./EphemeralLocationDB2.js";
import { a as replaceLocationPoints, c as createLocationBatchManager, i as listLocationPoints, l as isLocationBatchAPIV2Enabled, n as clearLocationPoints, o as LocationVectorTileService, r as deleteLocationPoints, s as UnifiedLocationBatchManager, t as appendLocationPoints, u as LocationBatchSessionManager } from "./pointRepository.js";
import { t as LocationBatchManager } from "./services.js";
import "./locationEntitiesDB2.js";
import { TabularQueryService as LocationTableQueryService } from "@hierarchidb/tabular-store";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Grid, IconButton, LinearProgress, List, ListItem, ListItemIcon, ListItemText, Paper, SpeedDial, SpeedDialAction, SpeedDialIcon, Step, StepContent, StepLabel, Stepper, Tab, Tabs, Tooltip, Typography } from "@mui/material";
import { Assessment, CheckCircle, Close, Download, Edit, Error as Error$1, HourglassEmpty, LocationOn, Map, Pause, PlayArrow, Refresh, Stop, TableView, Timeline, Warning } from "@mui/icons-material";
import { jsx, jsxs } from "react/jsx-runtime";
import Grid$1 from "@mui/material/Grid";
import { createAdapterFromProgressSubscribe, useBatchProgress } from "@hierarchidb/batch";
import { AuthNotificationRegistry } from "@hierarchidb/common-auth";
import { getWorkerBridge } from "@hierarchidb/ui-worker-client";
import { CrossViewSnackbar, TabularPreview } from "@hierarchidb/ui-data-grid";

//#region src/plugin-manifest.ts
const PLUGIN_ID = "@hierarchidb/location-plugin";
const PLUGIN_VERSION = "0.1.0";
const PLUGIN_DESCRIPTION = "Geographic location nodes with Shape integration";
const PLUGIN_NODE_TYPE = "location";
const PLUGIN_MANIFEST = {
	id: PLUGIN_ID,
	name: "Location Plugin",
	displayName: "Location",
	nodeType: PLUGIN_NODE_TYPE,
	version: PLUGIN_VERSION,
	description: PLUGIN_DESCRIPTION,
	extends: "folder",
	dependencies: ["folder"],
	priority: 40,
	icon: {
		mui: "LocationOn",
		emoji: "📍",
		color: "#a3b030",
		component: {
			specifier: "@hierarchidb/location-plugin/icon",
			exportName: "LocationPluginIcon"
		}
	},
	category: {
		id: "geographic",
		treeId: "*",
		menuGroup: "geo",
		createOrder: 40
	},
	tags: ["geographic", "location"],
	capabilities: {
		draft: true,
		batch: true,
		visualization: true
	},
	database: { prewarm: [{
		specifier: "@hierarchidb/location-plugin/database",
		export: "getEphemeralLocationDB"
	}] },
	worker: { preload: ["registerLocationWorkerStores", "loadLocationEntitiesDbModule"] }
};

//#endregion
//#region src/common/components/LocationPanel.tsx
const LocationPanel = ({ nodeId, onEdit }) => {
	const { translations } = useTranslation();
	const entity = useMemo(() => ({
		id: nodeId,
		nodeId,
		dataSource: "openstreetmap",
		licenseAgreement: true,
		selectionMatrix: [],
		concurrentDownloads: 2
	}), [nodeId]);
	return /* @__PURE__ */ jsxs(Grid, {
		container: true,
		direction: "column",
		wrap: "nowrap",
		sx: { height: "100%" },
		children: [/* @__PURE__ */ jsx(Paper, {
			elevation: 0,
			sx: {
				p: 2,
				borderBottom: 1,
				borderColor: "divider",
				flexShrink: 0
			},
			children: /* @__PURE__ */ jsxs(Grid, {
				container: true,
				columns: { xs: 12 },
				wrap: "nowrap",
				columnSpacing: 2,
				alignItems: "center",
				children: [/* @__PURE__ */ jsx(Grid, {
					size: { xs: 9 },
					children: /* @__PURE__ */ jsxs(Grid, {
						container: true,
						columns: { xs: 12 },
						wrap: "nowrap",
						columnSpacing: 1,
						alignItems: "center",
						children: [
							/* @__PURE__ */ jsx(Grid, {
								size: "auto",
								children: /* @__PURE__ */ jsx(LocationOn, { color: "primary" })
							}),
							/* @__PURE__ */ jsx(Grid, {
								size: "auto",
								children: /* @__PURE__ */ jsx(Typography, {
									variant: "h6",
									noWrap: true,
									children: translations.panel.sampleName
								})
							}),
							/* @__PURE__ */ jsx(Grid, {
								size: "auto",
								children: /* @__PURE__ */ jsx(Chip, {
									label: "dataset",
									size: "small"
								})
							})
						]
					})
				}), /* @__PURE__ */ jsx(Grid, {
					size: "auto",
					children: /* @__PURE__ */ jsxs(Grid, {
						container: true,
						columns: { xs: 12 },
						wrap: "nowrap",
						columnSpacing: 1,
						alignItems: "center",
						justifyContent: "flex-end",
						children: [/* @__PURE__ */ jsx(Grid, {
							size: "auto",
							children: /* @__PURE__ */ jsx(Tooltip, {
								title: translations.panel.refresh,
								children: /* @__PURE__ */ jsx(IconButton, {
									size: "small",
									children: /* @__PURE__ */ jsx(Refresh, {})
								})
							})
						}), onEdit && /* @__PURE__ */ jsx(Grid, {
							size: "auto",
							children: /* @__PURE__ */ jsx(Tooltip, {
								title: translations.panel.edit,
								children: /* @__PURE__ */ jsx(IconButton, {
									size: "small",
									onClick: onEdit,
									children: /* @__PURE__ */ jsx(Edit, {})
								})
							})
						})]
					})
				})]
			})
		}), /* @__PURE__ */ jsx(Grid, {
			container: true,
			direction: "column",
			wrap: "nowrap",
			sx: {
				flex: 1,
				overflow: "auto",
				p: 3
			},
			children: /* @__PURE__ */ jsxs(Grid, {
				container: true,
				spacing: 3,
				columns: { xs: 12 },
				children: [/* @__PURE__ */ jsx(Grid, {
					size: { xs: 12 },
					children: /* @__PURE__ */ jsxs(Paper, {
						elevation: 1,
						sx: { p: 2 },
						children: [/* @__PURE__ */ jsx(Typography, {
							variant: "subtitle1",
							gutterBottom: true,
							children: translations.panel.basicInfo
						}), /* @__PURE__ */ jsxs(List, {
							dense: true,
							children: [
								/* @__PURE__ */ jsx(ListItem, { children: /* @__PURE__ */ jsx(ListItemText, {
									primary: translations.panel.dataSource,
									secondary: entity.dataSource
								}) }),
								/* @__PURE__ */ jsx(ListItem, { children: /* @__PURE__ */ jsx(ListItemText, {
									primary: translations.panel.licenseAgreement,
									secondary: entity.licenseAgreement ? translations.panel.licenseAgreed : translations.panel.licensePending
								}) }),
								/* @__PURE__ */ jsx(ListItem, { children: /* @__PURE__ */ jsx(ListItemText, {
									primary: translations.panel.createdAt,
									secondary: "-"
								}) }),
								/* @__PURE__ */ jsx(ListItem, { children: /* @__PURE__ */ jsx(ListItemText, {
									primary: translations.panel.updatedAt,
									secondary: "-"
								}) })
							]
						})]
					})
				}), /* @__PURE__ */ jsx(Grid, {
					size: { xs: 12 },
					children: /* @__PURE__ */ jsxs(Paper, {
						elevation: 1,
						sx: { p: 2 },
						children: [/* @__PURE__ */ jsx(Typography, {
							variant: "subtitle1",
							gutterBottom: true,
							children: translations.panel.processingSettings
						}), /* @__PURE__ */ jsxs(List, {
							dense: true,
							children: [/* @__PURE__ */ jsx(ListItem, { children: /* @__PURE__ */ jsx(ListItemText, {
								primary: translations.panel.concurrentDownloads,
								secondary: entity.concurrentDownloads
							}) }), /* @__PURE__ */ jsx(ListItem, { children: /* @__PURE__ */ jsx(ListItemText, {
								primary: "Selection entries",
								secondary: entity.selectionMatrix.flat().filter(Boolean).length
							}) })]
						})]
					})
				})]
			})
		})]
	});
};

//#endregion
//#region src/common/hooks/useLocationProgress.ts
const LOCATION_NODE_TYPE = "location";
function toProgressEvent(info, fallbackSessionId) {
	if (!info) return null;
	const sessionId = info.sessionId ?? fallbackSessionId ?? "location";
	const stage = info.phase === "completed" ? "completed" : info.stage;
	return {
		sessionId,
		stage,
		total: info.total ?? 0,
		completed: info.completed ?? 0,
		failed: info.failed ?? 0,
		percentage: info.percentage ?? 0,
		currentTask: info.currentTask ?? info.message ?? stage,
		timestamp: typeof info.timestamp === "number" ? info.timestamp : Date.now(),
		message: info.message
	};
}
/**
* useLocationProgress - Subscribe to Location batch progress events via WorkerBridge.
*/
function useLocationProgress(sessionId, options = {}) {
	const { autoSubscribe = true } = options;
	const bridgeRef = useRef(getWorkerBridge());
	const [overrideProgress, setOverrideProgress] = useState(null);
	const [error, setError] = useState(null);
	useEffect(() => {
		if (!sessionId || !autoSubscribe) return;
		bridgeRef.current.initialize().catch((err) => {
			setError(err instanceof Error ? err : new Error(String(err)));
		});
	}, [autoSubscribe, sessionId]);
	useEffect(() => {
		setOverrideProgress(null);
	}, [sessionId]);
	const { progress: unifiedProgress, subscribed, subscribe: sharedSubscribe, unsubscribe: sharedUnsubscribe } = useBatchProgress(useMemo(() => {
		if (!sessionId) return null;
		return createAdapterFromProgressSubscribe((cb) => bridgeRef.current.subscribeBatchProgress(LOCATION_NODE_TYPE, sessionId, cb).then((unsubscribe$1) => {
			setError(null);
			return unsubscribe$1;
		}).catch((err) => {
			setError(err instanceof Error ? err : /* @__PURE__ */ new Error("Failed to subscribe to location batch progress"));
			return () => {};
		}));
	}, [sessionId]), { autoSubscribe });
	useEffect(() => {
		if (unifiedProgress) setOverrideProgress(null);
	}, [unifiedProgress]);
	useEffect(() => {
		const registry = AuthNotificationRegistry.getInstance?.();
		if (!registry) return;
		const id = "location-progress-hook";
		registry.register?.(id, {
			onAuthRequired: async (n) => {
				setOverrideProgress({
					sessionId: sessionId || n?.context?.sessionId || "location",
					stage: "auth-required",
					total: 1,
					completed: 0,
					failed: 0,
					percentage: 0,
					currentTask: n?.context?.errorMessage || "Authentication required",
					timestamp: Date.now(),
					message: n?.context?.errorMessage
				});
			},
			onAuthSuccess: async (_n) => {
				setOverrideProgress({
					sessionId: sessionId || "location",
					stage: "resumed",
					total: 1,
					completed: 1,
					failed: 0,
					percentage: 100,
					currentTask: "Authentication successful - resuming",
					timestamp: Date.now(),
					message: "Authentication successful - resuming"
				});
			},
			onAuthCancelled: async (n) => {
				setOverrideProgress({
					sessionId: sessionId || "location",
					stage: "cancelled",
					total: 1,
					completed: 0,
					failed: 1,
					percentage: 0,
					currentTask: n?.context?.reason || "Authentication cancelled",
					timestamp: Date.now(),
					message: n?.context?.reason
				});
			}
		});
		return () => {
			registry.unregister?.(id);
		};
	}, [sessionId]);
	const subscribe = useCallback(() => {
		bridgeRef.current.initialize().catch((err) => {
			setError(err instanceof Error ? err : new Error(String(err)));
		});
		sharedSubscribe();
	}, [sharedSubscribe]);
	const unsubscribe = useCallback(() => {
		sharedUnsubscribe();
	}, [sharedUnsubscribe]);
	return {
		progress: toProgressEvent(unifiedProgress, sessionId ?? void 0) ?? overrideProgress,
		unifiedProgress: unifiedProgress ?? null,
		isSubscribed: subscribed,
		error,
		subscribe,
		unsubscribe
	};
}

//#endregion
//#region src/ui/components/batch/BatchProgressDialog.tsx
/**
* Batch Progress Dialog
*/
const isRecord = (value) => typeof value === "object" && value !== null;
const extractThroughputMeta = (meta) => {
	if (!isRecord(meta)) return {};
	return {
		itemsPerSecond: typeof meta.itemsPerSecond === "number" ? meta.itemsPerSecond : void 0,
		bytesPerSecond: typeof meta.bytesPerSecond === "number" ? meta.bytesPerSecond : void 0
	};
};
const TabPanel = ({ children, value, index }) => {
	return /* @__PURE__ */ jsx(Box, {
		role: "tabpanel",
		hidden: value !== index,
		sx: {
			height: "100%",
			display: value === index ? "flex" : "none",
			flexDirection: "column"
		},
		children: value === index && children
	});
};
const BatchProgressDialog = ({ open, onClose, sessionId }) => {
	const [tabValue, setTabValue] = useState(0);
	const [tableId, setTableId] = useState(null);
	const datasetId = React.useMemo(() => tableId ? `location:${tableId}` : null, [tableId]);
	const { translations, locale } = useTranslation();
	const { progress: locationProgress, unifiedProgress } = useLocationProgress(sessionId, { autoSubscribe: true });
	const showAuthRequired = locationProgress?.stage === "auth-required";
	const phaseLabel = useCallback((phase) => {
		const phases = translations.batch?.phases;
		if (isRecord(phases)) {
			const label = phases[phase];
			if (typeof label === "string") return label;
		}
		return phase;
	}, [translations.batch?.phases]);
	const derivedProgress = useMemo(() => {
		const payload = unifiedProgress?.payload;
		const total = typeof payload?.total === "number" ? payload.total : locationProgress?.total ?? 0;
		const completed = typeof payload?.completed === "number" ? payload.completed : locationProgress?.completed ?? 0;
		const failed = typeof payload?.failed === "number" ? payload.failed : locationProgress?.failed ?? 0;
		const percentageRaw = unifiedProgress?.percentage ?? locationProgress?.percentage ?? 0;
		const phase = (unifiedProgress?.phase ?? locationProgress?.stage ?? "running").toLowerCase();
		const phaseText = phaseLabel(phase);
		const currentTask = unifiedProgress?.currentTask ?? payload?.currentTask ?? locationProgress?.currentTask ?? phaseText;
		const { itemsPerSecond = 0, bytesPerSecond = 0 } = extractThroughputMeta(payload?.meta);
		return {
			percentage: Math.max(0, Math.min(100, Math.round(percentageRaw))),
			phase,
			phaseLabel: phaseText,
			currentTask,
			timeElapsed: "--:--:--",
			timeRemaining: "--:--:--",
			estimatedCompletion: "--:--",
			itemsPerSecond,
			bytesPerSecond,
			completed,
			total,
			failed
		};
	}, [
		unifiedProgress,
		locationProgress,
		phaseLabel
	]);
	const stageDefinitions = useMemo(() => [
		{
			id: "download",
			label: translations.batch?.stages?.download ?? "Download"
		},
		{
			id: "filter",
			label: translations.batch?.stages?.filtering ?? "Filtering"
		},
		{
			id: "cluster",
			label: translations.batch?.stages?.clustering ?? "Clustering"
		},
		{
			id: "index",
			label: translations.batch?.stages?.indexing ?? "Indexing"
		}
	], [translations.batch?.stages]);
	const stages = useMemo(() => {
		const normalizedStage = (unifiedProgress?.stage ?? locationProgress?.stage ?? "").toLowerCase();
		const currentIndex = stageDefinitions.findIndex((stage) => normalizedStage.includes(stage.id));
		return stageDefinitions.map((stage, index) => {
			let status;
			if (currentIndex === -1) status = index === 0 ? "running" : "waiting";
			else if (index < currentIndex) status = "completed";
			else if (index === currentIndex) status = derivedProgress.phase === "failed" ? "failed" : "running";
			else status = "waiting";
			const stageProgress = index < currentIndex ? 100 : index === currentIndex ? derivedProgress.percentage : 0;
			return {
				name: stage.label,
				status,
				progress: stageProgress,
				itemsProcessed: derivedProgress.completed,
				totalItems: derivedProgress.total,
				errors: index === currentIndex ? derivedProgress.failed : 0
			};
		});
	}, [
		stageDefinitions,
		unifiedProgress,
		locationProgress,
		derivedProgress
	]);
	const activeTasks = useMemo(() => [], []);
	const logs = useMemo(() => {
		if (!locationProgress?.currentTask && !locationProgress?.message) return [];
		return [{
			timestamp: new Date(locationProgress?.timestamp ?? Date.now()),
			level: "info",
			source: "BatchWorker",
			message: locationProgress?.currentTask ?? locationProgress?.message ?? translations.batch?.logsDefault ?? "Running"
		}];
	}, [
		locationProgress?.currentTask,
		locationProgress?.message,
		locationProgress?.timestamp,
		translations.batch?.logsDefault
	]);
	const [isPaused, setIsPaused] = useState(false);
	const formatTemplate = useCallback((template, values) => template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? `{${key}}`)), []);
	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const session = await getEphemeralLocationDB().sessions?.get(sessionId) ?? null;
				if (!cancelled) setTableId(session?.tableId ?? null);
			} catch (error) {
				if (isDevEnvironment) console.warn("[BatchProgressDialog] failed to load session metadata", error);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [sessionId]);
	const handleTabChange = (_, newValue) => {
		setTabValue(newValue);
	};
	const handlePause = () => {
		setIsPaused(true);
	};
	const handleResume = () => {
		setIsPaused(false);
	};
	const handleCancel = () => {
		console.log("Cancelling batch process...");
	};
	const getStageIcon = (status) => {
		switch (status) {
			case "waiting": return /* @__PURE__ */ jsx(HourglassEmpty, { color: "disabled" });
			case "running": return /* @__PURE__ */ jsx(CircularProgress, { size: 20 });
			case "completed": return /* @__PURE__ */ jsx(CheckCircle, { color: "success" });
			case "failed": return /* @__PURE__ */ jsx(Error$1, { color: "error" });
		}
	};
	return /* @__PURE__ */ jsxs(Dialog, {
		open,
		onClose,
		maxWidth: "xl",
		fullWidth: true,
		PaperProps: { sx: {
			height: "90vh",
			display: "flex",
			flexDirection: "column"
		} },
		children: [
			/* @__PURE__ */ jsxs(DialogTitle, { children: [/* @__PURE__ */ jsxs(Box, {
				display: "flex",
				alignItems: "center",
				justifyContent: "space-between",
				children: [/* @__PURE__ */ jsx(Typography, {
					variant: "h6",
					children: translations.batch?.dialogTitle ?? "Batch Processing Progress"
				}), /* @__PURE__ */ jsxs(Box, {
					display: "flex",
					alignItems: "center",
					gap: 1,
					children: [/* @__PURE__ */ jsx(Chip, {
						label: derivedProgress.phaseLabel,
						color: "primary",
						size: "small"
					}), /* @__PURE__ */ jsx(IconButton, {
						size: "small",
						onClick: onClose,
						"aria-label": translations.common?.close ?? "Close",
						children: /* @__PURE__ */ jsx(Close, {})
					})]
				})]
			}), /* @__PURE__ */ jsxs(Box, {
				mt: 2,
				children: [
					/* @__PURE__ */ jsxs(Box, {
						display: "flex",
						justifyContent: "space-between",
						mb: 1,
						children: [/* @__PURE__ */ jsx(Typography, {
							variant: "body2",
							children: derivedProgress.currentTask
						}), /* @__PURE__ */ jsxs(Typography, {
							variant: "body2",
							children: [derivedProgress.percentage, "%"]
						})]
					}),
					/* @__PURE__ */ jsx(LinearProgress, {
						variant: "determinate",
						value: derivedProgress.percentage,
						sx: {
							height: 8,
							borderRadius: 1
						}
					}),
					/* @__PURE__ */ jsxs(Box, {
						display: "flex",
						justifyContent: "space-between",
						mt: 1,
						children: [/* @__PURE__ */ jsxs(Typography, {
							variant: "caption",
							color: "text.secondary",
							children: [
								translations.batch?.elapsed ?? "Elapsed",
								": ",
								derivedProgress.timeElapsed
							]
						}), /* @__PURE__ */ jsxs(Typography, {
							variant: "caption",
							color: "text.secondary",
							children: [
								translations.batch?.remaining ?? "Remaining",
								": ",
								derivedProgress.timeRemaining
							]
						})]
					})
				]
			})] }),
			/* @__PURE__ */ jsx(Box, {
				sx: {
					borderBottom: 1,
					borderColor: "divider"
				},
				children: /* @__PURE__ */ jsxs(Tabs, {
					value: tabValue,
					onChange: handleTabChange,
					children: [
						/* @__PURE__ */ jsx(Tab, {
							icon: /* @__PURE__ */ jsx(Timeline, {}),
							label: translations.batch?.progressTitle ?? "Progress"
						}),
						/* @__PURE__ */ jsx(Tab, {
							icon: /* @__PURE__ */ jsx(Assessment, {}),
							label: translations.batch?.logsTitle ?? "Logs"
						}),
						/* @__PURE__ */ jsx(Tab, {
							icon: /* @__PURE__ */ jsx(Map, {}),
							label: translations.batch?.mapPreviewTitle ?? "Map Preview"
						}),
						/* @__PURE__ */ jsx(Tab, {
							icon: /* @__PURE__ */ jsx(TableView, {}),
							label: translations.batch?.dataTableTitle ?? "Data Table"
						})
					]
				})
			}),
			/* @__PURE__ */ jsxs(DialogContent, {
				sx: {
					flex: 1,
					overflow: "hidden",
					p: 0
				},
				children: [
					datasetId && /* @__PURE__ */ jsx(CrossViewSnackbar, { datasetId }),
					showAuthRequired ? /* @__PURE__ */ jsx(Alert, {
						severity: "warning",
						sx: { m: 2 },
						children: `🔐 ${formatTemplate(translations.batch?.authRequired ?? "Authentication required — {message}", { message: locationProgress?.currentTask ?? translations.batch?.authFallback ?? "Authentication required to continue" })}`
					}) : null,
					/* @__PURE__ */ jsx(TabPanel, {
						value: tabValue,
						index: 0,
						children: /* @__PURE__ */ jsx(Box, {
							sx: {
								flex: 1,
								overflow: "auto",
								p: 3
							},
							children: /* @__PURE__ */ jsxs(Grid$1, {
								container: true,
								spacing: 3,
								children: [
									/* @__PURE__ */ jsx(Grid$1, {
										size: {
											xs: 12,
											md: 4
										},
										children: /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(CardContent, { children: [
											/* @__PURE__ */ jsx(Typography, {
												color: "textSecondary",
												gutterBottom: true,
												children: translations.batch?.processedLabel ?? "Processed"
											}),
											/* @__PURE__ */ jsx(Typography, {
												variant: "h4",
												color: "primary",
												children: formatNumber(derivedProgress.completed, locale)
											}),
											/* @__PURE__ */ jsx(Typography, {
												color: "textSecondary",
												children: formatTemplate(translations.batch?.processedTotal ?? "/ {total} items", { total: formatNumber(derivedProgress.total, locale) })
											})
										] }) })
									}),
									/* @__PURE__ */ jsx(Grid$1, {
										size: {
											xs: 12,
											md: 4
										},
										children: /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(CardContent, { children: [
											/* @__PURE__ */ jsx(Typography, {
												color: "textSecondary",
												gutterBottom: true,
												children: translations.batch?.throughputLabel ?? "Throughput"
											}),
											/* @__PURE__ */ jsx(Typography, {
												variant: "h4",
												color: "success.main",
												children: derivedProgress.itemsPerSecond.toFixed(1)
											}),
											/* @__PURE__ */ jsx(Typography, {
												color: "textSecondary",
												children: formatTemplate(translations.batch?.throughputUnit ?? "points/s ({rate}/s)", { rate: formatBytes(derivedProgress.bytesPerSecond, locale) })
											})
										] }) })
									}),
									/* @__PURE__ */ jsx(Grid$1, {
										size: {
											xs: 12,
											md: 4
										},
										children: /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(CardContent, { children: [
											/* @__PURE__ */ jsx(Typography, {
												color: "textSecondary",
												gutterBottom: true,
												children: translations.batch?.errorsLabel ?? "Errors"
											}),
											/* @__PURE__ */ jsx(Typography, {
												variant: "h4",
												color: "error.main",
												children: formatNumber(derivedProgress.failed, locale)
											}),
											/* @__PURE__ */ jsx(Typography, {
												color: "textSecondary",
												children: translations.batch?.errorsUnit ?? "items"
											})
										] }) })
									}),
									/* @__PURE__ */ jsxs(Grid$1, {
										size: {
											xs: 12,
											md: 6
										},
										children: [/* @__PURE__ */ jsx(Typography, {
											variant: "h6",
											gutterBottom: true,
											children: translations.batch?.stageListTitle ?? "Processing Stages"
										}), /* @__PURE__ */ jsx(Stepper, {
											orientation: "vertical",
											children: stages.map((stage) => /* @__PURE__ */ jsxs(Step, {
												active: stage.status === "running",
												children: [/* @__PURE__ */ jsx(StepLabel, {
													icon: getStageIcon(stage.status),
													error: stage.status === "failed",
													children: /* @__PURE__ */ jsxs(Box, {
														display: "flex",
														alignItems: "center",
														gap: 1,
														children: [/* @__PURE__ */ jsx(Typography, { children: stage.name }), stage.status === "running" && /* @__PURE__ */ jsx(Chip, {
															label: `${stage.progress}%`,
															size: "small",
															color: "primary"
														})]
													})
												}), /* @__PURE__ */ jsx(StepContent, { children: /* @__PURE__ */ jsxs(Box, { children: [
													/* @__PURE__ */ jsx(Typography, {
														variant: "body2",
														color: "text.secondary",
														children: formatTemplate(translations.batch?.stageProgress ?? "{completed} / {total} completed", {
															completed: formatNumber(stage.itemsProcessed, locale),
															total: formatNumber(stage.totalItems, locale)
														})
													}),
													stage.status === "running" && /* @__PURE__ */ jsx(LinearProgress, {
														variant: "determinate",
														value: stage.progress,
														sx: {
															mt: 1,
															mb: 1
														}
													}),
													stage.errors > 0 && /* @__PURE__ */ jsx(Typography, {
														variant: "body2",
														color: "error",
														children: formatTemplate(translations.batch?.stageErrors ?? "Errors: {count}", { count: formatNumber(stage.errors, locale) })
													})
												] }) })]
											}, stage.name))
										})]
									}),
									/* @__PURE__ */ jsxs(Grid$1, {
										size: {
											xs: 12,
											md: 6
										},
										children: [/* @__PURE__ */ jsx(Typography, {
											variant: "h6",
											gutterBottom: true,
											children: translations.batch?.tasksTitle ?? "Active Tasks"
										}), /* @__PURE__ */ jsx(List, { children: activeTasks.length === 0 ? /* @__PURE__ */ jsx(ListItem, { children: /* @__PURE__ */ jsx(ListItemText, {
											primary: translations.batch?.tasksEmpty ?? "No active tasks at the moment",
											secondary: translations.batch?.tasksEmptyHint ?? "Tasks will appear here while the batch is running"
										}) }) : activeTasks.map((task) => /* @__PURE__ */ jsxs(ListItem, {
											divider: true,
											children: [/* @__PURE__ */ jsx(ListItemIcon, { children: task.status === "running" ? /* @__PURE__ */ jsx(CircularProgress, { size: 20 }) : task.status === "failed" ? /* @__PURE__ */ jsx(Error$1, { color: "error" }) : /* @__PURE__ */ jsx(Warning, { color: "warning" }) }), /* @__PURE__ */ jsx(ListItemText, {
												primary: /* @__PURE__ */ jsxs(Box, {
													display: "flex",
													alignItems: "center",
													gap: 1,
													children: [/* @__PURE__ */ jsxs(Typography, {
														variant: "body2",
														children: [
															"Worker ",
															task.worker,
															": ",
															task.target
														]
													}), /* @__PURE__ */ jsx(Chip, {
														label: task.status,
														size: "small",
														color: task.status === "running" ? "success" : task.status === "retrying" ? "warning" : "error"
													})]
												}),
												secondary: /* @__PURE__ */ jsxs(Box, { children: [/* @__PURE__ */ jsx(LinearProgress, {
													variant: "determinate",
													value: task.progress,
													sx: { mb: .5 }
												}), /* @__PURE__ */ jsxs(Typography, {
													variant: "caption",
													color: "text.secondary",
													children: [
														task.progress,
														"% | ",
														task.speed,
														" | ETA: ",
														task.eta
													]
												})] })
											})]
										}, task.id)) })]
									})
								]
							})
						})
					}),
					/* @__PURE__ */ jsx(TabPanel, {
						value: tabValue,
						index: 1,
						children: /* @__PURE__ */ jsx(Box, {
							sx: {
								flex: 1,
								overflow: "auto",
								p: 3
							},
							children: /* @__PURE__ */ jsx(List, { children: logs.length === 0 ? /* @__PURE__ */ jsx(ListItem, { children: /* @__PURE__ */ jsx(ListItemText, { primary: translations.batch?.logsEmpty ?? "No log entries yet" }) }) : logs.map((log, index) => /* @__PURE__ */ jsxs(ListItem, {
								divider: true,
								children: [/* @__PURE__ */ jsx(ListItemIcon, { children: log.level === "error" ? /* @__PURE__ */ jsx(Error$1, { color: "error" }) : log.level === "warning" ? /* @__PURE__ */ jsx(Warning, { color: "warning" }) : /* @__PURE__ */ jsx(CheckCircle, { color: "success" }) }), /* @__PURE__ */ jsx(ListItemText, {
									primary: log.message,
									secondary: `${log.timestamp.toLocaleTimeString(locale === "ja" ? "ja-JP" : "en-US")} - ${log.source}`
								})]
							}, index)) })
						})
					}),
					/* @__PURE__ */ jsx(TabPanel, {
						value: tabValue,
						index: 2,
						children: /* @__PURE__ */ jsx(Box, {
							sx: {
								flex: 1,
								display: "flex",
								alignItems: "center",
								justifyContent: "center"
							},
							children: /* @__PURE__ */ jsx(Alert, {
								severity: "info",
								children: translations.batch?.mapPlaceholder ?? "Map preview will be added in a future implementation"
							})
						})
					}),
					/* @__PURE__ */ jsx(TabPanel, {
						value: tabValue,
						index: 3,
						children: /* @__PURE__ */ jsx(Box, {
							sx: {
								flex: 1,
								minHeight: 360
							},
							children: /* @__PURE__ */ jsx(TabularPreview, {
								pluginId: "location",
								tableId: tableId || void 0
							})
						})
					})
				]
			}),
			/* @__PURE__ */ jsx(DialogActions, { children: /* @__PURE__ */ jsx(Button, {
				onClick: onClose,
				children: translations.batch?.close ?? "Close"
			}) }),
			/* @__PURE__ */ jsxs(SpeedDial, {
				ariaLabel: translations.batch?.ariaLabel ?? "Batch processing actions",
				sx: {
					position: "absolute",
					bottom: 16,
					right: 16
				},
				icon: /* @__PURE__ */ jsx(SpeedDialIcon, {}),
				direction: "up",
				children: [
					/* @__PURE__ */ jsx(SpeedDialAction, {
						icon: isPaused ? /* @__PURE__ */ jsx(PlayArrow, {}) : /* @__PURE__ */ jsx(Pause, {}),
						tooltipTitle: isPaused ? translations.batch?.resumeTooltip ?? "Resume" : translations.batch?.pauseTooltip ?? "Pause",
						onClick: isPaused ? handleResume : handlePause
					}),
					/* @__PURE__ */ jsx(SpeedDialAction, {
						icon: /* @__PURE__ */ jsx(Stop, {}),
						tooltipTitle: translations.batch?.cancelTooltip ?? "Cancel",
						onClick: handleCancel
					}),
					/* @__PURE__ */ jsx(SpeedDialAction, {
						icon: /* @__PURE__ */ jsx(Download, {}),
						tooltipTitle: translations.batch?.exportTooltip ?? "Export logs",
						onClick: () => console.log("Export logs")
					})
				]
			})
		]
	});
};

//#endregion
export { BatchProgressDialog, LocationBatchManager, LocationBatchSessionManager, LocationMapPreview, LocationPanel, PLUGIN_MANIFEST as LocationPluginManifest, LocationSelectionStep, LocationTableQueryService, LocationVectorTileService, UnifiedLocationBatchManager, appendLocationPoints, clearLocationPoints, createLocationBatchManager, deleteLocationPoints, getEphemeralLocationDB, isLocationBatchAPIV2Enabled, listLocationPoints, replaceLocationPoints, worker_exports as worker };
//# sourceMappingURL=index.js.map