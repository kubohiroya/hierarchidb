import { Dexie } from "dexie";
import { getDBName } from "@hierarchidb/util";

//#region src/services/database/RouteDatabase.ts
/**
* @file RouteDatabase.ts
* @description Database schema and operations for Route plugin
*/
var RouteDatabase = class extends Dexie {
	routes;
	workingCopies;
	routeCache;
	routeCursors;
	routeResults;
	pendingSessions;
	constructor(dbName = getDBName("route-db")) {
		super(dbName);
		this.version(1).stores({
			routes: "&id, nodeId, startLocationId, endLocationId, transportMode, [startLocationId+endLocationId], processingStatus, createdAt, updatedAt",
			workingCopies: "&id, nodeId, copiedAt",
			routeCache: "&id, routeId, cacheKey, expiresAt"
		});
		this.version(2).stores({
			routeCursors: "&sessionId, completed, total, updatedAt",
			routeResults: "&id, sessionId, taskId, method, createdAt"
		});
		this.version(3).stores({ pendingSessions: "&nodeId, storedAt" });
		this.version(4).stores({
			routes: "&id, nodeId, startLocationId, endLocationId, transportMode, [startLocationId+endLocationId], processingStatus, createdAt, updatedAt",
			workingCopies: "&id, nodeId, copiedAt",
			routeCache: "&id, routeId, cacheKey, expiresAt",
			routeCursors: "&sessionId, completed, total, updatedAt",
			routeResults: "&id, routeId, sessionId, taskId, method, createdAt",
			pendingSessions: "&nodeId, storedAt"
		});
		this.version(5).stores({
			routes: "&id, nodeId, startLocationId, endLocationId, transportMode, [startLocationId+endLocationId], processingStatus, createdAt, updatedAt",
			workingCopies: "&id, nodeId, copiedAt",
			routeCache: "&id, routeId, cacheKey, expiresAt",
			routeCursors: "&sessionId, nodeId, completed, total, updatedAt",
			routeResults: "&id, routeId, sessionId, taskId, method, createdAt",
			pendingSessions: "&nodeId, storedAt"
		});
		this.routes = this.table("routes");
		this.workingCopies = this.table("workingCopies");
		this.routeCache = this.table("routeCache");
		this.routeCursors = this.table("routeCursors");
		this.routeResults = this.table("routeResults");
		this.pendingSessions = this.table("pendingSessions");
	}
	async savePendingSession(record) {
		await this.pendingSessions.put(record);
	}
	async takePendingSession(nodeId) {
		const record = await this.pendingSessions.get(nodeId);
		if (record) await this.pendingSessions.delete(nodeId);
		return record;
	}
	/**
	* Clean up expired cache entries
	*/
	async cleanupExpiredCache() {
		const now = Date.now();
		await this.routeCache.where("expiresAt").below(now).delete();
	}
	/**
	* Clean up route-specific cache
	*/
	async cleanupRouteCache(routeId) {
		await this.routeCache.where("routeId").equals(routeId).delete();
	}
	/**
	* Get cached data for route
	*/
	async getCachedData(routeId, cacheKey) {
		const entry = await this.routeCache.where("[routeId+cacheKey]").equals([routeId, cacheKey]).first();
		if (!entry) return null;
		if (entry.expiresAt < Date.now()) {
			await this.routeCache.delete(entry.id);
			return null;
		}
		return entry.data;
	}
	/**
	* Set cached data for route
	*/
	async setCachedData(routeId, cacheKey, data, ttl = 36e5) {
		const now = Date.now();
		const entry = {
			id: `${routeId}_${cacheKey}`,
			routeId,
			cacheKey,
			data,
			createdAt: now,
			expiresAt: now + ttl
		};
		await this.routeCache.put(entry);
	}
	/**
	* Clean up expired working copies
	*/
	async cleanupExpiredDrafts(maxAge = 864e5) {
		const cutoff = Date.now() - maxAge;
		await this.workingCopies.where("copiedAt").below(cutoff).delete();
	}
	/**
	* Get database statistics
	*/
	async getStatistics() {
		const [totalRoutes, totalDrafts, totalCacheEntries] = await Promise.all([
			this.routes.count(),
			this.workingCopies.count(),
			this.routeCache.count()
		]);
		return {
			totalRoutes,
			totalDrafts,
			totalCacheEntries,
			cacheSize: (await this.routeCache.toArray()).reduce((sum, entry) => {
				return sum + JSON.stringify(entry.data).length;
			}, 0)
		};
	}
};

//#endregion
//#region src/services/database/clear.ts
async function clearDatabases() {
	await Dexie.delete(getDBName("route-db"));
}

//#endregion
export { RouteDatabase, clearDatabases };
//# sourceMappingURL=index.js.map