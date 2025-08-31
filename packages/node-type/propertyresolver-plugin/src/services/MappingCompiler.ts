import type { PropertyMappingRule, ValidationRule, DuplicateResolutionStrategy } from '~/types';

/**
 * Optimization levels for compilation
 */
export type OptimizationLevel = 'none' | 'basic' | 'aggressive';

/**
 * Compiled mapping function metadata
 */
export interface CompiledMapping {
  id: string;
  sourceResolverIds: string[];
  compiledFunction: string;
  compiledAt: number;
  metadata: {
    inputSchema: any;
    outputSchema: any;
    optimizationLevel: OptimizationLevel;
    executionPlan: ExecutionPlan;
    estimatedSpeedup: number;
  };
  cache: {
    strategy: 'memory' | 'indexeddb' | 'hybrid';
    ttl: number;
    invalidateOn: string[];
  };
}

/**
 * Execution plan for optimized mapping
 */
export interface ExecutionPlan {
  steps: ExecutionStep[];
  parallelizable: boolean;
  estimatedCost: number;
  optimizations: Optimization[];
}

/**
 * Individual execution step
 */
export interface ExecutionStep {
  id: string;
  type: 'map' | 'validate' | 'transform' | 'deduplicate';
  operation: string;
  dependencies: string[];
  canParallelize: boolean;
  estimatedCost: number;
}

/**
 * Optimization applied during compilation
 */
export interface Optimization {
  type: 'constant-folding' | 'cse' | 'dead-code' | 'loop-fusion' | 'parallel';
  description: string;
  estimatedImprovement: number;
}

/**
 * Compilation statistics
 */
export interface CompilationStats {
  originalExecutionTime: number;
  compiledExecutionTime: number;
  speedup: number;
  memoryReduction: number;
  cacheHitRate: number;
}

/**
 * Compiler for PropertyResolver mappings
 * Generates optimized JavaScript functions from mapping rules
 */
export class MappingCompiler {
  private compiledCache: Map<string, CompiledMapping> = new Map();
  private executionStats: Map<string, CompilationStats> = new Map();

  /**
   * Compile mapping rules into optimized function
   */
  async compile(
    mappingRules: PropertyMappingRule[],
    validationRules: ValidationRule[],
    duplicateStrategy: DuplicateResolutionStrategy,
    options: {
      optimizationLevel?: OptimizationLevel;
      enableCache?: boolean;
      parallelThreshold?: number;
    } = {}
  ): Promise<CompiledMapping> {
    const {
      optimizationLevel = 'aggressive',
      enableCache = true,
      parallelThreshold: _parallelThreshold = 1000,
    } = options;

    // Generate cache key
    const cacheKey = this.generateCacheKey(mappingRules, validationRules, duplicateStrategy);
    
    // Check cache
    if (enableCache && this.compiledCache.has(cacheKey)) {
      return this.compiledCache.get(cacheKey)!;
    }

    // Build execution plan
    const executionPlan = this.buildExecutionPlan(
      mappingRules,
      validationRules,
      duplicateStrategy,
      optimizationLevel
    );

    // Generate optimized function
    const compiledFunction = this.generateOptimizedFunction(
      executionPlan,
      mappingRules,
      validationRules,
      duplicateStrategy
    );

    // Create compiled mapping
    const compiled: CompiledMapping = {
      id: crypto.randomUUID(),
      sourceResolverIds: mappingRules.map(r => r.id),
      compiledFunction,
      compiledAt: Date.now(),
      metadata: {
        inputSchema: this.extractInputSchema(mappingRules),
        outputSchema: this.extractOutputSchema(mappingRules),
        optimizationLevel,
        executionPlan,
        estimatedSpeedup: this.estimateSpeedup(executionPlan),
      },
      cache: {
        strategy: 'hybrid',
        ttl: 3600000, // 1 hour
        invalidateOn: ['schema-change', 'rule-update'],
      },
    };

    // Cache the result
    if (enableCache) {
      this.compiledCache.set(cacheKey, compiled);
    }

    return compiled;
  }

