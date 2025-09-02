// Main exports for @hierarchidb/project-plugin

// Plugin Definition
export { ProjectPluginDefinition } from './ProjectPlugin';

// Types
export * from './types/project-types';

// Database
export { ProjectDatabase, projectDB } from './database/project-database';

// Handlers
export { ProjectEntityHandler } from './handlers/ProjectEntityHandler';

// API
export { projectPluginAPI } from './api/ProjectPluginAPI';
export type { AnalysisSession, ProjectHealthStatus } from './api/ProjectPluginAPI';

// Utils
export * from './shared/utils';

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
import { projectPluginAPI } from './api/ProjectPluginAPI';

/**
 * Register the Project plugin with the node type registry
 */
export async function registerProjectPlugin(registry: any): Promise<void> {
  // Initialize the plugin API
  await projectPluginAPI.initialize();
  
  // Register the plugin
  registry.register(ProjectPluginDefinition);
  console.log('Project plugin registered successfully');
}

// Create named export for the plugin module
export const ProjectPluginModule = {
  plugin: ProjectPluginDefinition,
  register: registerProjectPlugin,
  api: projectPluginAPI
};

// Default export
export default ProjectPluginModule;