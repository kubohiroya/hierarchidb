import { _ as ShapeMetadata, a as formatDuration, c as generateUrlMetadata, d as normalizeDataSourceName, f as parseCheckboxState, g as validateShapeName, h as validateProcessingConfig, i as formatBytes, l as mapWorkingCopyToUpdates, m as summarizeCheckboxState, n as calculateSelectionStats, o as generateSessionId, p as serializeCheckboxState, r as createWorkingCopyFromEntity, s as generateTaskId, t as buildShapeEntityFromCreate, u as mergeProcessingConfig, v as BatchTaskStage } from "./shared.js";
import { a as SHAPE_PLUGIN_ID, i as SHAPE_LEVELS, n as DEFAULT_DATA_SOURCES, o as STORAGE_CONSTANTS, r as DEFAULT_PROCESSING_CONFIG, s as UI_CONSTANTS, t as BATCH_CONSTANTS } from "./constants.js";
import { n as ShapeDB, r as shapeDB, t as EphemeralShapeDB } from "./services.js";
import "./createShapeTabularApi.js";
import { t as getShapeRuntimeWorkerClient } from "./RuntimeWorkerClient.js";
import { TabularQueryService as ShapeTableQueryService } from "@hierarchidb/tabular-store";
import { isBatchControlAPIV2Enabled } from "@hierarchidb/common-api";
import { useCallback, useEffect, useState } from "react";

//#region src/plugin-manifest.ts
const PLUGIN_ID = "@hierarchidb/shape-plugin";
const PLUGIN_VERSION = "0.1.0";
const PLUGIN_DESCRIPTION = "Geographic shape data management plugin for HierarchiDB";
const PLUGIN_NODE_TYPE = "shape";
const PLUGIN_MANIFEST = {
	id: PLUGIN_ID,
	name: "Shape Plugin",
	displayName: "Shape",
	nodeType: PLUGIN_NODE_TYPE,
	version: PLUGIN_VERSION,
	description: PLUGIN_DESCRIPTION,
	extends: "folder",
	priority: 800,
	dependencies: ["folder"],
	icon: {
		mui: "Hexagon",
		emoji: "♦️",
		color: "#a3b030",
		component: {
			specifier: "@hierarchidb/shape-plugin/icon",
			exportName: "ShapePluginIcon"
		}
	},
	category: {
		id: "geographic",
		menuGroup: "geo",
		createOrder: 800
	},
	capabilities: {
		canHaveChildren: false,
		canBeRoot: false,
		canBeDeleted: true,
		canBeRenamed: true,
		canBeMoved: true,
		canBeCopied: false,
		supportsBatchProcessing: true
	},
	schema: {
		inherits: "folder",
		fields: [
			{
				name: "dataSourceName",
				type: "string",
				required: true
			},
			{
				name: "selectedCountries",
				type: "array",
				required: true
			},
			{
				name: "selectedAdminLevels",
				type: "array",
				required: true
			},
			{
				name: "licenseAgreement",
				type: "boolean",
				required: true
			}
		]
	},
	database: { prewarm: [{
		specifier: "@hierarchidb/shape-plugin",
		export: "ShapeDB"
	}] },
	worker: { preload: ["registerShapeWorkerStores", "loadShapeEntitiesDbModule"] }
};

