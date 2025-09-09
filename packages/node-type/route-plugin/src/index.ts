/**
  * Route Plugin Entry Point
   */

// Plugin components are exported via re-exports below

// Export all types
// Export all types and components
// Avoid re-exporting names that collide with orchestrator/types (e.g., TransportMode)
export type { RouteEntity, RouteWorkingCopy, RouteProcessingConfig, RouteParameters, RouteStatistics } from './types';
export * from './entities/RouteEntityHandler';
export * from './components';
export * from './i18n';
export { ThrottledPort } from './services/net/ThrottledPort';
export * from './services/engines/OsrmEngine';
export * from './services/engines/SearouteEngine';
export { createRouteBatchManager } from './services/createRouteBatchManager';
export * from './orchestrator/types';
export * from './orchestrator/RouteSourceOrchestrator';
export * from './orchestrator/RouteBatchOrchestrationService';
export * from './services/config/osrm-defaults';
export * from './ui/components/RouteBatchLaunchForm';
export * from './orchestrator/RouteSourceOrchestrator';
export * from './orchestrator/RouteBatchOrchestrationService';
export * from './ui/hooks/useRouteBatchProgress';
export * from './ui/components/RouteBatchProgressBar';
export { TabularQueryService as RouteTableQueryService } from '@hierarchidb/tabular-store';

// Unified Batch Control API (API v2)
export * from './services/UnifiedRouteBatchManager';
export { RouteBatchManager } from './services/RouteBatchManager';

// UI Hooks/Components (minimal)
export * from './ui/hooks/useRouteBatchProgress';
export * from './ui/components/RouteBatchProgressBar';

/**
 * Route Plugin Definition
 */
// Plugin Definition (commented out - will be implemented when integrated with main app)
/*
 export const RoutePluginDefinition: PluginDefinition<RouteEntity, RouteWorkingCopy> = {
 nodeType: 'route',
 displayName: 'Route',
 description: 'Transportation routes and networks',
 icon: '',
 color: '#FF9800',
 // Database configuration
 database: {
 entityStore: 'routes',
 workingCopyStore: 'routeWorkingCopies',
 schema: {
 routes: '&id, nodeId, [nodeId+name], createdAt, updatedAt',
 routeWorkingCopies: '&id, nodeId, isDraft, createdAt, updatedAt',
 },
 version: 1,
 },
 // Entity handler
 entityHandler: RouteEntityHandler,
 // UI components
 ui: {
 dialogComponent: RouteDialog,
 panelComponent: RoutePanel,
 },
 // Lifecycle hooks
 lifecycle: {
 afterCreate: async (node: any, context: any) => {
 console.log('Route node created:', node.id);
 },
 beforeDelete: async (node: any, context: any) => {
 // Cleanup any associated data
 console.log('Route node will be deleted:', node.id);
 },
 },
 // Capabilities
 capabilities: {
 supportsWorkingCopy: true,
 supportsBatchProcessing: true,
 supportsExport: true,
 supportsImport: true,
 supportsVersioning: true,
 },
 };
 export default RoutePluginDefinition;
*/
