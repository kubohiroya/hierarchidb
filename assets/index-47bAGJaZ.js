import { a as mergeBatchConfig, i as generateUrlMetadata, l as validateBatchConfig, r as calculateSelectionStats, t as metadataLoader } from "../MetadataLoader.js";
import { i as shapeDB, n as getEphemeralShapeDB, o as DEFAULT_PROCESSING_CONFIG, s as SHAPE_DATA_SOURCES } from "../EphemeralShapeDB.js";
import { a as ShapeMetadata, n as createShapeBatchManager } from "../UnifiedShapeBatchManager.js";
import "../RuntimeWorkerClient.js";
import { n as registerShapeWorkerStores, t as loadShapeEntitiesDbModule } from "../registerShapeWorkerStores.js";
import { CoreDB } from "@hierarchidb/runtime-worker";

//#region src/worker/getBatchTaskSummaries.ts
const toSummaryStatus = (status) => {
	if (status === "waiting") return "waiting";
	return status;
};
async function getBatchTaskSummaries(sessionId) {
	return (await shapeDB.getBatchTasks(sessionId)).map((task) => ({
		taskId: task.taskId,
		stage: task.taskType,
		status: toSummaryStatus(task.status),
		progress: task.progress ?? 0,
		message: task.message ?? task.errorMessage,
		startedAt: task.startedAt,
		completedAt: task.completedAt
	}));
}

//#endregion
//#region src/worker/handlers/ShapeEntityService.ts
const isRecord = (value) => typeof value === "object" && value !== null;
var ShapeEntityService = class {
	coreDBPromise;
	constructor(coreDB) {
		this.coreDBPromise = coreDB ? Promise.resolve(coreDB) : CoreDB.getSingleton();
	}
	async ensureCoreDB() {
		return this.coreDBPromise;
	}
	async getEntity(nodeId) {
		const node = await (await this.ensureCoreDB()).getNode(nodeId);
		if (!node) return null;
		const targetValue = node[node.draftData !== null && typeof node.draftData !== "undefined" ? "draftData" : "data"];
		if (isRecord(targetValue)) return targetValue;
		return null;
	}
	async updateEntity(nodeId, updates) {
		const coreDB = await this.ensureCoreDB();
		const node = await coreDB.getNode(nodeId);
		if (!node) throw new Error(`TreeNode not found: ${nodeId}`);
		const targetField = node.draftData !== null && typeof node.draftData !== "undefined" ? "draftData" : "data";
		const targetValue = node[targetField];
		const updated = {
			...isRecord(targetValue) ? targetValue : {},
			...updates
		};
		await coreDB.updateNode({
			id: nodeId,
			[targetField]: updated
		});
	}
	async updateProcessingStatus(nodeId, status, batchSessionId) {
		const coreDB = await this.ensureCoreDB();
		const node = await coreDB.getNode(nodeId);
		if (!node) throw new Error(`TreeNode not found: ${nodeId}`);
		const targetField = node.draftData !== null && typeof node.draftData !== "undefined" ? "draftData" : "data";
		const targetValue = node[targetField];
		const updated = {
			...isRecord(targetValue) ? targetValue : {},
			processingStatus: status,
			...batchSessionId !== void 0 ? { batchSessionId } : {}
		};
		await coreDB.updateNode({
			id: nodeId,
			[targetField]: updated
		});
	}
	async getProcessingStats(nodeId) {
		console.debug("[shapeEntityService] getProcessingStats not implemented; returning defaults", { nodeId });
		return {
			featureCount: 0,
			tileCount: 0,
			storageUsed: 0
		};
	}
};