//#endregion
//#region ../../packages/features/batch/dist/index.js
/**
* BatchService offers lightweight parallel map semantics with backpressure.
*/
var BatchService = class {
	async mapChunks(source, fn, options = {}) {
		const concurrency = Math.max(1, Math.floor(options.concurrency ?? 4));
		const signal = options.signal ?? new AbortController().signal;
		const iterator = toAsyncIterator(source);
		const total = inferTotalLength(source);
		let index = 0;
		let completed = 0;
		const results = [];
		const workers = Array.from({ length: concurrency }, async () => {
			for (;;) {
				if (signal.aborted) throw abortError$1();
				const { value, done } = await iterator.next();
				if (done) break;
				const currentIndex = index++;
				results[currentIndex] = await fn(value, currentIndex, signal);
				completed += 1;
				options.progress?.(completed, total);
			}
		});
		try {
			await Promise.all(workers);
		} catch (error) {
			if (signal.aborted) throw abortError$1();
			throw error;
		}
		return results;
	}
};
function toAsyncIterator(input) {
	if (isAsyncIterable(input)) return input[Symbol.asyncIterator]();
	if (!isIterable(input)) throw new TypeError("Source must be iterable");
	return (async function* () {
		for (const item of input) yield item;
	})()[Symbol.asyncIterator]();
}
function isAsyncIterable(value) {
	return Boolean(value && typeof value[Symbol.asyncIterator] === "function");
}
function isIterable(value) {
	return Boolean(value && typeof value[Symbol.iterator] === "function");
}
function inferTotalLength(input) {
	if (Array.isArray(input)) return input.length;
	if (typeof input?.length === "number") return Number(input.length);
	if (typeof input?.size === "number") return Number(input.size);
}
function abortError$1() {
	if (typeof DOMException === "function") return new DOMException("Batch execution aborted", "AbortError");
	const error = /* @__PURE__ */ new Error("Batch execution aborted");
	error.name = "AbortError";
	return error;
}
var Semaphore = class {
	queue = [];
	permits;
	constructor(capacity) {
		this.capacity = capacity;
		this.permits = capacity;
	}
	async acquire() {
		if (this.capacity <= 0) return;
		if (this.permits > 0) {
			this.permits -= 1;
			return;
		}
		await new Promise((resolve) => {
			this.queue.push(resolve);
		});
	}
	release() {
		if (this.capacity <= 0) return;
		const next = this.queue.shift();
		if (next) {
			next();
			return;
		}
		this.permits = Math.min(this.permits + 1, this.capacity);
	}
};
var LaneSemaphoreRegistry = class LaneSemaphoreRegistry$1 {
	semaphores = /* @__PURE__ */ new Map();
	limits;
	disabled;
	fallback;
	constructor(limits, disabled, fallback) {
		this.limits = limits;
		this.disabled = disabled;
		this.fallback = Math.max(1, Math.floor(fallback));
	}
	static create(options) {
		const fallback = options.fallback && options.fallback > 0 ? Math.floor(options.fallback) : 1;
		const parsed = parseLaneLimits(options.defaults);
		return new LaneSemaphoreRegistry$1(parsed.limits, parsed.disabled, fallback);
	}
	static fromEnv(options) {
		const parsed = readLaneLimitsFromEnv(options.envKey ?? "HIERARCHIDB_LANE_LIMITS", options.defaults);
		const fallback = options.fallback && options.fallback > 0 ? Math.floor(options.fallback) : 1;
		return new LaneSemaphoreRegistry$1(parsed.limits, parsed.disabled, fallback);
	}
	async runWithLane(lane, task) {
		if (this.disabled) return task();
		const semaphore = this.getSemaphore(lane);
		await semaphore.acquire();
		try {
			return await task();
		} finally {
			semaphore.release();
		}
	}
	recommendConcurrency(lanes, fallbackConcurrency) {
		if (this.disabled) {
			const fallback = fallbackConcurrency ?? this.fallback;
			return Math.max(1, Math.floor(fallback > 0 ? fallback : 1));
		}
		const laneSet = lanes ? new Set(Array.from(lanes, normalizeLane)) : new Set(Object.keys(this.limits));
		if (laneSet.size === 0) laneSet.add("default");
		let total = 0;
		for (const lane of laneSet) total += this.resolveCapacity(lane);
		return Math.max(1, Math.floor(total));
	}
	getLaneCapacity(lane) {
		return this.resolveCapacity(normalizeLane(lane));
	}
	isDisabled() {
		return this.disabled;
	}
	getSemaphore(rawLane) {
		const lane = normalizeLane(rawLane);
		let sem = this.semaphores.get(lane);
		if (!sem) {
			sem = new Semaphore(this.resolveCapacity(lane));
			this.semaphores.set(lane, sem);
		}
		return sem;
	}
	resolveCapacity(lane) {
		return this.limits[lane] ?? this.fallback;
	}
};
function createLaneSemaphoreRegistry(options) {
	return LaneSemaphoreRegistry.create(options);
}
function readLaneLimitsFromEnv(key, defaults) {
	let text;
	try {
		const meta = import.meta;
		const candidate = meta?.env?.[key] ?? meta?.[key];
		if (typeof candidate === "string") text = candidate;
	} catch {}
	if (text === void 0) try {
		const globalObj = globalThis ?? {};
		const candidate = globalObj[key] ?? globalObj.process?.env?.[key];
		if (typeof candidate === "string") text = candidate;
	} catch {}
	if (!text) return {
		limits: { ...defaults },
		disabled: false
	};
	const disabled = /^disable/i.test(text.trim());
	const trimmed = text.replace(/^disable[:,]?\s*/i, "");
	const limits = { ...defaults };
	for (const chunk of trimmed.split(/[,;\s]+/)) {
		if (!chunk) continue;
		const [lane, value] = chunk.split("=");
		const numeric = Number(value);
		if (!lane || !Number.isFinite(numeric)) continue;
		limits[normalizeLane(lane)] = Math.max(0, Math.floor(numeric));
	}
	return {
		limits,
		disabled
	};
}
function parseLaneLimits(defaults) {
	const limits = {};
	for (const [lane, value] of Object.entries(defaults ?? {})) {
		const numeric = Number(value);
		if (!lane || !Number.isFinite(numeric) || numeric <= 0) continue;
		limits[normalizeLane(lane)] = Math.floor(numeric);
	}
	return {
		limits,
		disabled: false
	};
}
function normalizeLane(lane) {
	return lane.trim().toLowerCase();
}
/**
* Shared lifecycle base for batch-oriented workflows.
*/
var AbstractBatchSession = class {
	config;
	nodeId;
	sessionId;
	resourceUsage;
	abortController = null;
	progressListeners = /* @__PURE__ */ new Set();
	state;
	progress;
	constructor(sessionId, nodeId, config) {
		this.sessionId = sessionId;
		this.nodeId = nodeId;
		this.config = config;
		this.state = {
			sessionId,
			nodeId,
			status: "idle"
		};
		this.progress = {
			total: 0,
			completed: 0,
			failed: 0,
			percentage: 0
		};
	}
	getState() {
		return { ...this.state };
	}
	getProgress() {
		return { ...this.progress };
	}
	getAbortSignal() {
		if (!this.abortController) this.abortController = new AbortController();
		return this.abortController.signal;
	}
	async initialize() {
		this.state.status = "idle";
		this.state.startedAt = void 0;
		this.state.completedAt = void 0;
		this.state.error = void 0;
		this.state.lastActivity = Date.now();
		await this.onInitialize();
	}
	async start() {
		if (this.state.status !== "idle" && this.state.status !== "paused") throw new Error(`Cannot start session from state ${this.state.status}`);
		const controller = this.ensureAbortController();
		if (controller.signal.aborted) throw abortError$2("Session aborted before start");
		this.state.status = "running";
		this.state.startedAt = this.state.startedAt ?? Date.now();
		this.state.lastActivity = Date.now();
		try {
			await this.onStart();
			await this.processBatch(controller.signal);
			this.state.status = "completed";
			this.state.completedAt = Date.now();
			this.state.lastActivity = this.state.completedAt;
			this.emitProgress({
				phase: "completed",
				stage: this.progress.currentStage ?? "completed",
				payload: this.toProgressPayload()
			});
			await this.onComplete();
		} catch (error) {
			if (controller.signal.aborted) {
				this.state.status = "cancelled";
				this.state.error = void 0;
				this.emitProgress({
					phase: "cancelled",
					stage: this.progress.currentStage ?? "cancelled",
					payload: this.toProgressPayload()
				});
				throw abortError$2("Session cancelled");
			}
			this.state.status = "failed";
			this.state.error = error instanceof Error ? error.message : String(error);
			this.state.completedAt = Date.now();
			this.emitProgress({
				phase: "failed",
				stage: this.progress.currentStage ?? "failed",
				error: formatProgressError(error),
				payload: this.toProgressPayload()
			});
			throw error;
		}
	}
	async pause() {
		if (this.state.status !== "running") throw new Error(`Cannot pause session from state ${this.state.status}`);
		this.state.status = "paused";
		this.state.lastActivity = Date.now();
		await this.onPause();
		this.emitProgress({
			phase: "paused",
			stage: this.progress.currentStage ?? "paused",
			payload: this.toProgressPayload()
		});
	}
	async resume() {
		if (this.state.status !== "paused") throw new Error(`Cannot resume session from state ${this.state.status}`);
		this.state.status = "running";
		this.state.lastActivity = Date.now();
		await this.onResume();
		this.emitProgress({
			phase: "running",
			stage: this.progress.currentStage ?? "running",
			payload: this.toProgressPayload()
		});
	}
	async cancel() {
		if (this.state.status === "completed" || this.state.status === "failed" || this.state.status === "cancelled") return;
		this.state.status = "cancelled";
		this.state.lastActivity = Date.now();
		this.ensureAbortController().abort();
		await this.onCancel();
		this.emitProgress({
			phase: "cancelled",
			stage: this.progress.currentStage ?? "cancelled",
			payload: this.toProgressPayload()
		});
	}
	addBatchProgressListener(listener) {
		this.progressListeners.add(listener);
		return () => {
			this.progressListeners.delete(listener);
		};
	}
	updateProgress(partial, stage) {
		const merged = {
			...this.progress,
			...partial
		};
		const total = merged.total && merged.total > 0 ? merged.total : this.progress.total;
		merged.total = total;
		if (typeof merged.completed === "number" && typeof total === "number" && total > 0) merged.percentage = Math.min(100, Math.round(merged.completed / total * 100));
		if (stage) merged.currentStage = stage;
		this.progress = merged;
		this.state.lastActivity = Date.now();
		this.emitProgress({
			stage: merged.currentStage ?? stage ?? "unknown",
			phase: this.state.status === "running" ? "running" : this.state.status,
			payload: this.toProgressPayload()
		});
	}
	toProgressPayload() {
		const { total, completed, failed, skipped, currentTask, estimatedTimeRemaining } = this.progress;
		return {
			total,
			completed,
			failed,
			skipped,
			currentTask,
			estimatedTimeRemaining
		};
	}
	emitProgress(event) {
		const full = {
			sessionId: this.sessionId,
			nodeId: this.nodeId,
			stage: event.stage ?? this.progress.currentStage ?? "unknown",
			phase: event.phase ?? this.state.status,
			timestamp: Date.now(),
			payload: event.payload,
			message: event.message,
			error: event.error
		};
		for (const listener of this.progressListeners) listener(full);
		this.onBatchProgressEvent(full);
	}
	setResourceUsage(usage) {
		this.resourceUsage = usage;
	}
	ensureAbortController() {
		if (!this.abortController) this.abortController = new AbortController();
		return this.abortController;
	}
	async onInitialize() {}
	async onStart() {}
	async onPause() {}
	async onResume() {}
	async onCancel() {}
	async onComplete() {}
	onBatchProgressEvent(_event) {}
};
function abortError$2(message) {
	if (typeof DOMException === "function") return new DOMException(message, "AbortError");
	const error = new Error(message);
	error.name = "AbortError";
	return error;
}
function formatProgressError(error) {
	if (!error) return void 0;
	if (typeof error === "object" && error !== null) {
		if ("code" in error || "detail" in error) {
			const existing = error;
			return {
				code: existing.code,
				detail: existing.detail ?? error
			};
		}
		return { detail: error };
	}
	return { detail: error };
}