  /**
   * Build execution plan with optimizations
   */
  private buildExecutionPlan(
    mappingRules: PropertyMappingRule[],
    validationRules: ValidationRule[],
    duplicateStrategy: DuplicateResolutionStrategy,
    optimizationLevel: OptimizationLevel
  ): ExecutionPlan {
    const steps: ExecutionStep[] = [];
    const optimizations: Optimization[] = [];

    // Analyze dependencies between rules
    const dependencies = this.analyzeDependencies(mappingRules);

    // Group independent mappings for parallel execution
    const parallelGroups = this.groupParallelizable(mappingRules, dependencies);
    
    // Add mapping steps
    parallelGroups.forEach((group, index) => {
      steps.push({
        id: `map-group-${index}`,
        type: 'map',
        operation: `Apply ${group.length} mapping rules`,
        dependencies: [],
        canParallelize: group.length > 1,
        estimatedCost: group.length * 10,
      });
    });

    // Add validation steps
    if (validationRules.length > 0) {
      steps.push({
        id: 'validate',
        type: 'validate',
        operation: `Apply ${validationRules.length} validation rules`,
        dependencies: steps.map(s => s.id),
        canParallelize: false,
        estimatedCost: validationRules.length * 5,
      });
    }

    // Add deduplication step
    if (duplicateStrategy.strategy !== 'ignore') {
      steps.push({
        id: 'deduplicate',
        type: 'deduplicate',
        operation: `Apply ${duplicateStrategy.strategy} deduplication`,
        dependencies: ['validate'],
        canParallelize: false,
        estimatedCost: 20,
      });
    }

    // Apply optimizations based on level
    if (optimizationLevel !== 'none') {
      optimizations.push(...this.identifyOptimizations(mappingRules, validationRules, optimizationLevel));
    }

    return {
      steps,
      parallelizable: parallelGroups.some(g => g.length > 1),
      estimatedCost: steps.reduce((sum, step) => sum + step.estimatedCost, 0),
      optimizations,
    };
  }

  /**
   * Generate optimized JavaScript function
   */
  private generateOptimizedFunction(
    plan: ExecutionPlan,
    mappingRules: PropertyMappingRule[],
    validationRules: ValidationRule[],
    duplicateStrategy: DuplicateResolutionStrategy
  ): string {
    const functionBody = `
      // Optimized mapping function generated at ${new Date().toISOString()}
      // Optimization level: ${plan.optimizations.length} optimizations applied
      
      function compiledMapper(input) {
        // Input validation
        if (!input || typeof input !== 'object') {
          throw new Error('Invalid input: expected object or array');
        }
        
        const isArray = Array.isArray(input);
        const data = isArray ? input : [input];
        const results = [];
        const seen = new Map(); // For deduplication
        
        // Process each record
        for (let i = 0; i < data.length; i++) {
          const record = data[i];
          const mapped = {};
          
          ${this.generateMappingCode(mappingRules, plan)}
          
          ${this.generateValidationCode(validationRules)}
          
          ${this.generateDeduplicationCode(duplicateStrategy)}
          
          results.push(mapped);
        }
        
        return isArray ? results : results[0];
      }
      
      // Return the compiled function
      compiledMapper;
    `;

    return functionBody;
  }

