import type { PackageDetectionStrategy, PackageJson } from '../types';

/**
 * 戦略の基底クラス
 */
export abstract class BaseStrategy implements PackageDetectionStrategy {
  abstract name: string;
  
  abstract test(packageName: string, packageJson: PackageJson): boolean;

  getPriority(_packageName: string, _packageJson: PackageJson): number {
    return 1000; // デフォルト優先度
  }

  extractMetadata(_packageJson: PackageJson): Record<string, any> {
    return {};
  }
}

/**
 * 正規表現による戦略
 */
export class RegexStrategy extends BaseStrategy {
  name: string;
  private pattern: RegExp;
  private priorityMap?: Map<string, number>;
  private metadataExtractor?: (packageJson: PackageJson) => Record<string, any>;

  constructor(options: {
    name: string;
    pattern: RegExp;
    priorityMap?: Map<string, number>;
    metadataExtractor?: (packageJson: PackageJson) => Record<string, any>;
  }) {
    super();
    this.name = options.name;
    this.pattern = options.pattern;
    this.priorityMap = options.priorityMap;
    this.metadataExtractor = options.metadataExtractor;
  }

  test(packageName: string, _packageJson: PackageJson): boolean {
    return this.pattern.test(packageName);
  }

  getPriority(packageName: string, packageJson: PackageJson): number {
    if (this.priorityMap && this.priorityMap.has(packageName)) {
      return this.priorityMap.get(packageName)!;
    }
    return super.getPriority(packageName, packageJson);
  }

  extractMetadata(packageJson: PackageJson): Record<string, any> {
    if (this.metadataExtractor) {
      return this.metadataExtractor(packageJson);
    }
    return super.extractMetadata(packageJson);
  }
}

/**
 * フィールド存在チェック戦略
 */
export class FieldStrategy extends BaseStrategy {
  name: string;
  private fields: string[];
  private requireAll: boolean;

  constructor(options: {
    name: string;
    fields: string[];
    requireAll?: boolean;
  }) {
    super();
    this.name = options.name;
    this.fields = options.fields;
    this.requireAll = options.requireAll ?? true;
  }

  test(_packageName: string, packageJson: PackageJson): boolean {
    const hasField = (field: string): boolean => {
      const parts = field.split('.');
      let current: any = packageJson;
      
      for (const part of parts) {
        if (current && typeof current === 'object' && part in current) {
          current = current[part];
        } else {
          return false;
        }
      }
      
      return true;
    };

    if (this.requireAll) {
      return this.fields.every(hasField);
    } else {
      return this.fields.some(hasField);
    }
  }
}

/**
 * 複合戦略
 */
export class CompositeStrategy extends BaseStrategy {
  name: string;
  private strategies: PackageDetectionStrategy[];
  private mode: 'all' | 'any';

  constructor(options: {
    name: string;
    strategies: PackageDetectionStrategy[];
    mode?: 'all' | 'any';
  }) {
    super();
    this.name = options.name;
    this.strategies = options.strategies;
    this.mode = options.mode ?? 'all';
  }

  test(packageName: string, packageJson: PackageJson): boolean {
    if (this.mode === 'all') {
      return this.strategies.every(s => s.test(packageName, packageJson));
    } else {
      return this.strategies.some(s => s.test(packageName, packageJson));
    }
  }

  getPriority(packageName: string, packageJson: PackageJson): number {
    // 各戦略の優先度の最小値を使用
    const priorities = this.strategies
      .map(s => s.getPriority ? s.getPriority(packageName, packageJson) : 1000);
    return Math.min(...priorities);
  }

  extractMetadata(packageJson: PackageJson): Record<string, any> {
    // すべての戦略からメタデータを収集してマージ
    const metadata: Record<string, any> = {};
    for (const strategy of this.strategies) {
      if (strategy.extractMetadata) {
        Object.assign(metadata, strategy.extractMetadata(packageJson));
      }
    }
    return metadata;
  }
}

/**
 * カスタム関数戦略
 */
export class FunctionStrategy extends BaseStrategy {
  name: string;
  private testFn: (packageName: string, packageJson: PackageJson) => boolean;
  private priorityFn?: (packageName: string, packageJson: PackageJson) => number;
  private metadataFn?: (packageJson: PackageJson) => Record<string, any>;

  constructor(options: {
    name: string;
    test: (packageName: string, packageJson: PackageJson) => boolean;
    getPriority?: (packageName: string, packageJson: PackageJson) => number;
    extractMetadata?: (packageJson: PackageJson) => Record<string, any>;
  }) {
    super();
    this.name = options.name;
    this.testFn = options.test;
    this.priorityFn = options.getPriority;
    this.metadataFn = options.extractMetadata;
  }

  test(packageName: string, packageJson: PackageJson): boolean {
    return this.testFn(packageName, packageJson);
  }

  getPriority(packageName: string, packageJson: PackageJson): number {
    if (this.priorityFn) {
      return this.priorityFn(packageName, packageJson);
    }
    return super.getPriority(packageName, packageJson);
  }

  extractMetadata(packageJson: PackageJson): Record<string, any> {
    if (this.metadataFn) {
      return this.metadataFn(packageJson);
    }
    return super.extractMetadata(packageJson);
  }
}