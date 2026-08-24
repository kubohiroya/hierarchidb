import type { PropertyMappingRule } from '~/common/entities/ResolverEntity';

type JsonRecord = Record<string, unknown>;
type TransformFunction = (value: unknown) => unknown;

const isRecord = (value: unknown): value is JsonRecord =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export type CompiledFunction = (data: unknown) => JsonRecord;

interface CompiledRule {
  sourceProperty: string;
  sourcePath: string[];
  targetPath: string[];
  transformFunction?: TransformFunction;
  defaultValue?: unknown;
}

/**
 * Simple MappingCompiler for testing
 */
export class MappingCompiler {
  /**
   * Compile mapping rules into a function
   */
  compile(mappingRules: PropertyMappingRule[]): CompiledFunction {
    const compiledRules = mappingRules.map((rule): CompiledRule => ({
      sourceProperty: rule.sourceProperty,
      sourcePath: rule.sourceProperty.split('.'),
      targetPath: this.compileTargetPath(rule.targetProperty),
      transformFunction: this.compileTransformFunction(rule.transformFunction),
      defaultValue: rule.defaultValue,
    }));

    return (data: unknown) => {
      const result: JsonRecord = {};

      for (const rule of compiledRules) {
        // Get value from source path
        const value = this.getValueByPath(data, rule.sourcePath);

        // Apply transformation if specified
        let transformedValue = value;
        if (rule.transformFunction && value !== undefined) {
          try {
            transformedValue = rule.transformFunction(value);
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
        this.setValueByPath(result, rule.targetPath, transformedValue);
      }

      return result;
    };
  }

  private compileTransformFunction(transformFunction: string | undefined): TransformFunction | undefined {
    if (!transformFunction) {
      return undefined;
    }

    // Create a safe evaluation context once per rule.
    // Handle both single expressions and multi-line functions.
    const funcBody = transformFunction.trim();
    if (funcBody.includes('return') || funcBody.includes(';')) {
      return new Function('value', funcBody) as TransformFunction;
    }
    return new Function('value', `return (${funcBody})`) as TransformFunction;
  }

  private compileTargetPath(path: string): string[] {
    const parts = path.split('.');
    if (!parts[parts.length - 1]) {
      throw new Error('Mapping target path must not be empty');
    }
    return parts;
  }

  /**
   * Get value from object by dot-notation path
   */
  private getValueByPath(obj: unknown, parts: string[]): unknown {
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
  private setValueByPath(obj: JsonRecord, parts: string[], value: unknown): void {
    const lastPart = parts[parts.length - 1];
    if (!lastPart) {
      throw new Error('Mapping target path must not be empty');
    }
    let current = obj;

    for (let index = 0; index < parts.length - 1; index += 1) {
      const part = parts[index];
      if (part === undefined) {
        throw new Error('Mapping target path segment must not be undefined');
      }
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
