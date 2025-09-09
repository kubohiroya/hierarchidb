/**
  * @file DialogStepRegistry.ts
 * @description
  */

// Local type definitions until common-type exports are fixed
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

export interface DialogStepDefinition {
  stepNumber: number;
  title: string;
  description?: string;
  component: React.ComponentType<any>;
  validation?: {
    validate: (data: any) => Promise<ValidationResult> | ValidationResult;
  };
  dependsOn?: number[];
  isOptional?: boolean;
}

// ============================================================================
// ============================================================================

/**
    */
export interface StepRegistration {
  /**
      */
  pluginName: string;
  /**
      */
  definition: DialogStepDefinition;
  /**
      */
  registeredAt: number;
  /**
      */
  priority?: number;
}

/**
    */
export interface StepDependency {
  /**
      */
  stepNumber: number;
  /**
      */
  dependsOn: number[];
  /**
      */
  required: boolean;
}

/**
    */
export interface RegistryOptions {
  /**
      */
  allowDuplicates?: boolean;
  /**
      */
  autoSort?: boolean;
  /**
      */
  checkCircularDependencies?: boolean;
}

// ============================================================================
//  DialogStepRegistry
// ============================================================================

/**
    */
export class DialogStepRegistry {
  private static instance: DialogStepRegistry;
  private registrations: Map<string, StepRegistration[]> = new Map();
  private options: RegistryOptions;

  private constructor(options: RegistryOptions = {}) {
    this.options = {
      allowDuplicates: false,
      autoSort: true,
      checkCircularDependencies: true,
      ...options,
    };
  }

  /**
            */
  public static getInstance(options?: RegistryOptions): DialogStepRegistry {
    if (!DialogStepRegistry.instance) {
      DialogStepRegistry.instance = new DialogStepRegistry(options);
    }
    return DialogStepRegistry.instance;
  }

  /**
            */
  public registerStep(
    pluginName: string,
    definition: DialogStepDefinition,
    priority?: number,
  ): void {
    const registration: StepRegistration = {
      pluginName,
      definition,
      registeredAt: Date.now(),
      priority,
    };

    if (!this.registrations.has(pluginName)) {
      this.registrations.set(pluginName, []);
    }

    const steps = this.registrations.get(pluginName)!;

    if (!this.options.allowDuplicates) {
      const exists = steps.some((s) => s.definition.stepNumber === definition.stepNumber);
      if (exists) {
        throw new Error(
          `Step ${definition.stepNumber} is already registered for plugin ${pluginName}`,
        );
      }
    }

    steps.push(registration);

    if (this.options.autoSort) {
      steps.sort((a, b) => a.definition.stepNumber - b.definition.stepNumber);
    }

    if (this.options.checkCircularDependencies && definition.dependsOn) {
      this.checkCircularDependencies(pluginName, definition.stepNumber);
    }
  }

  /**
            */
  public registerSteps(
    pluginName: string,
    definitions: DialogStepDefinition[],
    priority?: number,
  ): void {
    definitions.forEach((def) => {
      this.registerStep(pluginName, def, priority);
    });
  }

  /**
            */
  public getStep(pluginName: string, stepNumber: number): DialogStepDefinition | undefined {
    const steps = this.registrations.get(pluginName);
    if (!steps) return undefined;

    const registration = steps.find((s) => s.definition.stepNumber === stepNumber);
    return registration?.definition;
  }

  /**
            */
  public getSteps(pluginName: string): DialogStepDefinition[] {
    const steps = this.registrations.get(pluginName);
    if (!steps) return [];

    return steps.map((s) => s.definition);
  }

  /**
            */
  public getMergedSteps(basePlugin: string, ...extendedPlugins: string[]): DialogStepDefinition[] {
    const stepMap = new Map<number, DialogStepDefinition>();

    const baseSteps = this.getSteps(basePlugin);
    baseSteps.forEach((step) => {
      stepMap.set(step.stepNumber, step);
    });

    for (const plugin of extendedPlugins) {
      const steps = this.getSteps(plugin);
      steps.forEach((step) => {
        stepMap.set(step.stepNumber, step);
      });
    }

    return Array.from(stepMap.values()).sort((a, b) => a.stepNumber - b.stepNumber);
  }

