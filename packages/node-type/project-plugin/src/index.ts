// Main exports for @hierarchidb/project-plugin

// Plugin Definition
export { ProjectPluginDefinition } from './ProjectPlugin';

// Types
export * from './types/project-types';

// Database
export { ProjectDatabase, projectDB } from './database/project-database';

// Handlers
export { ProjectEntityHandler } from './handlers/ProjectEntityHandler';

// Analysis Engine
export { SpatialAnalysisEngine } from './analysis/SpatialAnalysisEngine';

// UI Components
export { ProjectWizard } from './components/wizard/ProjectWizard';
export { ProjectMapView } from './components/map/ProjectMapView';

// Wizard Steps
export { BasicInfoStep } from './components/wizard/steps/BasicInfoStep';
export { RegionConfigStep } from './components/wizard/steps/RegionConfigStep';
export { LayerConfigStep } from './components/wizard/steps/LayerConfigStep';
export { SpatialAnalysisStep } from './components/wizard/steps/SpatialAnalysisStep';
export { TemporalAnalysisStep } from './components/wizard/steps/TemporalAnalysisStep';
export { OutputConfigStep } from './components/wizard/steps/OutputConfigStep';

// Plugin registration helper
import { ProjectPluginDefinition } from './ProjectPlugin';

/**
 * Register the Project plugin with the node type registry
 */
export function registerProjectPlugin(registry: any): void {
  registry.register(ProjectPluginDefinition);
  console.log('Project plugin registered successfully');
}

// Default export for convenience
export default {
  plugin: ProjectPluginDefinition,
  register: registerProjectPlugin
};