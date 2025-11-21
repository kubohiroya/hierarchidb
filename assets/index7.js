import { t as RouteDatabase } from "./RouteDatabase.js";
import { a as RouteBatchOrchestrationService, c as RouteBatchSessionOrchestrator, d as OsrmEngine, f as ThrottledPort, i as getOsrmThrottleDefaults, l as RouteBatchManager, n as RouteBatchLaunchForm, o as RouteSourceOrchestrator, p as RouteGenerator, r as getOsrmEngineDefaults, s as createRouteBatchManager, t as useRouteBatchProgress, u as SearouteEngine } from "./useRouteBatchProgress.js";
import { a as getRouteTypeName, c as translations, i as getCategoryName, l as useTranslation, n as formatDistance, o as getTranslation, r as formatDuration, s as getTransportModeName, t as detectLocale } from "./i18n.js";
import "./registerRouteWorkerStores.js";
import { t as worker_exports } from "./worker.js";
import "./registry2.js";
import { BaseEntityHandler } from "@hierarchidb/plugin-service-sdk";
import { TabularQueryService as RouteTableQueryService } from "@hierarchidb/tabular-store";

//#region src/plugin-manifest.ts
const PLUGIN_ID = "@hierarchidb/route-plugin";
const PLUGIN_VERSION = "1.0.0";
const PLUGIN_DESCRIPTION = "Route management plugin extending Shape plugin for HierarchiDB";
const PLUGIN_NODE_TYPE = "route";
const PLUGIN_MANIFEST = {
	id: PLUGIN_ID,
	name: "Route Plugin",
	displayName: "Route",
	nodeType: PLUGIN_NODE_TYPE,
	version: PLUGIN_VERSION,
	description: PLUGIN_DESCRIPTION,
	extends: "shape",
	dependencies: ["shape"],
	icon: {
		mui: "Route",
		emoji: "〰️",
		color: "#a3b030",
		component: {
			specifier: "@hierarchidb/route-plugin/icon",
			exportName: "RoutePluginIcon"
		}
	},
	category: {
		id: "geographic",
		menuGroup: "geo",
		createOrder: 60
	},
	database: { prewarm: [{
		specifier: "@hierarchidb/route-plugin/database",
		export: "RouteDatabase"
	}] },
	worker: { preload: ["registerRouteWorkerStores"] }
};

//#endregion
//#region src/services/LocationResolver.ts
/**
* Location resolver service
* Interfaces with Location plugin to resolve location references
*/
var LocationResolver = class {
	locationCache = /* @__PURE__ */ new Map();
	/**
	* Get location data by node ID
	*/
	async getLocation(locationId) {
		if (this.locationCache.has(locationId)) return this.locationCache.get(locationId);
		try {
			const location = await this.fetchLocationFromPlugin(locationId);
			if (location) this.locationCache.set(locationId, location);
			return location;
		} catch (error) {
			console.error(`Failed to resolve location ${locationId}:`, error);
			return null;
		}
	}
	/**
	* Get multiple locations
	*/
	async getLocations(locationIds) {
		const locations = /* @__PURE__ */ new Map();
		for (const id of locationIds) {
			const location = await this.getLocation(id);
			if (location) locations.set(id, location);
		}
		return locations;
	}
	/**
	* Search locations by criteria
	*/
	async searchLocations(_criteria) {
		return [];
	}
	/**
	* Clear location cache
	*/
	clearCache() {
		this.locationCache.clear();
	}
	/**
	* Mock implementation - would be replaced with actual Location plugin API call
	*/
	async fetchLocationFromPlugin(locationId) {
		return {
			"loc_tokyo": {
				nodeId: "loc_tokyo",
				name: "Tokyo",
				coordinates: [139.6917, 35.6895],
				type: "city"
			},
			"loc_osaka": {
				nodeId: "loc_osaka",
				name: "Osaka",
				coordinates: [135.5023, 34.6937],
				type: "city"
			},
			"loc_kyoto": {
				nodeId: "loc_kyoto",
				name: "Kyoto",
				coordinates: [135.7681, 35.0116],
				type: "city"
			}
		}[locationId] || null;
	}
};