//#endregion
//#region src/worker/api.ts
const batchSessionManager = createShapeBatchManager();
const batchManagerWithDispatch = batchSessionManager;
const getBatchSessionIdFromDraft = (draft) => draft?.batchSessionId ?? draft?.draftData?.batchSessionId;
const buildBatchSessionConfig = (config, draft) => {
	const downloadConfig = config.downloadConfig ?? DEFAULT_PROCESSING_CONFIG.downloadConfig;
	const simplificationConfig = config.simplificationConfig ?? DEFAULT_PROCESSING_CONFIG.simplificationConfig;
	const tileConfig = config.tileConfig ?? DEFAULT_PROCESSING_CONFIG.tileConfig;
	const cleanupConfig = config.cleanupConfig ?? DEFAULT_PROCESSING_CONFIG.cleanupConfig;
	const resolvedDataSource = config.dataSource ?? toDataSourceName(draft?.draftData?.batchConfig?.dataSource ?? "naturalearth");
	return {
		corsProxyBaseURL: downloadConfig?.corsProxyUrl ?? "",
		dataSource: resolvedDataSource,
		download: {
			concurrentDownloads: downloadConfig?.maxConcurrent ?? 4,
			deleteOnComplete: cleanupConfig?.deleteDownloadedFiles ?? false,
			timeoutMs: downloadConfig?.timeoutMs,
			retryAttempts: downloadConfig?.retryAttempts ?? 3,
			retryDelay: downloadConfig?.retryDelay
		},
		simplify1: {
			concurrentProcesses: simplificationConfig?.level1Workers ?? 2,
			enableFeatureFiltering: true,
			featureAreaThreshold: simplificationConfig?.areaThreshold ?? .5,
			minVertexCountForAreaFilter: simplificationConfig?.minVertexCountForAreaFilter ?? 25,
			aspectRatioThreshold: simplificationConfig?.aspectRatioThreshold ?? 5,
			featureFilterMethod: simplificationConfig?.featureFilterMethod ?? "hybrid",
			hybridFilterConfig: simplificationConfig?.hybridFilterConfig ?? DEFAULT_PROCESSING_CONFIG.simplificationConfig?.hybridFilterConfig,
			deleteOnComplete: false
		},
		simplify2: {
			concurrentProcesses: simplificationConfig?.level2Workers ?? 2,
			enablePerFeatureSimplification: simplificationConfig?.enablePerFeatureSimplification ?? true,
			deleteOnComplete: false,
			quantize: simplificationConfig?.quantize ?? 0,
			simplify: simplificationConfig?.tolerance ?? 0,
			tolerance: simplificationConfig?.tolerance ?? 0
		},
		vectorTiles: {
			concurrentProcesses: tileConfig?.workers ?? 2,
			minZoom: tileConfig?.minZoom ?? 0,
			maxZoom: tileConfig?.maxZoom ?? 14,
			bufferSize: tileConfig?.bufferSize,
			tileSize: tileConfig?.tileSize
		}
	};
};
const progressCallbacks = /* @__PURE__ */ new Map();
const progressSessionMeta = /* @__PURE__ */ new Map();
const shapeEntityHandlerSingleton = new ShapeEntityService();
const getShapeEntityHandler = () => shapeEntityHandlerSingleton;
const getOrCreateSessionMeta = (sessionId) => {
	let meta = progressSessionMeta.get(sessionId);
	if (!meta) {
		meta = {};
		progressSessionMeta.set(sessionId, meta);
	}
	return meta;
};
const mapStageToBatchStage = (stage) => {
	switch (stage) {
		case "simplify1": return "simplify1";
		case "simplify2": return "simplify2";
		case "vectortile":
		case "vectorTiles": return "vectorTiles";
		case "download":
		default: return "download";
	}
};
const mapStageToProcessingStage = (stage) => mapStageToBatchStage(stage);
const mapManagerStatusToShapeStatus = (status) => {
	switch (status) {
		case "paused": return "paused";
		case "completed": return "completed";
		case "failed": return "failed";
		case "cancelled": return "cancelled";
		case "running":
		case "idle":
		default: return "running";
	}
};
const isSessionNotFoundError = (error) => error instanceof Error && /session .*not found/i.test(error.message);
const getBatchSessionStatusSafe = async (sessionId) => {
	try {
		return {
			status: await batchSessionManager.getBatchSessionStatus(sessionId),
			missing: false
		};
	} catch (error) {
		if (isSessionNotFoundError(error)) return { missing: true };
		return {
			missing: false,
			error
		};
	}
};
const mapProgressToStatus = (progress) => {
	if (progress.failed > 0) return "failed";
	if (progress.total > 0 && progress.completed >= progress.total) return "completed";
	return "running";
};
const mapTaskStatusToStage = (status) => {
	switch (status) {
		case "waiting": return "wait";
		case "running": return "process";
		case "completed": return "success";
		case "failed": return "error";
		case "cancelled": return "cancel";
		default: return;
	}
};
const buildTaskTitle = (task) => {
	const input = task.inputData ?? {};
	const getNumber = (value) => typeof value === "number" && Number.isFinite(value) ? value : void 0;
	if (task.taskType === "download") return input.url ?? input.endpoint;
	if (task.taskType === "simplify1" || task.taskType === "simplify2") {
		const sourceUrl = input.sourceUrl ?? input.url;
		const featureId = input.featureId;
		if (sourceUrl && featureId) return `${sourceUrl} • ${featureId}`;
		return sourceUrl ?? featureId;
	}
	if (task.taskType === "vectortile") {
		const minZoom = getNumber(input.minZoom);
		const maxZoom = getNumber(input.maxZoom);
		const tileX = getNumber(input.tileX);
		const tileY = getNumber(input.tileY);
		if (typeof tileX === "number" && typeof tileY === "number") {
			if (typeof minZoom === "number" && typeof maxZoom === "number") return `z${minZoom}-${maxZoom} / x${tileX} y${tileY}`;
			return `x${tileX} y${tileY}`;
		}
		if (typeof minZoom === "number" && typeof maxZoom === "number") return `z${minZoom}-${maxZoom}`;
	}
};
const mapTaskRecordToBatchTask = (task) => ({
	taskId: task.taskId,
	taskType: task.taskType,
	stage: mapTaskStatusToStage(task.status),
	sessionId: task.sessionId,
	status: task.status,
	index: task.index,
	progress: task.progress,
	startedAt: task.startedAt,
	completedAt: task.completedAt,
	retryCount: task.retryCount,
	metadata: task.inputData,
	config: task.outputData,
	error: task.errorMessage,
	title: buildTaskTitle(task)
});
const buildBatchProgressEvent = (sessionId, progress, meta) => {
	const status = mapProgressToStatus(progress);
	return {
		sessionId,
		treeNodeId: meta.treeNodeId ?? sessionId,
		stage: mapStageToBatchStage(progress.currentStage),
		status,
		progress: Math.round(progress.percentage ?? 0),
		completedTasks: progress.completed,
		totalTasks: progress.total,
		currentTask: progress.currentTask ?? "",
		message: progress.currentTask,
		timestamp: Date.now(),
		type: status === "completed" ? "complete" : status === "failed" ? "error" : "progress"
	};
};
const batchEventToProgressInfo = (event) => {
	const payload = event.payload ?? {};
	const total = payload.total ?? 0;
	const completed = payload.completed ?? 0;
	const failed = payload.failed ?? 0;
	const skipped = payload.skipped ?? Math.max(total - completed - failed, 0);
	const percentageFromPayload = payload.meta?.percentage;
	return {
		total,
		completed,
		failed,
		skipped,
		percentage: typeof percentageFromPayload === "number" ? percentageFromPayload : total > 0 ? Math.round(completed / total * 100) : 0,
		currentStage: mapStageToProcessingStage(event.stage),
		currentTask: payload.currentTask ?? event.message
	};
};
const hydrateSessionMeta = async (sessionId) => {
	const meta = getOrCreateSessionMeta(sessionId);
	if (meta.treeNodeId) return;
	try {
		const record = await getEphemeralShapeDB().sessions.get(sessionId);
		if (record?.nodeId) meta.treeNodeId = record.nodeId;
	} catch (error) {
		console.warn("[shapePluginAPI] Failed to hydrate session metadata", error);
	}
};
const shapePluginAPI = {
	getDataSourceConfigs: async () => {
		return SHAPE_DATA_SOURCES;
	},
	getCountryMetadata: async (dataSource) => {
		try {
			const data = await metadataLoader.loadMetadata(toDataSourceName(dataSource));
			if (Array.isArray(data) && data.length > 0) return data;
		} catch (err) {
			console.error("Failed to load country metadata for data source:", dataSource, err);
		}
		return [{
			countryCode: "US",
			countryName: "United States",
			continent: "North America",
			availableAdminLevels: [
				0,
				1,
				2
			]
		}, {
			countryCode: "JP",
			countryName: "Japan",
			continent: "Asia",
			availableAdminLevels: [
				0,
				1,
				2
			]
		}];
	},
	generateUrlMetadata: async (dataSource, countries, adminLevels) => {
		const dataSourceName = toDataSourceName(dataSource);
		return generateUrlMetadata(dataSourceName, countries, adminLevels, await shapePluginAPI.getCountryMetadata(dataSourceName));
	},
	validateSelection: async (countries, adminLevels, dataSource) => {
		const errors = [];
		const warnings = [];
		const dataSourceName = toDataSourceName(dataSource);
		if (countries.length === 0) errors.push("At least one country must be selected");
		if (adminLevels.length === 0) errors.push("At least one administrative level must be selected");
		if (!SHAPE_DATA_SOURCES.find((ds) => ds.name === dataSourceName)) errors.push("Invalid data source selected");
		if (countries.length > 10) warnings.push("Large country selection may require significant processing time");
		return {
			isValid: errors.length === 0,
			errors: errors.length > 0 ? errors : void 0,
			warnings: warnings.length > 0 ? warnings : void 0
		};
	},
	calculateSelectionStats: async (urlMetadata) => {
		return calculateSelectionStats(urlMetadata);
	},
	startBatchProcessing: async (draftId, config, urlMetadata, progressCallback) => {
		const validation = validateBatchConfig(config);
		if (!validation.isValid) throw new Error(`Invalid processing config: ${validation.errors?.join(", ")}`);
		const handler = getShapeEntityHandler();
		const draftLike = await handler.getEntity(draftId);
		if (!draftLike) throw new Error(`Working copy not found: ${draftId}`);
		const downloadConfig = config.downloadConfig ?? DEFAULT_PROCESSING_CONFIG.downloadConfig;
		const baseConfig = buildBatchSessionConfig(config, draftLike);
		const batchConfig = {
			...baseConfig,
			workerTimeout: downloadConfig?.timeoutMs,
			workerRetries: downloadConfig?.retryAttempts ?? 3,
			retryDelay: downloadConfig?.retryDelay,
			minZoom: baseConfig.vectorTiles?.minZoom,
			maxZoom: baseConfig.vectorTiles?.maxZoom
		};
		const batchSessionData = { urlMetadata };
		const sessionOptions = {
			maxConcurrentTasks: void 0,
			retryAttempts: downloadConfig?.retryAttempts ?? 3,
			retryDelay: downloadConfig?.retryDelay,
			timeoutMs: downloadConfig?.timeoutMs,
			enableResourceTracking: false
		};
		const managerWithPrepare = batchSessionManager;
		const nodeForSession = draftLike.nodeId ?? draftLike.treeNodeId ?? draftId;
		managerWithPrepare.prepareSession?.(nodeForSession, batchConfig, batchSessionData, sessionOptions);
		const sessionId = await batchSessionManager.startBatchSession(nodeForSession);
		const sessionMeta = getOrCreateSessionMeta(sessionId);
		sessionMeta.treeNodeId = nodeForSession;
		if (progressCallback) {
			progressCallbacks.get(sessionId)?.unsubscribe?.();
			const unsubscribe = batchSessionManager.onBatchProgress(sessionId, (event) => {
				progressCallback(buildBatchProgressEvent(sessionId, batchEventToProgressInfo(event), sessionMeta));
			});
			progressCallbacks.set(sessionId, { unsubscribe });
		}
		await handler.updateEntity(draftId, { batchSessionId: sessionId });
		return sessionId;
	},
	pauseBatchProcessing: async (draftId) => {
		const entity = await getShapeEntityHandler().getEntity(draftId);
		const batchSessionId = getBatchSessionIdFromDraft(entity);
		if (!entity || !batchSessionId) throw new Error(`No active batch session for draft: ${draftId}`);
		await batchManagerWithDispatch.dispatchCommand?.("session/pause", { sessionId: batchSessionId });
	},
	resumeBatchProcessing: async (draftId) => {
		const entity = await getShapeEntityHandler().getEntity(draftId);
		const batchSessionId = getBatchSessionIdFromDraft(entity);
		if (!entity || !batchSessionId) throw new Error(`No batch session to resume for draft: ${draftId}`);
		await batchManagerWithDispatch.dispatchCommand?.("session/resume", { sessionId: batchSessionId });
		return batchSessionId;
	},
	cancelBatchProcessing: async (draftId) => {
		const handler = getShapeEntityHandler();
		const entity = await handler.getEntity(draftId);
		const batchSessionId = getBatchSessionIdFromDraft(entity);
		if (!entity || !batchSessionId) throw new Error(`No active batch session for draft: ${draftId}`);
		await batchManagerWithDispatch.dispatchCommand?.("session/cancel", { sessionId: batchSessionId });
		progressCallbacks.get(batchSessionId)?.unsubscribe?.();
		progressCallbacks.delete(batchSessionId);
		progressSessionMeta.delete(batchSessionId);
		await handler.updateEntity(draftId, { batchSessionId: void 0 });
	},
	invokeBatchCommand: async (command, payload) => {
		await batchManagerWithDispatch.dispatchCommand?.(command, payload);
	},
	getBatchSession: async (sessionId) => {
		try {
			const { status, missing, error } = await getBatchSessionStatusSafe(sessionId);
			if (!status) {
				if (!missing && error) console.warn("[shapePluginAPI] failed to fetch batch session", error);
				return;
			}
			const nodeId = status.nodeId;
			const entity = await getShapeEntityHandler().getEntity(nodeId);
			const config = buildBatchSessionConfig(mergeBatchConfig(entity?.batchConfig ?? DEFAULT_PROCESSING_CONFIG), { draftData: entity ?? void 0 });
			const progress = status.progress ?? {
				total: 0,
				completed: 0,
				failed: 0,
				percentage: 0
			};
			const normalizedStatus = mapManagerStatusToShapeStatus(status.status);
			return {
				sessionId: status.sessionId,
				draftId: nodeId,
				nodeId,
				status: normalizedStatus,
				config,
				startedAt: status.startedAt ?? Date.now(),
				updatedAt: status.lastActivity ?? status.startedAt ?? Date.now(),
				completedAt: status.completedAt,
				progress: {
					total: progress.total ?? 0,
					completed: progress.completed ?? 0,
					failed: progress.failed ?? 0,
					skipped: progress.skipped ?? 0,
					percentage: progress.percentage ?? 0,
					currentStage: mapStageToProcessingStage(progress.currentStage),
					currentTask: progress.currentTask
				},
				canResume: normalizedStatus === "paused",
				lastActivity: status.lastActivity ?? status.startedAt ?? Date.now(),
				expiresAt: status.lastActivity ?? Date.now(),
				stages: {},
				resourceUsage: void 0
			};
		} catch (error) {
			if (!isSessionNotFoundError(error)) console.warn("[shapePluginAPI] failed to fetch batch session", error);
			return;
		}
	},
	getBatchTasks: async (sessionId) => {
		return (await shapeDB.getBatchTasks(sessionId)).map(mapTaskRecordToBatchTask);
	},
	getBatchProgress: async (draftId) => {
		const entity = await getShapeEntityHandler().getEntity(draftId);
		const batchSessionId = getBatchSessionIdFromDraft(entity);
		if (!entity || !batchSessionId) return {
			total: 0,
			completed: 0,
			failed: 0,
			skipped: 0,
			percentage: 0
		};
		try {
			const progress = (await batchSessionManager.getBatchSessionStatus(batchSessionId)).progress ?? {
				total: 0,
				completed: 0,
				failed: 0,
				percentage: 0
			};
			return {
				total: progress.total ?? 0,
				completed: progress.completed ?? 0,
				failed: progress.failed ?? 0,
				skipped: progress.skipped ?? 0,
				percentage: progress.percentage ?? 0,
				currentStage: mapStageToProcessingStage(progress.currentStage),
				currentTask: progress.currentTask
			};
		} catch {
			return {
				total: 0,
				completed: 0,
				failed: 0,
				skipped: 0,
				percentage: 0
			};
		}
	},
	getBatchStatus: async (sessionId) => {
		try {
			const status = await batchSessionManager.getBatchSessionStatus(sessionId);
			const normalizedStatus = mapManagerStatusToShapeStatus(status.status);
			return {
				sessionId,
				draftId: status.nodeId,
				status: normalizedStatus,
				progress: status.progress?.percentage,
				completedTasks: status.progress?.completed,
				totalTasks: status.progress?.total
			};
		} catch (error) {
			console.warn("[shapePluginAPI] failed to fetch batch status", error);
			return {
				sessionId,
				status: "idle"
			};
		}
	},
	findPendingBatchSessions: async (nodeId) => {
		console.log(`Finding pending batch sessions for node: ${nodeId}`);
		return [];
	},
	getBatchSessionStatus: async (sessionId) => {
		try {
			const status = await batchSessionManager.getBatchSessionStatus(sessionId);
			const lastActivity = status.lastActivity ?? status.startedAt ?? Date.now();
			return {
				exists: true,
				canResume: mapManagerStatusToShapeStatus(status.status) === "paused",
				lastActivity,
				expiresAt: lastActivity + 300 * 1e3
			};
		} catch {
			return {
				exists: false,
				canResume: false,
				lastActivity: 0,
				expiresAt: 0
			};
		}
	},
	performCleanup: async () => {
		console.log("Performing draft cleanup (mock)");
		return {
			workingCopiesRemoved: 0,
			batchSessionsRemoved: 0,
			totalSpaceRecovered: 0,
			timestamp: Date.now()
		};
	},
	getCleanupStats: async () => {
		console.log("Getting cleanup statistics (mock)");
		return {
			totalDrafts: 0,
			expiredDrafts: 0,
			totalBatchSessions: 0,
			expiredBatchSessions: 0,
			estimatedSpaceUsed: 0,
			lastCleanupAt: Date.now()
		};
	},
	subscribeToProgress: (sessionId, callback) => {
		const sessionMeta = getOrCreateSessionMeta(sessionId);
		if (!sessionMeta.treeNodeId) hydrateSessionMeta(sessionId);
		progressCallbacks.get(sessionId)?.unsubscribe?.();
		const unsubscribe = batchSessionManager.onBatchProgress(sessionId, (event) => {
			callback(buildBatchProgressEvent(sessionId, batchEventToProgressInfo(event), sessionMeta));
		});
		progressCallbacks.set(sessionId, { unsubscribe });
		return () => {
			progressCallbacks.get(sessionId)?.unsubscribe?.();
			progressCallbacks.delete(sessionId);
		};
	},
	forceCleanup: async () => {
		console.log("Force cleaning all transient data (mock)");
		return {
			workingCopiesRemoved: 0,
			batchSessionsRemoved: 0,
			totalSpaceRecovered: 0,
			timestamp: Date.now()
		};
	},
	getProcessedFeatureCount: async (nodeId) => {
		console.log(`Getting processed feature count for node: ${nodeId}`);
		return 0;
	},
	getVectorTileInfo: async (nodeId, z, x, y) => {
		console.log(`Getting vector tile info for node: ${nodeId}, z: ${z}, x: ${x}, y: ${y}`);
	},
	getProcessingStatus: async (nodeId) => {
		const handler = getShapeEntityHandler();
		const entity = await handler.getEntity(nodeId);
		if (!entity) return {
			status: "idle",
			hasErrors: false,
			errorMessages: []
		};
		if (entity.batchSessionId) {
			const { status, missing, error } = await getBatchSessionStatusSafe(entity.batchSessionId);
			if (missing) await handler.updateEntity(nodeId, { batchSessionId: void 0 });
			else if (error) console.warn("[shapePluginAPI] failed to fetch batch session status", error);
			else if (status) {
				const normalizedStatus = mapManagerStatusToShapeStatus(status.status);
				return {
					status: normalizedStatus === "running" ? "processing" : normalizedStatus === "completed" ? "completed" : normalizedStatus === "failed" ? "failed" : "idle",
					lastProcessed: status.lastActivity ?? status.startedAt,
					hasErrors: normalizedStatus === "failed",
					errorMessages: normalizedStatus === "failed" ? ["Batch processing failed"] : [],
					totalFeatures: void 0,
					totalVectorTiles: void 0,
					storageUsed: void 0
				};
			}
		}
		return {
			status: entity.processingStatus || "idle",
			lastProcessed: void 0,
			totalFeatures: void 0,
			totalVectorTiles: void 0,
			storageUsed: void 0,
			hasErrors: false,
			errorMessages: []
		};
	},
	cleanupProcessingData: async (nodeId) => {
		console.log(`Cleaning up processing data for node: ${nodeId}`);
	}
};
function toDataSourceName(value) {
	if (isDataSourceName(value)) return value;
	const normalized = value.trim().toLowerCase();
	if (isDataSourceName(normalized)) return normalized;
	console.warn("[shape-plugin] Unknown data source name:", value, "—fallback to naturalearth");
	return "naturalearth";
}
function isDataSourceName(value) {
	return value === "naturalearth" || value === "geoboundaries" || value === "gadm" || value === "openstreetmap";
}

