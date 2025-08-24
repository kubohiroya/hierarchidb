import type { NodeType } from '@hierarchidb/common-core';
import { beforeEach, describe, expect, it } from 'vitest';
import { SimpleNodeTypeRegistry } from './SimpleNodeTypeRegistry';

describe('SimpleNodeTypeRegistry', () => {
  let registry: SimpleNodeTypeRegistry;

  beforeEach(() => {
    registry = new SimpleNodeTypeRegistry();
  });

  describe('registerNodeType', () => {
    it('should register a new node type', () => {
      const nodeType = 'customType' as NodeType;
      const config = {
        icon: 'custom-icon',
        color: '#FF0000',
        allowedChildren: ['folder', 'file'] as NodeType[],
      };

      registry.registerNodeType(nodeType, config);

      expect(registry.isRegistered(nodeType)).toBe(true);
      expect(registry.getNodeTypeConfig(nodeType)).toEqual(config);
    });

    it('should override existing node type configuration', () => {
      const nodeType = 'folder' as NodeType;
      const newConfig = {
        icon: 'new-folder-icon',
        color: '#00FF00',
        allowedChildren: ['folder'] as NodeType[],
      };

      registry.registerNodeType(nodeType, newConfig);

      expect(registry.getNodeTypeConfig(nodeType)).toEqual(newConfig);
    });

    it('should handle node type with minimal configuration', () => {
      const nodeType = 'minimal' as NodeType;
      const config = {};

      registry.registerNodeType(nodeType, config);

      expect(registry.isRegistered(nodeType)).toBe(true);
      expect(registry.getNodeTypeConfig(nodeType)).toEqual(config);
    });
  });

  describe('unregisterNodeType', () => {
    it('should unregister an existing node type', () => {
      const nodeType = 'tempType' as NodeType;
      registry.registerNodeType(nodeType, { icon: 'temp' });

      expect(registry.isRegistered(nodeType)).toBe(true);

      registry.unregisterNodeType(nodeType);

      expect(registry.isRegistered(nodeType)).toBe(false);
    });

    it('should not throw when unregistering non-existent type', () => {
      expect(() => {
        registry.unregisterNodeType('nonExistent' as NodeType);
      }).not.toThrow();
    });
  });

  describe('isRegistered', () => {
    it('should return true for registered types', () => {
      const nodeType = 'registered' as NodeType;
      registry.registerNodeType(nodeType, {});

      expect(registry.isRegistered(nodeType)).toBe(true);
    });

    it('should return false for unregistered types', () => {
      expect(registry.isRegistered('unregistered' as NodeType)).toBe(false);
    });
  });

  describe('getNodeTypeConfig', () => {
    it('should return configuration for registered type', () => {
      const nodeType = 'configured' as NodeType;
      const config = {
        icon: 'config-icon',
        displayName: 'Configured Node',
      };

      registry.registerNodeType(nodeType, config);

      expect(registry.getNodeTypeConfig(nodeType)).toEqual(config);
    });

    it('should return undefined for unregistered type', () => {
      expect(registry.getNodeTypeConfig('unknown' as NodeType)).toBeUndefined();
    });
  });

  describe('getAllNodeTypes', () => {
    it('should return all registered node types', () => {
      const types = ['type1', 'type2', 'type3'] as const;

      types.forEach((type) => {
        registry.registerNodeType(type as NodeType, {});
      });

      const allTypes = registry.getAllNodeTypes();
      expect(allTypes).toHaveLength(types.length);
      types.forEach((type) => {
        expect(allTypes).toContain(type);
      });
    });

    it('should return empty array when no types registered', () => {
      expect(registry.getAllNodeTypes()).toEqual([]);
    });
  });

  describe('canAddChild', () => {
    beforeEach(() => {
      registry.registerNodeType('folder' as NodeType, {
        allowedChildren: ['folder', 'file'] as NodeType[],
      });

      registry.registerNodeType('file' as NodeType, {
        allowedChildren: [], // Files cannot have children
      });

      registry.registerNodeType('unrestricted' as NodeType, {
        // No allowedChildren means all types allowed
      });
    });

    it('should return true when child type is allowed', () => {
      expect(registry.canAddChild('folder' as NodeType, 'file' as NodeType)).toBe(true);
      expect(registry.canAddChild('folder' as NodeType, 'folder' as NodeType)).toBe(true);
    });

    it('should return false when child type is not allowed', () => {
      expect(registry.canAddChild('file' as NodeType, 'folder' as NodeType)).toBe(false);
      expect(registry.canAddChild('file' as NodeType, 'file' as NodeType)).toBe(false);
    });

    it('should return true when parent has no restrictions', () => {
      expect(registry.canAddChild('unrestricted' as NodeType, 'file' as NodeType)).toBe(true);
      expect(registry.canAddChild('unrestricted' as NodeType, 'folder' as NodeType)).toBe(true);
      expect(registry.canAddChild('unrestricted' as NodeType, 'custom' as NodeType)).toBe(true);
    });

    it('should return true when parent type is not registered', () => {
      expect(registry.canAddChild('unknown' as NodeType, 'file' as NodeType)).toBe(true);
    });
  });

  describe('getDefaultIcon', () => {
    it('should return icon from configuration', () => {
      registry.registerNodeType('withIcon' as NodeType, {
        icon: 'custom-icon',
      });

      expect(registry.getDefaultIcon('withIcon' as NodeType)).toBe('custom-icon');
    });

    it('should return default icon for unregistered type', () => {
      expect(registry.getDefaultIcon('unknown' as NodeType)).toBe('file');
    });

    it('should return type-specific defaults', () => {
      expect(registry.getDefaultIcon('folder' as NodeType)).toBe('folder');
      expect(registry.getDefaultIcon('file' as NodeType)).toBe('file');
    });
  });
});