//#endregion
//#region src/services/batch/adapters/RuntimeWorkerDownloadAdapter.ts
/**
* RuntimeWorkerDownloadAdapter
*
* Scaffolds a runtime-worker based download stage behind a stable adapter.
* For now it leverages the shared DownloadService and keeps progress semantics.
* Later this will dispatch tasks to @hierarchidb/runtime-worker workers.
*/
var RuntimeWorkerDownloadAdapter = class {
	laneRegistry = createLaneSemaphoreRegistry({
		defaults: {
			gadm: 2,
			osm: 1,
			naturalearth: 2,
			openmaptiles: 1,
			default: 4
		},
		envKey: "SHAPE_LANE_LIMITS",
		fallback: 4
	});
	async process(sessionId, _nodeId, tasks, onProgress, controls) {
		const downloadClient = (await getShapeRuntimeWorkerClient())?.download;
		if (!downloadClient) throw new Error("Runtime worker client not available for download stage");
		const batch = new BatchService();
		let completed = 0;
		let failed = 0;
		let totalBytes = 0;
		const recommendedConcurrency = this.laneRegistry.recommendConcurrency(tasks.map((task) => (task.config?.dataSource ?? "default").toLowerCase()), 4);
		await batch.mapChunks(tasks, async (task, index) => {
			const lane = (task.config?.dataSource ?? "default").toLowerCase();
			await this.laneRegistry.runWithLane(lane, async () => {
				if (controls?.waitIfPaused) await controls.waitIfPaused();
				const fileId = `${sessionId}-download-${index}`;
				try {
					const downloadUrl = task.url ?? task.config?.url;
					if (!downloadUrl) throw new Error(`Download task ${task.taskId} missing url`);
					const res = await downloadClient.download(downloadUrl, fileId);
					totalBytes += res.sizeBytes || 0;
					completed += 1;
				} catch {
					failed += 1;
				}
				onProgress({
					total: tasks.length,
					completed,
					failed,
					skipped: 0,
					percentage: tasks.length > 0 ? completed / tasks.length * 100 : 0,
					currentStage: "download",
					currentTask: task.taskId
				});
			});
		}, { concurrency: recommendedConcurrency });
		return {
			processed: completed,
			failed,
			totalDownloadSize: totalBytes
		};
	}
};

