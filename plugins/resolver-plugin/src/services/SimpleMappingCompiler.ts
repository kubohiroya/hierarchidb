import type { PropertyMappingRule } from '~/common/types/index';

export type CompiledFunction = (data: any) => any;

/**
 * Simple MappingCompiler for testing
 */
export class MappingCompiler {
  /**
   * Compile mapping rules into a function
   */
  compile(mappingRules: PropertyMappingRule[]): CompiledFunction {
    return (data: any) => {
      const result: any = {};

      for (const rule of mappingRules) {
        // Get value from source path
        const value = this.getValueByPath(data, rule.sourceProperty);

        // Apply transformation if specified
        let transformedValue = value;
        if (rule.transformFunction && value !== undefined) {
          try {
            // Create a safe evaluation context
            // Handle both single expressions and multi-line functions
            const funcBody = rule.transformFunction.trim();
            let transformFn: Function;

            if (funcBody.includes('return') || funcBody.includes(';')) {
              // Multi-line function body
              transformFn = new Function('value', funcBody);
            } else {
              // Single expression
              transformFn = new Function('value', `return (${funcBody})`);
            }

            transformedValue = transformFn(value);
          } catch (e) {
            console.error(`Transform error for ${rule.sourceProperty}:`, e);
            transformedValue = value;
          }
        }

        // Use default value if needed
        if (transformedValue === undefined && rule.defaultValue !== undefined) {
          transformedValue = rule.defaultValue;
        }

        // Set value in result
        this.setValueByPath(result, rule.targetProperty, transformedValue);
      }

      return result;
    };
  }

  /**
   * Get value from object by dot-notation path
   */
  private getValueByPath(obj: any, path: string): any {
    const parts = path.split('.');
    let current = obj;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[part];
    }

    return current;
  }

  /**
   * Set value in object by dot-notation path
   */
  private setValueByPath(obj: any, path: string, value: any): void {
    const parts = path.split('.');
    const lastPart = parts.pop()!;
    let current = obj;

    for (const part of parts) {
      if (!(part in current)) {
        current[part] = {};
      }
      current = current[part];
    }

    current[lastPart] = value;
  }
}