  /**
            */
  public unregisterStep(pluginName: string, stepNumber: number): boolean {
    const steps = this.registrations.get(pluginName);
    if (!steps) return false;

    const index = steps.findIndex((s) => s.definition.stepNumber === stepNumber);
    if (index === -1) return false;

    steps.splice(index, 1);

    if (steps.length === 0) {
      this.registrations.delete(pluginName);
    }

    return true;
  }

  /**
            */
  public unregisterPlugin(pluginName: string): boolean {
    return this.registrations.delete(pluginName);
  }

  /**
            */
  public validateDependencies(pluginName: string): ValidationResult {
    const steps = this.getSteps(pluginName);
    const stepNumbers = new Set(steps.map((s) => s.stepNumber));
    const errors: string[] = [];

    for (const step of steps) {
      if (step.dependsOn) {
        for (const dep of step.dependsOn) {
          if (!stepNumbers.has(dep)) {
            errors.push(`Step ${step.stepNumber} depends on non-existent step ${dep}`);
          }
          if (dep >= step.stepNumber) {
            errors.push(`Step ${step.stepNumber} cannot depend on later step ${dep}`);
          }
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
            */
  private checkCircularDependencies(pluginName: string, stepNumber: number): void {
    const visited = new Set<number>();
    const recursionStack = new Set<number>();

    const hasCycle = (currentStep: number): boolean => {
      visited.add(currentStep);
      recursionStack.add(currentStep);

      const step = this.getStep(pluginName, currentStep);
      if (step?.dependsOn) {
        for (const dep of step.dependsOn) {
          if (!visited.has(dep)) {
            if (hasCycle(dep)) return true;
          } else if (recursionStack.has(dep)) {
            return true;
          }
        }
      }

      recursionStack.delete(currentStep);
      return false;
    };

    if (hasCycle(stepNumber)) {
      throw new Error(`Circular dependency detected for step ${stepNumber}`);
    }
  }

  /**
            */
  public getExecutionOrder(pluginName: string): number[] {
    const steps = this.getSteps(pluginName);
    const visited = new Set<number>();
    const order: number[] = [];

    const visit = (stepNumber: number) => {
      if (visited.has(stepNumber)) return;

      const step = steps.find((s) => s.stepNumber === stepNumber);
      if (step?.dependsOn) {
        step.dependsOn.forEach((dep: number) => visit(dep));
      }

      visited.add(stepNumber);
      order.push(stepNumber);
    };

    steps.forEach((step) => visit(step.stepNumber));

    return order;
  }

  /**
            */
  public async aggregateResults(
    pluginName: string,
    stepData: Map<number, Record<string, unknown>>,
  ): Promise<Record<string, unknown>> {
    let aggregated: Record<string, unknown> = {};

    const order = this.getExecutionOrder(pluginName);
    for (const stepNumber of order) {
      const data = stepData.get(stepNumber);
      if (data) {
        aggregated = { ...aggregated, ...data };
      }
    }

    return aggregated;
  }

  /**
            */
  public async runValidationChain(
    pluginName: string,
    stepData: Map<number, Record<string, unknown>>,
  ): Promise<Map<number, ValidationResult>> {
    const steps = this.getSteps(pluginName);
    const results = new Map<number, ValidationResult>();

    for (const step of steps) {
      if (step.validation) {
        const data = stepData.get(step.stepNumber) || {};
        const result = await step.validation.validate(data);
        results.set(step.stepNumber, result);

        if (!result.isValid && step.dependsOn) {
          const dependentSteps = steps.filter((s) => s.dependsOn?.includes(step.stepNumber));
          dependentSteps.forEach((s) => {
            results.set(s.stepNumber, {
              isValid: false,
              errors: [`Skipped due to error in step ${step.stepNumber}`],
            });
          });
        }
      }
    }

    return results;
  }

  /**
            */
  public clear(): void {
    this.registrations.clear();
  }

  /**
            */
  public getRegistrationInfo(): Map<string, StepRegistration[]> {
    return new Map(this.registrations);
  }

  /**
            */
  public getStatistics(): {
    totalPlugins: number;
    totalSteps: number;
    pluginStats: Map<string, number>;
  } {
    const pluginStats = new Map<string, number>();
    let totalSteps = 0;

    this.registrations.forEach((steps, plugin) => {
      pluginStats.set(plugin, steps.length);
      totalSteps += steps.length;
    });

    return {
      totalPlugins: this.registrations.size,
      totalSteps,
      pluginStats,
    };
  }
}

export const stepRegistry = DialogStepRegistry.getInstance();