//#endregion
//#region src/services/batch/adapters/RuntimeWorkerSimplifyAdapters.ts
var RuntimeWorkerSimplify1Adapter = class {
	async process(tasks, onProgress, controls) {
		const simplifyClient = (await getShapeRuntimeWorkerClient())?.simplify;
		if (!simplifyClient) throw new Error("Runtime worker simplify1 not available");
		let completed = 0, failed = 0;
		for (const task of tasks) {
			if (controls?.waitIfPaused) await controls.waitIfPaused();
			try {
				const inputBufferId = task.inputBufferId ?? task.config?.inputBufferId ?? "";
				const tolerance = task.tolerance ?? task.config?.tolerance ?? .001;
				const minArea = task.minArea ?? task.config?.minimumArea ?? 0;
				await simplifyClient.simplifyStage1(inputBufferId, {
					tolerance,
					minArea
				});
				completed++;
			} catch {
				failed++;
			}
			onProgress({
				total: tasks.length,
				completed,
				failed,
				skipped: 0,
				percentage: completed / tasks.length * 100,
				currentStage: "simplify1",
				currentTask: task.taskId
			});
		}
		return {
			processed: completed,
			failed
		};
	}
};
var RuntimeWorkerSimplify2Adapter = class {
	async process(tasks, onProgress, controls) {
		const simplifyClient = (await getShapeRuntimeWorkerClient())?.simplify;
		if (!simplifyClient) throw new Error("Runtime worker simplify2 not available");
		let completed = 0, failed = 0;
		for (const task of tasks) {
			if (controls?.waitIfPaused) await controls.waitIfPaused();
			try {
				const inputBufferId = task.inputBufferId ?? task.config?.inputBufferId ?? "";
				const zoomLevels = task.zoomLevels ?? task.config?.zoomLevels ?? [];
				const tileSize = task.tileSize ?? task.config?.tileSize ?? 256;
				await simplifyClient.simplifyStage2(inputBufferId, {
					zoomLevels,
					tileSize
				});
				completed++;
			} catch {
				failed++;
			}
			onProgress({
				total: tasks.length,
				completed,
				failed,
				skipped: 0,
				percentage: completed / tasks.length * 100,
				currentStage: "simplify2",
				currentTask: task.taskId
			});
		}
		return {
			processed: completed,
			failed
		};
	}
};

//#endregion
//#region src/services/batch/adapters/RuntimeWorkerVectorTileAdapter.ts
var RuntimeWorkerVectorTileAdapter = class {
	async process(tasks, onProgress, controls) {
		const vectorTileClient = (await getShapeRuntimeWorkerClient())?.vectortile;
		if (!vectorTileClient) throw new Error("Runtime worker vectortile not available");
		let completed = 0, failed = 0;
		for (const task of tasks) {
			if (controls?.waitIfPaused) await controls.waitIfPaused();
			try {
				const inputBufferId = task.inputBufferId ?? task.config?.inputBufferId ?? task.config?.tileBufferId ?? "";
				const compression = task.compression ?? task.config?.compression ?? false;
				const format = task.outputFormat ?? task.config?.format ?? "mvt";
				const tileSize = task.config?.tileSize ?? 256;
				await vectorTileClient.generateTiles(inputBufferId, {
					format,
					compression: compression ? "gzip" : "none",
					tileSize
				});
				completed++;
			} catch {
				failed++;
			}
			onProgress({
				total: tasks.length,
				completed,
				failed,
				skipped: 0,
				percentage: completed / tasks.length * 100,
				currentStage: "vectortile",
				currentTask: task.taskId
			});
		}
		return {
			processed: completed,
			failed
		};
	}
};