//#endregion
//#region src/worker/plugin.ts
/**
* Shape Worker Plugin Definition
* Worker environment plugin registration
*/
/**
* Worker Plugin definition for Shape plugin
* Exports API implementation and entity handler for Worker environment
*/
const shapeEntityHandlerInstance = new ShapeEntityService();
const ShapeWorkerPlugin = {
	metadata: ShapeMetadata,
	api: shapePluginAPI,
	entityHandler: shapeEntityHandlerInstance,
	database: {
		tableName: "shapes",
		schema: "&id, nodeId, name, dataSourceName, processingStatus, createdAt, updatedAt",
		version: 1,
		additionalTables: {
			shapeBatchSessions: "&sessionId, nodeId, status, startedAt, updatedAt",
			shapeBatchTasks: "&taskId, sessionId, taskType, stage, progress",
			shapeFeatures: "&featureId, nodeId, countryCode, adminLevel, geometry",
			shapeVectorTiles: "&tileId, nodeId, z, x, y, data, size",
			shapeCache: "&cacheKey, nodeId, cacheType, data, size, createdAt"
		}
	},
	validation: { validateEntity: async (entity) => {
		const errors = [];
		if (!entity.batchConfig?.dataSource) errors.push("Data source is required");
		if (!entity.batchConfig) errors.push("Processing configuration is required");
		return {
			isValid: errors.length === 0,
			errors: errors.length > 0 ? errors : void 0
		};
	} },
	lifecycle: {
		afterCreate: async (_nodeId, _entity) => {},
		beforeDelete: async (nodeId, entity) => {
			if (entity.batchSessionId) await shapePluginAPI.cancelBatchProcessing(nodeId);
			await shapePluginAPI.cleanupProcessingData(nodeId);
		},
		afterUpdate: async (_nodeId, _entity, _changes) => {}
	}
};

//#endregion
export { ShapeWorkerPlugin, getBatchTaskSummaries, loadShapeEntitiesDbModule, registerShapeWorkerStores, shapePluginAPI };
//# sourceMappingURL=index.js.map