  /**
   * Generate mapping code
   */
  private generateMappingCode(rules: PropertyMappingRule[], plan: ExecutionPlan): string {
    const parallelGroups = plan.steps.filter(s => s.type === 'map' && s.canParallelize);
    
    if (parallelGroups.length > 0) {
      // Generate parallel mapping code
      return rules.map(rule => `
          // Map ${rule.sourceProperty} -> ${rule.targetProperty}
          if (record['${rule.sourceProperty}'] !== undefined) {
            mapped['${rule.targetProperty}'] = ${
              rule.transformFunction 
                ? this.generateTransformCode(rule.transformFunction, `record['${rule.sourceProperty}']`)
                : `record['${rule.sourceProperty}']`
            };
          }
      `).join('\n');
    } else {
      // Sequential mapping
      return rules.map(rule => `
          // Map ${rule.sourceProperty} -> ${rule.targetProperty}
          if (record['${rule.sourceProperty}'] !== undefined) {
            mapped['${rule.targetProperty}'] = record['${rule.sourceProperty}'];
            ${rule.transformFunction ? `
            // Apply transformation: ${rule.transformFunction}
            mapped['${rule.targetProperty}'] = ${this.generateTransformCode(rule.transformFunction, `mapped['${rule.targetProperty}']`)};
            ` : ''}
          }
      `).join('\n');
    }
  }

  /**
   * Generate transformation code
   */
  private generateTransformCode(transform: string, value: string): string {
    // Handle common transformations
    switch (transform) {
      case 'lowercase':
        return `String(${value}).toLowerCase()`;
      case 'uppercase':
        return `String(${value}).toUpperCase()`;
      case 'trim':
        return `String(${value}).trim()`;
      case 'number':
        return `Number(${value})`;
      case 'string':
        return `String(${value})`;
      case 'boolean':
        return `Boolean(${value})`;
      default:
        // Custom transform function
        if (transform.includes('(')) {
          // Function call
          return `${transform.replace('$value', value)}`;
        } else {
          // Simple expression
          return `(${transform})`;
        }
    }
  }

  /**
   * Generate validation code
   */
  private generateValidationCode(rules: ValidationRule[]): string {
    if (rules.length === 0) return '';

    return `
          // Validation
          const errors = [];
          ${rules.map(rule => {
            switch (rule.ruleType) {
              case 'required':
                return `
          if (mapped['${rule.property}'] === undefined || mapped['${rule.property}'] === null) {
            errors.push('${rule.errorMessage || `${rule.property} is required`}');
          }`;
              case 'type':
                return `
          if (typeof mapped['${rule.property}'] !== '${rule.parameters.expectedType}') {
            errors.push('${rule.errorMessage || `${rule.property} must be ${rule.parameters.expectedType}`}');
          }`;
              case 'range':
                const min = rule.parameters.min;
                const max = rule.parameters.max;
                return `
          if (${min !== undefined ? `mapped['${rule.property}'] < ${min}` : 'false'} || 
              ${max !== undefined ? `mapped['${rule.property}'] > ${max}` : 'false'}) {
            errors.push('${rule.errorMessage || `${rule.property} out of range`}');
          }`;
              case 'pattern':
                return `
          if (!/${rule.parameters.pattern}/.test(String(mapped['${rule.property}']))) {
            errors.push('${rule.errorMessage || `${rule.property} does not match pattern`}');
          }`;
              default:
                return '';
            }
          }).join('\n')}
          
          if (errors.length > 0) {
            mapped._errors = errors;
          }
    `;
  }

  /**
   * Generate deduplication code
   */
  private generateDeduplicationCode(strategy: DuplicateResolutionStrategy): string {
    if (strategy.strategy === 'ignore') return '';

    return `
          // Deduplication
          const key = JSON.stringify(mapped); // Simple key generation
          
          if (seen.has(key)) {
            const existing = seen.get(key);
            ${(() => {
              switch (strategy.strategy) {
                case 'skip':
                  return 'continue; // Skip duplicate';
                case 'overwrite':
                  return '// Overwrite with new value';
                case 'merge':
                  return `
            // Merge with existing
            Object.assign(existing, mapped);
            continue;`;
                default:
                  return '';
              }
            })()}
          } else {
            seen.set(key, mapped);
          }
    `;
  }