//#endregion
//#region src/services/batch/SessionController.ts
var SessionController = class {
	sessionId;
	nodeId;
	workerPool = null;
	downloadAdapter = new RuntimeWorkerDownloadAdapter();
	urlMetadata;
	options;
	currentStage = "download";
	isPaused = false;
	isAborted = false;
	progressCallback;
	simplify1Adapter;
	simplify2Adapter;
	vectorTileAdapter;
	pausedStages = /* @__PURE__ */ new Set();
	stageWaiters = /* @__PURE__ */ new Map();
	constructor(sessionId, nodeId, urlMetadata, _config, options = {}) {
		this.sessionId = sessionId;
		this.nodeId = nodeId;
		this.urlMetadata = urlMetadata;
		this.options = options;
	}
	/**
	* Initialize the session by creating a new WorkerPool
	*/
	async initialize() {
		if (this.workerPool) throw new Error(`Session ${this.sessionId} already initialized`);
		if (await getShapeRuntimeWorkerClient()) {
			this.simplify1Adapter = new RuntimeWorkerSimplify1Adapter();
			this.simplify2Adapter = new RuntimeWorkerSimplify2Adapter();
			this.vectorTileAdapter = new RuntimeWorkerVectorTileAdapter();
		} else throw new Error("Shape runtime worker unavailable. Legacy WorkerPool fallback has been removed.");
	}
	/**
	* Start processing the batch session
	*/
	async start() {
		if (!this.workerPool) await this.initialize();
		console.log(`[Session ${this.sessionId}] Starting batch processing`);
		try {
			await this.processDownloadStage();
			if (!this.isAborted && !this.isPaused) await this.processSimplify1Stage();
			if (!this.isAborted && !this.isPaused) await this.processSimplify2Stage();
			if (!this.isAborted && !this.isPaused) await this.processVectorTileStage();
			if (!this.isAborted && !this.isPaused) console.log(`[Session ${this.sessionId}] Batch processing completed successfully`);
		} catch (error) {
			console.error(`[Session ${this.sessionId}] Batch processing failed:`, error);
			throw error;
		} finally {
			if (!this.isPaused) await this.cleanup();
		}
	}
	/**
	* Pause the session (keeps WorkerPool alive for resume)
	*/
	async pause() {
		this.isPaused = true;
		console.log(`[Session ${this.sessionId}] Session paused`);
	}
	/**
	* Resume the session
	*/
	async resume() {
		if (!this.isPaused) throw new Error(`Session ${this.sessionId} is not paused`);
		this.isPaused = false;
		console.log(`[Session ${this.sessionId}] Session resumed`);
		this.resumeAllStages();
		await this.start();
	}
	/**
	* Abort the session and cleanup resources
	*/
	async abort() {
		this.isAborted = true;
		console.log(`[Session ${this.sessionId}] Session aborted`);
		this.resumeAllStages();
		await this.cleanup();
	}
	/**
	* Cleanup resources (terminates WorkerPool)
	*/
	async cleanup() {
		if (this.workerPool) {
			console.log(`[Session ${this.sessionId}] Shutting down WorkerPool`);
			await this.workerPool.shutdown();
			this.workerPool = null;
			console.log(`[Session ${this.sessionId}] WorkerPool terminated`);
		}
		this.resumeAllStages();
	}
	/**
	* Process download stage
	*/
	async processDownloadStage() {
		this.currentStage = "download";
		console.log(`[Session ${this.sessionId}] Processing download stage`);
		const tasks = this.urlMetadata.map((metadata, index) => ({
			taskId: `${this.sessionId}-download-${index}`,
			sessionId: this.sessionId,
			taskType: "download",
			stage: BatchTaskStage.WAIT,
			type: "download",
			status: "waiting",
			index,
			progress: 0,
			url: metadata.url,
			config: {
				dataSource: metadata.dataSource ?? metadata.continent ?? "gadm",
				country: metadata.country ?? metadata.countryCode ?? "UNKNOWN",
				adminLevel: metadata.adminLevel,
				url: metadata.url,
				timeout: this.options.timeoutMs ?? 0,
				retryDelay: this.options.retryAttempts ?? 0,
				expectedFormat: "geojson",
				validateSSL: true
			}
		}));
		const res = await this.downloadAdapter.process(this.sessionId, this.nodeId, tasks, (p) => this.progressCallback?.(p), { waitIfPaused: () => this.waitForStageResume("download") });
		console.log(`[Session ${this.sessionId}] Download stage completed: ${res.processed} successful, ${res.failed} failed`);
		const percentage = res.processed / tasks.length * 100;
		this.progressCallback?.({
			total: tasks.length,
			completed: res.processed,
			failed: res.failed,
			skipped: 0,
			percentage,
			currentStage: "download",
			currentTask: "Download completed"
		});
	}
	/**
	* Process simplify1 stage
	*/
	async processSimplify1Stage() {
		this.currentStage = "simplify1";
		console.log(`[Session ${this.sessionId}] Processing simplify1 stage`);
		const tasks = this.urlMetadata.map((_metadata, index) => ({
			taskId: `${this.sessionId}-simplify1-${index}`,
			sessionId: this.sessionId,
			taskType: "simplify1",
			stage: BatchTaskStage.WAIT,
			type: "simplify1",
			status: "waiting",
			index,
			progress: 0,
			inputBufferId: `${this.sessionId}-download-${index}`,
			tolerance: .001,
			minArea: 0,
			config: {
				algorithm: "douglas-peucker",
				tolerance: .001,
				preserveTopology: true,
				minimumArea: 0
			}
		}));
		const r = await this.simplify1Adapter.process(tasks, (p) => this.progressCallback?.(p), { waitIfPaused: () => this.waitForStageResume("simplify1") });
		console.log(`[Session ${this.sessionId}] Simplify1 stage completed: ${r.processed}/${tasks.length} successful`);
	}
	/**
	* Process simplify2 stage
	*/
	async processSimplify2Stage() {
		this.currentStage = "simplify2";
		console.log(`[Session ${this.sessionId}] Processing simplify2 stage`);
		const tasks = this.urlMetadata.map((_metadata, index) => ({
			taskId: `${this.sessionId}-simplify2-${index}`,
			sessionId: this.sessionId,
			taskType: "simplify2",
			stage: BatchTaskStage.WAIT,
			type: "simplify2",
			status: "waiting",
			index,
			progress: 0,
			inputBufferId: `${this.sessionId}-simplify1-${index}`,
			zoomLevels: [10],
			tileSize: 512,
			config: {
				zoomLevel: 10,
				tileSize: 512,
				preserveSharedBoundaries: true,
				quantization: 1,
				algorithm: "douglas-peucker",
				tolerance: .001,
				minimumArea: 0,
				preserveTopology: true,
				maxVertices: void 0,
				coordinatePrecision: 6
			}
		}));
		const r = await this.simplify2Adapter.process(tasks, (p) => this.progressCallback?.(p), { waitIfPaused: () => this.waitForStageResume("simplify2") });
		console.log(`[Session ${this.sessionId}] Simplify2 stage completed: ${r.processed}/${tasks.length} successful`);
	}
	/**
	* Process vector tile generation stage
	*/
	async processVectorTileStage() {
		this.currentStage = "vectortile";
		console.log(`[Session ${this.sessionId}] Processing vector tile stage`);
		const tasks = this.urlMetadata.map((_metadata, index) => ({
			taskId: `${this.sessionId}-vectortile-${index}`,
			sessionId: this.sessionId,
			taskType: "vectortile",
			stage: BatchTaskStage.WAIT,
			type: "vectortile",
			status: "waiting",
			index,
			progress: 0,
			inputBufferId: `${this.sessionId}-simplify2-${index}`,
			outputFormat: "mvt",
			compression: true,
			config: {
				zoomLevel: 10,
				tileX: 0,
				tileY: 0,
				extent: 4096,
				buffer: 256,
				layers: [],
				format: "mvt",
				compression: true
			}
		}));
		const r = await this.vectorTileAdapter.process(tasks, (p) => this.progressCallback?.(p), { waitIfPaused: () => this.waitForStageResume("vectortile") });
		console.log(`[Session ${this.sessionId}] Vector tile stage completed: ${r.processed}/${tasks.length} successful`);
	}
	/**
	* Set progress callback
	*/
	setProgressCallback(callback) {
		this.progressCallback = callback;
	}
	pauseStage(stage) {
		this.pausedStages.add(stage);
	}
	resumeStage(stage) {
		if (!this.pausedStages.delete(stage)) return;
		this.resolveStageWaiters(stage);
	}
	resumeAllStages() {
		for (const stage of [...this.pausedStages]) {
			this.pausedStages.delete(stage);
			this.resolveStageWaiters(stage);
		}
	}
	async waitForStageResume(stage) {
		if (!this.pausedStages.has(stage)) return;
		await new Promise((resolve) => {
			const waiters = this.stageWaiters.get(stage) ?? [];
			waiters.push(resolve);
			this.stageWaiters.set(stage, waiters);
		});
	}
	resolveStageWaiters(stage) {
		const waiters = this.stageWaiters.get(stage);
		if (!waiters) return;
		for (const release of waiters) release();
		this.stageWaiters.delete(stage);
	}
	/**
	* Get current session status
	*/
	getStatus() {
		return {
			sessionId: this.sessionId,
			stage: this.currentStage,
			isPaused: this.isPaused,
			isAborted: this.isAborted,
			hasWorkerPool: this.workerPool !== null
		};
	}
	/**
	* Get WorkerPool statistics
	*/
	getPoolStatistics() {
		if (!this.workerPool) return null;
		return this.workerPool.getPoolStatistics();
	}
};