//#endregion
//#region src/common/entities/RouteEntityHandler.ts
/**
* Route entity handler with metadata support
*/
var RouteEntityHandler = class extends BaseEntityHandler {
	table;
	routeDB;
	routeGenerator;
	locationResolver;
	constructor() {
		super();
		this.routeDB = new RouteDatabase();
		this.table = this.routeDB.routes;
		this.routeGenerator = new RouteGenerator();
		this.locationResolver = new LocationResolver();
	}
	/**
	* Build route entity
	*/
	buildEntity(nodeId, entityId, data) {
		const now = Date.now();
		return {
			id: entityId,
			nodeId,
			name: data.name || "New Route",
			description: data.description,
			category: data.category || { primary: "road" },
			startLocationId: data.startLocationId,
			endLocationId: data.endLocationId,
			waypointLocationIds: data.waypointLocationIds || [],
			startPoint: data.startPoint,
			endPoint: data.endPoint,
			waypoints: data.waypoints || [],
			lineGeometry: data.lineGeometry || [],
			generationMethod: data.generationMethod || "direct",
			distance: data.distance,
			duration: data.duration,
			transportMode: data.transportMode || "road",
			operator: data.operator,
			routeNumber: data.routeNumber,
			frequency: data.frequency,
			dataSourceId: data.dataSourceId,
			dataSourceName: data.dataSourceName,
			originalData: data.originalData,
			processedAt: data.processedAt,
			processingStatus: data.processingStatus || "pending",
			processingError: data.processingError,
			style: data.style,
			parentRouteId: data.parentRouteId,
			childRouteIds: data.childRouteIds || [],
			relatedShapeId: data.relatedShapeId,
			metadata: data.metadata || {},
			customFields: data.customFields || {},
			createdAt: data.createdAt || now,
			updatedAt: data.updatedAt || now,
			version: data.version || 1
		};
	}
	/**
	* Create route entity with automatic geometry generation
	*/
	async createEntity(nodeId, data) {
		if (data.startLocationId || data.endLocationId) {
			const resolved = await this.resolveLocations(data);
			data = {
				...data,
				...resolved
			};
		}
		if (!data.lineGeometry || data.lineGeometry.length === 0) {
			const geometry = await this.generateRoute(data);
			data.lineGeometry = geometry.lineGeometry;
			data.distance = geometry.distance;
			data.duration = geometry.duration;
			data.processingStatus = "completed";
		}
		return super.createEntity(nodeId, data);
	}
	/**
	* Update route with geometry regeneration if needed
	*/
	async updateEntity(entityId, updates) {
		const existing = await this.table.get(entityId);
		if (!existing) throw new Error(`Route not found: ${entityId}`);
		if (this.needsRouteRegeneration(existing, updates)) {
			const merged = {
				...existing,
				...updates
			};
			const geometry = await this.generateRoute(merged);
			updates.lineGeometry = geometry.lineGeometry;
			updates.distance = geometry.distance;
			updates.duration = geometry.duration;
			updates.processedAt = Date.now();
			updates.processingStatus = "completed";
		}
		return super.updateEntity(entityId, updates);
	}
	/**
	* Resolve location references to coordinates
	*/
	async resolveLocations(data) {
		const resolved = {};
		if (data.startLocationId && !data.startPoint) {
			const location = await this.locationResolver.getLocation(data.startLocationId);
			if (location) resolved.startPoint = {
				coordinates: location.coordinates,
				name: location.name,
				type: "location_ref",
				locationId: data.startLocationId
			};
		}
		if (data.endLocationId && !data.endPoint) {
			const location = await this.locationResolver.getLocation(data.endLocationId);
			if (location) resolved.endPoint = {
				coordinates: location.coordinates,
				name: location.name,
				type: "location_ref",
				locationId: data.endLocationId
			};
		}
		if (data.waypointLocationIds && data.waypointLocationIds.length > 0) {
			const waypoints = [];
			for (const locationId of data.waypointLocationIds) {
				const location = await this.locationResolver.getLocation(locationId);
				if (location) waypoints.push({
					coordinates: location.coordinates,
					name: location.name,
					type: "location_ref",
					locationId
				});
			}
			if (waypoints.length > 0) resolved.waypoints = waypoints;
		}
		return resolved;
	}
	/**
	* Generate route geometry
	*/
	async generateRoute(data) {
		const config = {
			method: data.generationMethod || "direct",
			options: {}
		};
		const points = [];
		if (data.startPoint) points.push(data.startPoint.coordinates);
		if (data.waypoints) points.push(...data.waypoints.map((w) => w.coordinates));
		if (data.endPoint) points.push(data.endPoint.coordinates);
		if (points.length < 2) return { lineGeometry: [] };
		return await this.routeGenerator.generate(points, config);
	}
	/**
	* Check if route needs regeneration
	*/
	needsRouteRegeneration(existing, updates) {
		return [
			"startLocationId",
			"endLocationId",
			"waypointLocationIds",
			"startPoint",
			"endPoint",
			"waypoints",
			"generationMethod"
		].some((field) => updates[field] !== void 0 && JSON.stringify(updates[field]) !== JSON.stringify(existing[field]));
	}
	/**
	* Get routes by transport mode
	*/
	async getRoutesByTransportMode(mode) {
		return await this.table.where("transportMode").equals(mode).toArray();
	}
	/**
	* Get routes between locations
	*/
	async getRoutesBetweenLocations(startLocationId, endLocationId) {
		return await this.table.filter((route) => route.startLocationId === startLocationId && route.endLocationId === endLocationId).toArray();
	}
	/**
	* Find the shortest sequence of routes that connects two locations.
	* Uses Dijkstra's algorithm with route distance as the edge weight.
	* Returns an empty array when no connecting routes are available.
	*/
	async getShortestRouteSetBetweenLocations(startLocationId, endLocationId) {
		if (startLocationId === endLocationId) return [];
		const routes = await this.table.toArray();
		const adjacency = /* @__PURE__ */ new Map();
		for (const route of routes) {
			const start = route.startLocationId;
			const end = route.endLocationId;
			if (!start || !end || start === end) continue;
			const weight = this.getRouteWeight(route);
			if (weight === null) continue;
			let edges = adjacency.get(start);
			if (!edges) {
				edges = [];
				adjacency.set(start, edges);
			}
			edges.push({
				to: end,
				route,
				weight
			});
		}
		if (!adjacency.has(startLocationId)) return [];
		const distances = /* @__PURE__ */ new Map();
		const previousNodes = /* @__PURE__ */ new Map();
		const previousRoutes = /* @__PURE__ */ new Map();
		const visited = /* @__PURE__ */ new Set();
		const queue = [{
			nodeId: startLocationId,
			distance: 0
		}];
		distances.set(startLocationId, 0);
		while (queue.length > 0) {
			queue.sort((a, b) => a.distance - b.distance);
			const current = queue.shift();
			if (visited.has(current.nodeId)) continue;
			visited.add(current.nodeId);
			if (current.nodeId === endLocationId) break;
			const edges = adjacency.get(current.nodeId);
			if (!edges) continue;
			for (const edge of edges) {
				const newDistance = current.distance + edge.weight;
				if (newDistance < (distances.get(edge.to) ?? Number.POSITIVE_INFINITY)) {
					distances.set(edge.to, newDistance);
					previousNodes.set(edge.to, current.nodeId);
					previousRoutes.set(edge.to, edge.route);
					queue.push({
						nodeId: edge.to,
						distance: newDistance
					});
				}
			}
		}
		if (!previousRoutes.has(endLocationId)) return [];
		const path = [];
		let currentNode = endLocationId;
		while (currentNode && currentNode !== startLocationId) {
			const route = previousRoutes.get(currentNode);
			const previousNode = previousNodes.get(currentNode);
			if (!route || !previousNode) return [];
			path.push(route);
			currentNode = previousNode;
		}
		return path.reverse();
	}
	/**
	* Get connected routes from a location
	*/
	async getConnectedRoutes(locationId) {
		const allRoutes = await this.table.toArray();
		return {
			outgoing: allRoutes.filter((r) => r.startLocationId === locationId),
			incoming: allRoutes.filter((r) => r.endLocationId === locationId),
			passing: allRoutes.filter((r) => r.waypointLocationIds?.includes(locationId) || false)
		};
	}
	/**
	* Get route statistics
	*/
	async getStatistics() {
		const routes = await this.table.toArray();
		const stats = {
			totalRoutes: routes.length,
			byTransportMode: {},
			byGenerationMethod: {},
			totalDistance: 0,
			averageDistance: 0,
			connectedLocations: 0,
			processingStats: {
				pending: 0,
				processing: 0,
				completed: 0,
				failed: 0
			}
		};
		const connected = /* @__PURE__ */ new Set();
		for (const route of routes) {
			stats.byTransportMode[route.transportMode] = (stats.byTransportMode[route.transportMode] || 0) + 1;
			stats.byGenerationMethod[route.generationMethod] = (stats.byGenerationMethod[route.generationMethod] || 0) + 1;
			if (route.distance) stats.totalDistance += route.distance;
			if (route.startLocationId) connected.add(route.startLocationId);
			if (route.endLocationId) connected.add(route.endLocationId);
			const status = route.processingStatus;
			if (status) stats.processingStats[status]++;
		}
		stats.averageDistance = routes.length > 0 ? stats.totalDistance / routes.filter((r) => r.distance).length : 0;
		stats.connectedLocations = connected.size;
		return stats;
	}
	/**
	* Batch generate routes
	*/
	async batchGenerateRoutes(routeConfigs) {
		const routes = [];
		for (const config of routeConfigs) try {
			const route = await this.createEntity(config.nodeId, config.data);
			routes.push(route);
		} catch (error) {
			console.error(`Failed to generate route: ${error}`);
		}
		return routes;
	}
	/**
	* Apply additional search criteria
	*/
	getRouteWeight(route) {
		if (typeof route.distance === "number" && Number.isFinite(route.distance) && route.distance >= 0) return route.distance;
		if (route.lineGeometry && route.lineGeometry.length >= 2) {
			const lineDistance = this.calculateLineGeometryDistance(route.lineGeometry);
			if (lineDistance > 0) return lineDistance;
		}
		const coordinatePath = [];
		if (route.startPoint?.coordinates) coordinatePath.push(route.startPoint.coordinates);
		if (route.waypoints?.length) {
			for (const waypoint of route.waypoints) if (waypoint?.coordinates) coordinatePath.push(waypoint.coordinates);
		}
		if (route.endPoint?.coordinates) coordinatePath.push(route.endPoint.coordinates);
		if (coordinatePath.length >= 2) {
			const fallbackDistance = this.calculateLineGeometryDistance(coordinatePath);
			if (fallbackDistance > 0) return fallbackDistance;
		}
		return null;
	}
	calculateLineGeometryDistance(line) {
		let total = 0;
		for (let i = 0; i < line.length - 1; i++) {
			const current = line[i];
			const next = line[i + 1];
			if (!current || !next) continue;
			total += this.calculateDistance(current, next);
		}
		return total;
	}
	calculateDistance(point1, point2) {
		const R = 6371e3;
		const lat1 = this.toRadians(point1[1]);
		const lat2 = this.toRadians(point2[1]);
		const deltaLat = this.toRadians(point2[1] - point1[1]);
		const deltaLon = this.toRadians(point2[0] - point1[0]);
		const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
		return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
	}
	toRadians(degrees) {
		return degrees * (Math.PI / 180);
	}
	/**
	* Clean up route-specific data
	*/
	async cleanupEntityData(entity) {
		await this.routeDB.cleanupRouteCache(entity.id);
	}
};