  /**
   * Analyze dependencies between mapping rules
   */
  private analyzeDependencies(rules: PropertyMappingRule[]): Map<string, Set<string>> {
    const deps = new Map<string, Set<string>>();
    
    rules.forEach(rule => {
      const dependencies = new Set<string>();
      
      // Check if this rule depends on other mapped properties
      rules.forEach(otherRule => {
        if (rule.id !== otherRule.id && 
            rule.transformFunction?.includes(otherRule.targetProperty)) {
          dependencies.add(otherRule.id);
        }
      });
      
      deps.set(rule.id, dependencies);
    });
    
    return deps;
  }

  /**
   * Group rules that can be executed in parallel
   */
  private groupParallelizable(
    rules: PropertyMappingRule[],
    dependencies: Map<string, Set<string>>
  ): PropertyMappingRule[][] {
    const groups: PropertyMappingRule[][] = [];
    const processed = new Set<string>();
    
    while (processed.size < rules.length) {
      const group: PropertyMappingRule[] = [];
      
      for (const rule of rules) {
        if (processed.has(rule.id)) continue;
        
        const deps = dependencies.get(rule.id) || new Set();
        const canAdd = Array.from(deps).every(dep => processed.has(dep));
        
        if (canAdd) {
          group.push(rule);
        }
      }
      
      if (group.length > 0) {
        groups.push(group);
        group.forEach(rule => processed.add(rule.id));
      } else {
        // Circular dependency or error
        break;
      }
    }
    
    return groups;
  }

  /**
   * Identify applicable optimizations
   */
  private identifyOptimizations(
    mappingRules: PropertyMappingRule[],
    validationRules: ValidationRule[],
    level: OptimizationLevel
  ): Optimization[] {
    const optimizations: Optimization[] = [];
    
    // Constant folding
    const constantTransforms = mappingRules.filter(r => 
      r.transformFunction && /^\d+$/.test(r.transformFunction)
    );
    if (constantTransforms.length > 0) {
      optimizations.push({
        type: 'constant-folding',
        description: `Fold ${constantTransforms.length} constant transformations`,
        estimatedImprovement: constantTransforms.length * 2,
      });
    }
    
    // Common subexpression elimination
    const duplicateTransforms = this.findDuplicateTransforms(mappingRules);
    if (duplicateTransforms.length > 0) {
      optimizations.push({
        type: 'cse',
        description: `Eliminate ${duplicateTransforms.length} common subexpressions`,
        estimatedImprovement: duplicateTransforms.length * 5,
      });
    }
    
    // Dead code elimination
    const unusedMappings = this.findUnusedMappings(mappingRules, validationRules);
    if (unusedMappings.length > 0 && level === 'aggressive') {
      optimizations.push({
        type: 'dead-code',
        description: `Remove ${unusedMappings.length} unused mappings`,
        estimatedImprovement: unusedMappings.length * 3,
      });
    }
    
    // Loop fusion
    if (mappingRules.length > 10 && level === 'aggressive') {
      optimizations.push({
        type: 'loop-fusion',
        description: 'Fuse mapping loops for better cache locality',
        estimatedImprovement: 15,
      });
    }
    
    // Parallelization
    const parallelizable = this.countParallelizable(mappingRules);
    if (parallelizable > 5) {
      optimizations.push({
        type: 'parallel',
        description: `Parallelize ${parallelizable} independent mappings`,
        estimatedImprovement: parallelizable * 10,
      });
    }
    
    return optimizations;
  }

  /**
   * Find duplicate transform functions
   */
  private findDuplicateTransforms(rules: PropertyMappingRule[]): string[] {
    const transforms = new Map<string, number>();
    
    rules.forEach(rule => {
      if (rule.transformFunction) {
        const count = transforms.get(rule.transformFunction) || 0;
        transforms.set(rule.transformFunction, count + 1);
      }
    });
    
    return Array.from(transforms.entries())
      .filter(([_, count]) => count > 1)
      .map(([transform, _]) => transform);
  }