//#endregion
//#region src/services/batch/ShapeBatchSession.ts
var ShapeBatchSession = class extends AbstractBatchSession {
	constructor(sessionId, nodeId, config, controller, sink) {
		super(sessionId, nodeId, config);
		this.controller = controller;
		this.sink = sink;
	}
	async onInitialize() {}
	async onStart() {}
	async processBatch(signal) {
		if (signal.aborted) throw abortError();
		this.controller.setProgressCallback((p) => {
			this.updateProgress({
				total: p.total,
				completed: p.completed,
				failed: p.failed,
				currentStage: p.currentStage ?? "processing",
				currentTask: p.currentTask
			});
		});
		await this.controller.initialize();
		await this.controller.start();
	}
	async onPause() {}
	async onResume() {}
	async onCancel() {}
	async onComplete() {}
	onBatchProgressEvent(event) {
		const payload = event.payload ?? {};
		const total = payload.total ?? 0;
		const completed = payload.completed ?? 0;
		const failed = payload.failed ?? 0;
		const progress = total > 0 ? completed / total * 100 : 0;
		const legacyEvent = {
			sessionId: event.sessionId,
			stage: event.stage,
			total,
			completed,
			failed,
			percentage: progress,
			currentTask: payload.currentTask ?? ""
		};
		this.sink?.(legacyEvent);
	}
	pauseStage(stage) {
		this.controller.pauseStage(stage);
	}
	resumeStage(stage) {
		this.controller.resumeStage(stage);
	}
	resumeAllStages() {
		this.controller.resumeAllStages();
	}
};
function abortError() {
	if (typeof DOMException === "function") return new DOMException("Shape batch aborted", "AbortError");
	const error = /* @__PURE__ */ new Error("Shape batch aborted");
	error.name = "AbortError";
	return error;
}

