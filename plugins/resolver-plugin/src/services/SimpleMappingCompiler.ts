import type { PropertyMappingRule } from '~/common/types/index';

type JsonRecord = Record<string, unknown>;
type TransformFunction = (value: unknown) => unknown;

const isRecord = (value: unknown): value is JsonRecord =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export type CompiledFunction = (data: unknown) => JsonRecord;

/**
 * Simple MappingCompiler for testing
 */
export class MappingCompiler {
  /**
   * Compile mapping rules into a function
   */
  compile(mappingRules: PropertyMappingRule[]): CompiledFunction {
    return (data: unknown) => {
      const result: JsonRecord = {};

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
            let transformFn: TransformFunction;

            if (funcBody.includes('return') || funcBody.includes(';')) {
              // Multi-line function body
              transformFn = new Function('value', funcBody) as TransformFunction;
            } else {
              // Single expression
              transformFn = new Function('value', `return (${funcBody})`) as TransformFunction;
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
  private getValueByPath(obj: unknown, path: string): unknown {
    const parts = path.split('.');
    let current = obj;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      if (!isRecord(current)) {
        throw new Error(`Cannot read property "${part}" from non-object mapping input`);
      }
      current = current[part];
    }

    return current;
  }

  /**
   * Set value in object by dot-notation path
   */
  private setValueByPath(obj: JsonRecord, path: string, value: unknown): void {
    const parts = path.split('.');
    const lastPart = parts.pop();
    if (!lastPart) {
      throw new Error('Mapping target path must not be empty');
    }
    let current = obj;

    for (const part of parts) {
      if (!(part in current)) {
        current[part] = {};
      }
      if (!isRecord(current[part])) {
        throw new Error(`Cannot write through non-object mapping target "${part}"`);
      }
      current = current[part];
    }

    current[lastPart] = value;
  }
}