//#endregion
//#region src/index.ts
let downloadRegistryModule = null;
function ensureDownloadRegistry() {
	if (!downloadRegistryModule) downloadRegistryModule = import("./registry.js");
	return downloadRegistryModule;
}
let workerAdaptersModule = null;
function ensureWorkerAdapterModule() {
	if (!workerAdaptersModule) workerAdaptersModule = import("./registerRuntimeWorker.js");
	return workerAdaptersModule;
}
async function registerRouteDownloadServiceFactory(factory) {
	return (await ensureDownloadRegistry()).registerRouteDownloadServiceFactory(factory);
}
async function registerRouteAuthNotifier(handler) {
	return (await ensureDownloadRegistry()).registerRouteAuthNotifier(handler);
}
async function resolveAuthRegistry() {
	return (await ensureDownloadRegistry()).resolveAuthRegistry();
}
async function registerRouteRuntimeWorkerAdapters() {
	return (await ensureWorkerAdapterModule()).registerRouteRuntimeWorkerAdapters();
}
/**
* Route Plugin Definition
*/
var RuntimeWiring = class {
	static registerAuthNotifier() {
		ensureDownloadRegistry().then(({ registerRouteAuthNotifier: setNotifier, resolveAuthRegistry: resolveRegistry }) => setNotifier((info) => {
			resolveRegistry()?.onAuthRequired?.(info);
		})).catch((error) => {
			console.warn("[route-plugin] registerAuthNotifier failed:", error);
		});
	}
	static async registerRuntimeWorkerAdapters() {
		try {
			await (await ensureWorkerAdapterModule()).registerRouteRuntimeWorkerAdapters();
		} catch (error) {
			console.warn("[route-plugin] registerRuntimeWorkerAdapters failed:", error);
		}
	}
};

//#endregion
export { OsrmEngine, RouteBatchLaunchForm, RouteBatchManager, RouteBatchOrchestrationService, RouteBatchSessionOrchestrator, RouteEntityHandler, PLUGIN_MANIFEST as RoutePluginManifest, RouteSourceOrchestrator, RouteTableQueryService, RuntimeWiring, SearouteEngine, ThrottledPort, createRouteBatchManager, detectLocale, formatDistance, formatDuration, getCategoryName, getOsrmEngineDefaults, getOsrmThrottleDefaults, getRouteTypeName, getTranslation, getTransportModeName, registerRouteAuthNotifier, registerRouteDownloadServiceFactory, registerRouteRuntimeWorkerAdapters, resolveAuthRegistry, translations, useRouteBatchProgress, useTranslation, worker_exports as worker };
//# sourceMappingURL=index.js.map