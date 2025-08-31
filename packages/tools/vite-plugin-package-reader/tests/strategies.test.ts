import { describe, it, expect } from 'vitest';
import { 
  RegexStrategy, 
  FieldStrategy, 
  CompositeStrategy,
  FunctionStrategy 
} from '../src/strategies';
import type { PackageJson } from '../src/types';

describe('Strategies', () => {
  describe('RegexStrategy', () => {
    it('should match packages by regex pattern', () => {
      const strategy = new RegexStrategy({
        name: 'test-regex',
        pattern: /^@test\/.*-plugin$/,
      });
      
      const pkg: PackageJson = {
        name: '@test/my-plugin',
        version: '1.0.0',
      };
      
      expect(strategy.test('@test/my-plugin', pkg)).toBe(true);
      expect(strategy.test('@other/my-plugin', pkg)).toBe(false);
      expect(strategy.test('@test/my-package', pkg)).toBe(false);
    });

    it('should extract metadata', () => {
      const strategy = new RegexStrategy({
        name: 'test-regex',
        pattern: /^@test\/.*/,
        metadataExtractor: (pkg) => ({
          isTest: true,
          packageName: pkg.name,
        }),
      });
      
      const pkg: PackageJson = {
        name: '@test/my-plugin',
        version: '1.0.0',
      };
      
      const metadata = strategy.extractMetadata(pkg);
      expect(metadata).toEqual({
        isTest: true,
        packageName: '@test/my-plugin',
      });
    });
  });

  describe('FieldStrategy', () => {
    it('should match packages with required fields', () => {
      const strategy = new FieldStrategy({
        name: 'test-field',
        fields: ['main', 'module'],
        requireAll: true,
      });
      
      const pkg1: PackageJson = {
        name: 'test',
        version: '1.0.0',
        main: 'index.js',
        module: 'index.mjs',
      };
      
      const pkg2: PackageJson = {
        name: 'test2',
        version: '1.0.0',
        main: 'index.js',
      };
      
      expect(strategy.test('test', pkg1)).toBe(true);
      expect(strategy.test('test2', pkg2)).toBe(false);
    });

    it('should match packages with any of the fields', () => {
      const strategy = new FieldStrategy({
        name: 'test-field',
        fields: ['main', 'module'],
        requireAll: false,
      });
      
      const pkg: PackageJson = {
        name: 'test',
        version: '1.0.0',
        main: 'index.js',
      };
      
      expect(strategy.test('test', pkg)).toBe(true);
    });

    it('should match nested fields', () => {
      const strategy = new FieldStrategy({
        name: 'test-nested',
        fields: ['config.plugins.enabled'],
        requireAll: true,
      });
      
      const pkg: PackageJson = {
        name: 'test',
        version: '1.0.0',
        config: {
          plugins: {
            enabled: true,
          },
        },
      };
      
      expect(strategy.test('test', pkg)).toBe(true);
    });
  });

  describe('CompositeStrategy', () => {
    it('should combine strategies with AND logic', () => {
      const regex = new RegexStrategy({
        name: 'regex',
        pattern: /^@test\/.*/,
      });
      
      const field = new FieldStrategy({
        name: 'field',
        fields: ['main'],
      });
      
      const composite = new CompositeStrategy({
        name: 'composite',
        strategies: [regex, field],
        mode: 'all',
      });
      
      const pkg: PackageJson = {
        name: '@test/package',
        version: '1.0.0',
        main: 'index.js',
      };
      
      expect(composite.test('@test/package', pkg)).toBe(true);
      
      const pkg2: PackageJson = {
        name: '@test/package',
        version: '1.0.0',
      };
      
      expect(composite.test('@test/package', pkg2)).toBe(false);
    });

    it('should combine strategies with OR logic', () => {
      const regex = new RegexStrategy({
        name: 'regex',
        pattern: /^@test\/.*/,
      });
      
      const field = new FieldStrategy({
        name: 'field',
        fields: ['special'],
      });
      
      const composite = new CompositeStrategy({
        name: 'composite',
        strategies: [regex, field],
        mode: 'any',
      });
      
      const pkg: PackageJson = {
        name: '@other/package',
        version: '1.0.0',
        special: true,
      };
      
      expect(composite.test('@other/package', pkg)).toBe(true);
    });
  });

  describe('FunctionStrategy', () => {
    it('should use custom test function', () => {
      const strategy = new FunctionStrategy({
        name: 'custom',
        test: (name, pkg) => {
          return name.startsWith('@custom/') && pkg.version.startsWith('2.');
        },
      });
      
      const pkg: PackageJson = {
        name: '@custom/package',
        version: '2.0.0',
      };
      
      expect(strategy.test('@custom/package', pkg)).toBe(true);
      
      const pkg2: PackageJson = {
        name: '@custom/package',
        version: '1.0.0',
      };
      
      expect(strategy.test('@custom/package', pkg2)).toBe(false);
    });

    it('should use custom priority function', () => {
      const strategy = new FunctionStrategy({
        name: 'custom',
        test: () => true,
        getPriority: (name) => {
          if (name.includes('important')) return 1;
          return 100;
        },
      });
      
      const pkg: PackageJson = {
        name: '@test/important-package',
        version: '1.0.0',
      };
      
      expect(strategy.getPriority('@test/important-package', pkg)).toBe(1);
      expect(strategy.getPriority('@test/normal-package', pkg)).toBe(100);
    });
  });
});