//#endregion
//#region src/services/batch/BatchSessionManager.ts
const logBatchSessionWarning = (message, error) => {
	if (typeof console === "undefined") return;
	console.warn("[ShapeBatchSessionManager]", message, error);
};
const STAGES = [
	"download",
	"simplify1",
	"simplify2",
	"vectortile"
];
var BatchSessionManager = class {
	sharedSessions = /* @__PURE__ */ new Map();
	progressCallbacks = /* @__PURE__ */ new Map();
	constructor() {}
	async initialize() {
		await this.resumeIncompleteSessions();
	}
	async shutdown() {
		for (const [sessionId] of this.sharedSessions) await this.cancelSession(sessionId);
	}
	async createSession(nodeId, config, urlMetadata, options = {}) {
		if ((await shapeDB.getActiveBatchSessions(nodeId)).length > 0) throw new Error(`Node ${nodeId} already has an active batch session`);
		const session = await shapeDB.createBatchSession({
			nodeId,
			status: "running",
			config,
			startedAt: Date.now(),
			updatedAt: Date.now(),
			progress: {
				total: urlMetadata.length,
				completed: 0,
				failed: 0,
				skipped: 0,
				percentage: 0,
				currentStage: "download",
				currentTask: "Initializing..."
			},
			stages: this.initializeStages(config),
			resourceUsage: {
				memoryUsed: 0,
				memoryPeak: 0,
				cpuPercent: 0,
				storageUsed: 0,
				networkBytesReceived: 0,
				networkBytesSent: 0
			}
		});
		const controller = new SessionController(session.sessionId, nodeId, urlMetadata, config, options);
		const shared = new ShapeBatchSession(session.sessionId, nodeId, { concurrency: options.maxConcurrentTasks }, controller, (ev) => {
			try {
				this.progressCallbacks.get(session.sessionId)?.({
					total: ev.total,
					completed: ev.completed,
					failed: ev.failed,
					skipped: 0,
					percentage: ev.percentage,
					currentStage: ev.stage ?? "processing",
					currentTask: ev.currentTask
				});
			} catch (error) {
				logBatchSessionWarning(`Progress callback for session ${session.sessionId} failed`, error);
			}
		});
		this.sharedSessions.set(session.sessionId, shared);
		shared.initialize().then(() => shared.start()).catch((e) => console.error("Shape shared session failed", e));
		return session;
	}
	async pauseSession(sessionId) {
		const shared = this.sharedSessions.get(sessionId);
		if (!shared) throw new Error(`Session ${sessionId} not found`);
		await shared.pause();
		await shapeDB.updateBatchSession(sessionId, { status: "paused" });
	}
	async resumeSession(sessionId) {
		const shared = this.sharedSessions.get(sessionId);
		if (!shared) throw new Error(`Session ${sessionId} not found`);
		await shared.resume();
		await shapeDB.updateBatchSession(sessionId, { status: "running" });
	}
	async cancelSession(sessionId) {
		const shared = this.sharedSessions.get(sessionId);
		if (!shared) return;
		await shared.cancel();
		this.sharedSessions.delete(sessionId);
		await shapeDB.updateBatchSession(sessionId, {
			status: "cancelled",
			completedAt: Date.now()
		});
		const tasks = await shapeDB.getBatchTasks(sessionId);
		for (const task of tasks) if (task.status === "waiting" || task.status === "running") await shapeDB.updateBatchTask(task.taskId, { status: "cancelled" });
	}
	async getSessionStatus(sessionId) {
		const session = await shapeDB.getBatchSession(sessionId);
		if (!session) throw new Error(`Session ${sessionId} not found`);
		const tasks = await shapeDB.getBatchTasks(sessionId);
		return {
			session,
			currentTasks: tasks.filter((t) => t.status === "running"),
			queuedTasks: tasks.filter((t) => t.status === "waiting").length,
			errors: tasks.filter((t) => t.status === "failed").map((t) => ({
				taskId: t.taskId,
				sessionId: t.sessionId,
				error: t.errorMessage || "Unknown error",
				timestamp: t.completedAt || Date.now(),
				stage: t.type,
				retryable: (t.retryCount || 0) < 3
			})),
			warnings: [],
			estimatedTimeRemaining: this.calculateTimeRemaining(session, tasks),
			throughput: this.calculateThroughput(tasks)
		};
	}
	onProgress(sessionId, callback) {
		this.progressCallbacks.set(sessionId, callback);
	}
	async dispatchCommand(command, payload) {
		const sessionId = payload.sessionId;
		const shared = this.sharedSessions.get(sessionId);
		if (!shared) throw new Error(`Batch session ${sessionId} not found`);
		switch (command) {
			case "session/pause":
				STAGES.forEach((stage) => shared.pauseStage(stage));
				await this.pauseSession(sessionId);
				break;
			case "session/resume":
				shared.resumeAllStages();
				await this.resumeSession(sessionId);
				break;
			case "session/cancel":
				shared.resumeAllStages();
				await this.cancelSession(sessionId);
				break;
			case "stage/pause":
				shared.pauseStage(payload.stage);
				break;
			case "stage/resume":
				shared.resumeStage(payload.stage);
				break;
			default:
				logBatchSessionWarning(`Unknown batch command ${String(command)}`, void 0);
				break;
		}
	}
	initializeStages(_config) {
		const stages = [
			"download",
			"simplify1",
			"simplify2",
			"vectortile"
		];
		const stageStatus = {};
		for (const stage of stages) stageStatus[stage] = {
			status: "waiting",
			progress: 0,
			tasksTotal: 0,
			tasksCompleted: 0,
			tasksFailed: 0
		};
		return stageStatus;
	}
	async resumeIncompleteSessions() {
		const incompleteSessions = await shapeDB.batchSessions.where("status").anyOf(["running", "paused"]).toArray();
		for (const session of incompleteSessions) if (session.status === "running") await shapeDB.updateBatchSession(session.sessionId, {
			status: "failed",
			completedAt: Date.now()
		});
	}
	calculateTimeRemaining(session, tasks) {
		const completedTasks = tasks.filter((t) => t.status === "completed");
		if (completedTasks.length === 0) return void 0;
		const avgTaskTime = completedTasks.reduce((sum, task) => {
			if (task.startedAt && task.completedAt) return sum + (task.completedAt - task.startedAt);
			return sum;
		}, 0) / completedTasks.length;
		return (session.progress.total - session.progress.completed) * avgTaskTime;
	}
	calculateThroughput(tasks) {
		const recentTasks = tasks.filter((t) => t.status === "completed" && t.completedAt && t.completedAt > Date.now() - 6e4);
		if (recentTasks.length === 0) return;
		return {
			tasksPerSecond: recentTasks.length / 60,
			bytesPerSecond: 0
		};
	}
};

