/**
  * TypeScript
  */
export class TypeGenerator {
  /**
            */
  static generateInterface(name: string, properties: Record<string, string>): string {
    const props = Object.entries(properties)
      .map(([key, type]) => `  ${key}: ${type};`)
      .join('\n');

    return `export interface ${name} {\n${props}\n}`;
  }

  /**
            */
  static generateType(name: string, type: string): string {
    return `export type ${name} = ${type};`;
  }

  /**
      * const
      */
  static generateConstObject(name: string, obj: any): string {
    const content = JSON.stringify(obj, null, 2);
    return `export const ${name} = ${content} as const;`;
  }

  /**
            */
  static generateModuleDeclaration(moduleId: string, exports: string[]): string {
    const exportStatements = exports.join('\n  ');
    return `declare module '${moduleId}' {\n  ${exportStatements}\n}`;
  }

  /**
            */
  static generateArrayType(itemType: string): string {
    return `${itemType}[]`;
  }

  /**
            */
  static generateUnionType(types: string[]): string {
    return types.join(' | ');
  }

  /**
            */
  static generateRecordType(keyType: string, valueType: string): string {
    return `Record<${keyType}, ${valueType}>`;
  }

  /**
            */
  static generateFunctionType(params: Record<string, string>, returnType: string): string {
    const paramList = Object.entries(params)
      .map(([name, type]) => `${name}: ${type}`)
      .join(', ');

    return `(${paramList}) => ${returnType}`;
  }

  /**
            */
  static generateExport(name: string, from?: string): string {
    if (from) {
      return `export { ${name} } from '${from}';`;
    }
    return `export { ${name} };`;
  }

  /**
            */
  static generateDefaultExport(name: string): string {
    return `export default ${name};`;
  }

  /**
            */
  static generateImport(items: string[], from: string): string {
    return `import { ${items.join(', ')} } from '${from}';`;
  }

  /**
            */
  static generateTypeImport(items: string[], from: string): string {
    return `import type { ${items.join(', ')} } from '${from}';`;
  }

  /**
            */
  static generateComment(text: string, type: 'single' | 'multi' | 'jsdoc' = 'single'): string {
    switch (type) {
      case 'single':
        return `// ${text}`;
      case 'multi':
        return `/* ${text} */`;
      case 'jsdoc':
        return `/**\n * ${text}\n */`;
      default:
        return `// ${text}`;
    }
  }

  /**
      * namespace
      */
  static generateNamespace(name: string, content: string): string {
    return `export namespace ${name} {\n${content.split('\n').map(line => '  ' + line).join('\n')}\n}`;
  }

  /**
      * enum
      */
  static generateEnum(name: string, values: Record<string, string | number>): string {
    const members = Object.entries(values)
      .map(([key, value]) => {
        if (typeof value === 'string') {
          return `  ${key} = "${value}",`;
        }
        return `  ${key} = ${value},`;
      })
      .join('\n');

    return `export enum ${name} {\n${members}\n}`;
  }

  /**
            */
  static generateClass(
    name: string,
    properties: Record<string, string>,
    methods: Record<string, string>,
  ): string {
    const props = Object.entries(properties)
      .map(([key, type]) => `  ${key}: ${type};`)
      .join('\n');

    const meths = Object.entries(methods)
      .map(([key, signature]) => `  ${key}${signature};`)
      .join('\n');

    const content = [props, meths].filter(Boolean).join('\n');

    return `export class ${name} {\n${content}\n}`;
  }
}