  /**
   * Find unused mappings
   */
  private findUnusedMappings(
    mappingRules: PropertyMappingRule[],
    validationRules: ValidationRule[]
  ): PropertyMappingRule[] {
    const usedProperties = new Set<string>();
    
    // Collect properties used in validations
    validationRules.forEach(rule => {
      usedProperties.add(rule.property);
    });
    
    // Find mappings not used anywhere
    return mappingRules.filter(rule => 
      !usedProperties.has(rule.targetProperty)
    );
  }

  /**
   * Count parallelizable mappings
   */
  private countParallelizable(rules: PropertyMappingRule[]): number {
    const deps = this.analyzeDependencies(rules);
    return rules.filter(rule => {
      const ruleDeps = deps.get(rule.id) || new Set();
      return ruleDeps.size === 0;
    }).length;
  }

  /**
   * Generate cache key for compiled mapping
   */
  private generateCacheKey(
    mappingRules: PropertyMappingRule[],
    validationRules: ValidationRule[],
    duplicateStrategy: DuplicateResolutionStrategy
  ): string {
    const rulesHash = JSON.stringify({
      mappings: mappingRules.map(r => ({
        source: r.sourceProperty,
        target: r.targetProperty,
        transform: r.transformFunction,
      })),
      validations: validationRules?.map(r => ({
        property: r.property,
        type: r.ruleType,
        params: r.parameters,
      })) || [],
      duplicate: duplicateStrategy.strategy,
    });
    
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < rulesHash.length; i++) {
      const char = rulesHash.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    return `compiled_${hash}`;
  }

  /**
   * Extract input schema from mapping rules
   */
  private extractInputSchema(rules: PropertyMappingRule[]): any {
    const properties: Record<string, any> = {};
    
    rules.forEach(rule => {
      properties[rule.sourceProperty] = {
        type: 'any', // Would be inferred from actual data
        required: rule.isRequired,
      };
    });
    
    return { properties };
  }

  /**
   * Extract output schema from mapping rules
   */
  private extractOutputSchema(rules: PropertyMappingRule[]): any {
    const properties: Record<string, any> = {};
    
    rules.forEach(rule => {
      properties[rule.targetProperty] = {
        type: 'any', // Would be inferred from transformation
        source: rule.sourceProperty,
      };
    });
    
    return { properties };
  }

  /**
   * Estimate speedup from execution plan
   */
  private estimateSpeedup(plan: ExecutionPlan): number {
    const baselineCoast = plan.steps.length * 100;
    const optimizedCost = plan.estimatedCost;
    const optimizationBonus = plan.optimizations.reduce((sum, opt) => 
      sum + opt.estimatedImprovement, 0
    );
    
    return Math.max(1, (baselineCoast - optimizationBonus) / optimizedCost);
  }

  /**
   * Execute compiled mapping
   */
  async execute(compiled: CompiledMapping, data: any): Promise<any> {
    const startTime = performance.now();
    
    try {
      // Create function from compiled string
      const func = new Function('return ' + compiled.compiledFunction)();
      
      // Execute the function
      const result = func(data);
      
      // Update statistics
      const executionTime = performance.now() - startTime;
      this.updateStats(compiled.id, executionTime);
      
      return result;
    } catch (error) {
      console.error('Compiled execution failed:', error);
      throw error;
    }
  }

  /**
   * Update execution statistics
   */
  private updateStats(compiledId: string, executionTime: number): void {
    const stats = this.executionStats.get(compiledId) || {
      originalExecutionTime: 0,
      compiledExecutionTime: 0,
      speedup: 1,
      memoryReduction: 0,
      cacheHitRate: 0,
    };
    
    // Update rolling average
    stats.compiledExecutionTime = (stats.compiledExecutionTime * 0.9) + (executionTime * 0.1);
    
    this.executionStats.set(compiledId, stats);
  }

  /**
   * Get compilation statistics
   */
  getStats(compiledId: string): CompilationStats | undefined {
    return this.executionStats.get(compiledId);
  }

  /**
   * Clear compilation cache
   */
  clearCache(): void {
    this.compiledCache.clear();
    this.executionStats.clear();
  }
}