//#endregion
//#region src/services/batch/UnifiedShapeBatchManager.ts
/**
* Unified shape batch manager implementing the standard interface
*/
var UnifiedShapeBatchManager = class {
	manager;
	pending = /* @__PURE__ */ new Map();
	sessionNodes = /* @__PURE__ */ new Map();
	constructor() {
		this.manager = new BatchSessionManager();
		this.manager.initialize().catch(console.error);
	}
	prepareSession(nodeId, config, data) {
		this.pending.set(nodeId, {
			config,
			data
		});
	}
	async startBatchSession(nodeId) {
		const pending = this.pending.get(nodeId);
		if (!pending) throw new Error(`No pending shape batch session data for node ${nodeId}`);
		this.pending.delete(nodeId);
		const { config, data } = pending;
		if (!data.urlMetadata?.length) throw new Error("Shape batch session requires urlMetadata");
		const batchProcessConfig = {
			corsProxyBaseURL: config.corsProxyBaseURL ?? "",
			download: {
				concurrentDownloads: 1,
				deleteOnComplete: false
			},
			simplify1: {
				concurrentProcesses: 1,
				enableFeatureFiltering: false,
				featureAreaThreshold: 0,
				minVertexCountForAreaFilter: 0,
				aspectRatioThreshold: 1,
				featureFilterMethod: "bbox_only"
			},
			simplify2: {
				concurrentProcesses: 1,
				quantize: 1,
				simplify: 1,
				tolerance: 1,
				enablePerFeatureSimplification: false
			},
			vectorTiles: {
				concurrentProcesses: 1,
				maxZoom: 1,
				tileCountThresholdForZoomStop: 1e3
			}
		};
		const options = {
			maxConcurrentTasks: config.maxConcurrentTasks,
			retryAttempts: config.maxRetries,
			timeoutMs: config.workerTimeout,
			enableResourceTracking: config.enableResourceMonitoring
		};
		const sessionId = (await this.manager.createSession(nodeId, batchProcessConfig, data.urlMetadata, options)).sessionId;
		if (!sessionId) throw new Error("Failed to create shape batch session: missing sessionId");
		this.sessionNodes.set(sessionId, nodeId);
		return sessionId;
	}
	async pauseBatchSession(sessionId) {
		return this.manager.pauseSession(sessionId);
	}
	async resumeBatchSession(sessionId) {
		return this.manager.resumeSession(sessionId);
	}
	async cancelBatchSession(sessionId) {
		await this.manager.cancelSession(sessionId);
		this.sessionNodes.delete(sessionId);
	}
	async getBatchSessionStatus(sessionId) {
		const status = await this.manager.getSessionStatus(sessionId);
		return {
			sessionId: status.session.sessionId,
			nodeId: status.session.nodeId,
			status: status.session.status,
			progress: status.session.progress,
			startedAt: status.session.startedAt,
			completedAt: status.session.completedAt,
			lastActivity: status.session.updatedAt,
			error: status.errors && status.errors.length > 0 ? status.errors[0]?.error : void 0
		};
	}
	onBatchProgress(sessionId, callback) {
		this.manager.onProgress(sessionId, (progress) => {
			const nodeId = this.sessionNodes.get(sessionId);
			if (!nodeId) return;
			const total = progress.total ?? 0;
			const completed = progress.completed ?? 0;
			const failed = progress.failed ?? 0;
			const skipped = progress.skipped ?? 0;
			const phase = this.resolveProgressPhase({
				total,
				completed,
				failed,
				percentage: progress.percentage
			});
			const payload = {
				total,
				completed,
				failed,
				skipped,
				currentTask: progress.currentTask,
				meta: { percentage: progress.percentage }
			};
			callback({
				sessionId,
				nodeId,
				stage: progress.currentStage || "processing",
				phase,
				timestamp: Date.now(),
				payload,
				message: typeof progress.currentTask === "string" ? progress.currentTask : void 0
			});
			if (phase === "completed" || phase === "failed") this.sessionNodes.delete(sessionId);
		});
		return () => {};
	}
	resolveProgressPhase(progress) {
		if (progress.failed > 0) return "failed";
		if (progress.total > 0 && progress.completed >= progress.total) return "completed";
		if ((progress.percentage ?? 0) <= 0 && progress.completed === 0) return "queued";
		return "running";
	}
};
/**
* Factory function to get the appropriate batch manager
* Returns the unified manager if API v2 is enabled, otherwise returns a wrapper around the legacy manager
*/
function createShapeBatchManager() {
	return new UnifiedShapeBatchManager();
}
/**
* Feature flag check for shape plugin specifically
*/
function isShapeBatchAPIV2Enabled() {
	return isBatchControlAPIV2Enabled();
}

//#endregion
//#region src/services/tiles/RuntimeTileClient.ts
async function listTiles(sessionId) {
	const vectorTile = (await getShapeRuntimeWorkerClient())?.vectortile;
	if (!vectorTile?.listTiles) return [];
	return vectorTile.listTiles(sessionId) ?? [];
}
async function getTile(sessionId, z, x, y) {
	const vectorTile = (await getShapeRuntimeWorkerClient())?.vectortile;
	if (!vectorTile?.getTile) return null;
	const result = await vectorTile.getTile(sessionId, z, x, y);
	if (!result) return null;
	return result instanceof Uint8Array ? result : new Uint8Array(result);
}
async function getTileSummary(sessionId) {
	const vectorTile = (await getShapeRuntimeWorkerClient())?.vectortile;
	if (!vectorTile?.getSummary) return {
		tiles: 0,
		totalBytes: 0
	};
	return vectorTile.getSummary(sessionId);
}

//#endregion
//#region src/index.ts
var RuntimeWiring = class {
	static async registerRuntimeWorkerAdapters() {
		try {
			await (await import("./registerRuntimeWorker.js")).registerShapeRuntimeWorkerAdapters();
		} catch {}
	}
};
let initialized = false;
async function onRegister() {
	if (initialized) return;
	initialized = true;
	try {
		const { ShapeDB: ShapeDB$1 } = await import("./services/index.js");
		const db = new ShapeDB$1();
		await db.open();
		await db.close();
	} catch (error) {
		console.warn("[shape-plugin] failed to pre-open ShapeDB:", error);
	}
}

//#endregion
export { BATCH_CONSTANTS, BatchTaskStage, DEFAULT_DATA_SOURCES, DEFAULT_PROCESSING_CONFIG, EphemeralShapeDB, RuntimeWiring, SHAPE_LEVELS, SHAPE_PLUGIN_ID, STORAGE_CONSTANTS, BatchSessionManager as ShapeBatchSessionManager, ShapeDB, ShapeMetadata, PLUGIN_MANIFEST as ShapePluginManifest, ShapeTableQueryService, UI_CONSTANTS, UnifiedShapeBatchManager, buildShapeEntityFromCreate, calculateSelectionStats, createShapeBatchManager, createWorkingCopyFromEntity, formatBytes, formatDuration, generateSessionId, generateTaskId, generateUrlMetadata, getTile, getTileSummary, isShapeBatchAPIV2Enabled, listTiles, mapWorkingCopyToUpdates, mergeProcessingConfig, normalizeDataSourceName, onRegister, parseCheckboxState, serializeCheckboxState, summarizeCheckboxState, validateProcessingConfig, validateShapeName };
//# sourceMappingURL=index.js.map