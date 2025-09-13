/**
 * Plugin Step Registry
 * Manages plugin-provided dialog steps
 */

import { ReactNode } from 'react';
import { DialogStep } from '@hierarchidb/ui-dialog';

/**
 * Plugin step provider interface
 */
export interface PluginStepProvider {
  /** Node type this provider handles */
  nodeType: string;

  /** Get steps for create mode */
  getCreateSteps(): DialogStep[];

  /** Get steps for edit mode */
  getEditSteps(nodeId: string, data?: any): DialogStep[];

  /** Optional validation before showing dialog */
  validateAccess?(nodeId?: string): Promise<boolean>;
}

/**
 * Plugin step configuration
 */
export interface PluginStepConfig {
  /** Step ID */
  id: string;

  /** Step label */
  label: string;

  /** Step component factory */
  componentFactory: (props: StepComponentProps) => ReactNode;

  /** Validation function */
  validate?: () => boolean | Promise<boolean>;

  /** Step capabilities */
  capabilities?: {
    canNavigateTo?: (fromStep: number, data: any) => boolean | Promise<boolean>;
    canStartBatch?: (data: any) => boolean | Promise<boolean>;
    canSave?: (data: any) => boolean | Promise<boolean>;
    canProceedToNext?: (data: any) => boolean | Promise<boolean>;
    canBackToPrevious?: (data: any) => boolean | Promise<boolean>;
  };

  /** Whether step is optional */
  optional?: boolean;

  /** Step icon */
  icon?: ReactNode;
}

/**
 * Props passed to step components
 */
export interface StepComponentProps {
  /** Dialog mode */
  mode: 'create' | 'edit';

  /** Node ID (for edit mode) */
  nodeId?: string;

  /** Parent node ID (for create mode) */
  parentId?: string;

  /** Current data */
  data: any;

  /** Update data */
  onChange: (data: any) => void;

  /** Mark step as valid/invalid */
  setValid: (valid: boolean) => void;

  /** Set step error message */
  setError: (error: string | null) => void;
}

/**
 * Plugin Step Registry
 */
export class PluginStepRegistry {
  private static instance: PluginStepRegistry;
  private providers: Map<string, PluginStepProvider> = new Map();

  private constructor() {
  }

  /**
   * Get singleton instance
   */
  static getInstance(): PluginStepRegistry {
    if (!PluginStepRegistry.instance) {
      PluginStepRegistry.instance = new PluginStepRegistry();
    }
    return PluginStepRegistry.instance;
  }

  /**
   * Register a step provider
   */
  register(provider: PluginStepProvider): void {
    if (this.providers.has(provider.nodeType)) {
      console.warn(`Provider for nodeType "${provider.nodeType}" is already registered`);
    }
    this.providers.set(provider.nodeType, provider);
    console.log(`Registered step provider for nodeType: ${provider.nodeType}`);
  }

  /**
   * Unregister a step provider
   */
  unregister(nodeType: string): void {
    this.providers.delete(nodeType);
  }

  /**
   * Get provider for node type
   */
  getProvider(nodeType: string): PluginStepProvider | undefined {
    return this.providers.get(nodeType);
  }

  /**
   * Get all registered node types
   */
  getRegisteredNodeTypes(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Get create steps for node type
   */
  getCreateSteps(nodeType: string): DialogStep[] {
    const provider = this.providers.get(nodeType);
    if (!provider) {
      console.warn(`No provider registered for nodeType: ${nodeType}`);
      return [];
    }
    return provider.getCreateSteps();
  }

  /**
   * Get edit steps for node type
   */
  getEditSteps(nodeType: string, nodeId: string, data?: any): DialogStep[] {
    const provider = this.providers.get(nodeType);
    if (!provider) {
      console.warn(`No provider registered for nodeType: ${nodeType}`);
      return [];
    }
    return provider.getEditSteps(nodeId, data);
  }

  /**
   * Validate access to node
   */
  async validateAccess(nodeType: string, nodeId?: string): Promise<boolean> {
    const provider = this.providers.get(nodeType);
    if (!provider) {
      // No provider: default-allow so generic dialog (Basic step only) can render
      return true;
    }

    if (provider.validateAccess) {
      return provider.validateAccess(nodeId);
    }

    return true;
  }

  /**
   * Clear all providers
   */
  clear(): void {
    this.providers.clear();
  }
}
