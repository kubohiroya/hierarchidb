import { describe, it, expect, beforeEach } from 'vitest';
import { SimpleNodeTypeRegistry } from './SimpleNodeTypeRegistry';
import type { TreeNodeType } from '@hierarchidb/core';

describe('SimpleNodeTypeRegistry', () => {
  let registry: SimpleNodeTypeRegistry;

  beforeEach(() => {
    registry = new SimpleNodeTypeRegistry();
  });

  describe('registerNodeType', () => {
    it('should register a new node type', () => {
      const nodeType = 'customType' as TreeNodeType;
      const config = {
        icon: 'custom-icon',
        color: '#FF0000',
        allowedChildren: ['folder', 'file'] as TreeNodeType[],
      };

      registry.registerNodeType(nodeType, config);

      expect(registry.isRegistered(nodeType)).toBe(true);
      expect(registry.getNodeTypeConfig(nodeType)).toEqual(config);
    });

    it('should override existing node type configuration', () => {
      const nodeType = 'folder' as TreeNodeType;
      const newConfig = {
        icon: 'new-folder-icon',
        color: '#00FF00',
        allowedChildren: ['folder'] as TreeNodeType[],
      };

      registry.registerNodeType(nodeType, newConfig);

      expect(registry.getNodeTypeConfig(nodeType)).toEqual(newConfig);
    });

    it('should handle node type with minimal configuration', () => {
      const nodeType = 'minimal' as TreeNodeType;
      const config = {};

      registry.registerNodeType(nodeType, config);

      expect(registry.isRegistered(nodeType)).toBe(true);
      expect(registry.getNodeTypeConfig(nodeType)).toEqual(config);
    });
  });

  describe('unregisterNodeType', () => {
    it('should unregister an existing node type', () => {
      const nodeType = 'tempType' as TreeNodeType;
      registry.registerNodeType(nodeType, { icon: 'temp' });

      expect(registry.isRegistered(nodeType)).toBe(true);

      registry.unregisterNodeType(nodeType);

      expect(registry.isRegistered(nodeType)).toBe(false);
    });

    it('should not throw when unregistering non-existent type', () => {
      expect(() => {
        registry.unregisterNodeType('nonExistent' as TreeNodeType);
      }).not.toThrow();
    });
  });

  describe('isRegistered', () => {
    it('should return true for registered types', () => {
      const nodeType = 'registered' as TreeNodeType;
      registry.registerNodeType(nodeType, {});

      expect(registry.isRegistered(nodeType)).toBe(true);
    });

    it('should return false for unregistered types', () => {
      expect(registry.isRegistered('unregistered' as TreeNodeType)).toBe(false);
    });
  });

  describe('getNodeTypeConfig', () => {
    it('should return configuration for registered type', () => {
      const nodeType = 'configured' as TreeNodeType;
      const config = {
        icon: 'config-icon',
        displayName: 'Configured Node',
      };

      registry.registerNodeType(nodeType, config);

      expect(registry.getNodeTypeConfig(nodeType)).toEqual(config);
    });

    it('should return undefined for unregistered type', () => {
      expect(registry.getNodeTypeConfig('unknown' as TreeNodeType)).toBeUndefined();
    });
  });

  describe('getAllNodeTypes', () => {
    it('should return all registered node types', () => {
      const types = ['type1', 'type2', 'type3'] as const;

      types.forEach((type) => {
        registry.registerNodeType(type as TreeNodeType, {});
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
      registry.registerNodeType('folder' as TreeNodeType, {
        allowedChildren: ['folder', 'file'] as TreeNodeType[],
      });

      registry.registerNodeType('file' as TreeNodeType, {
        allowedChildren: [], // Files cannot have children
      });

      registry.registerNodeType('unrestricted' as TreeNodeType, {
        // No allowedChildren means all types allowed
      });
    });

    it('should return true when child type is allowed', () => {
      expect(registry.canAddChild('folder' as TreeNodeType, 'file' as TreeNodeType)).toBe(true);
      expect(registry.canAddChild('folder' as TreeNodeType, 'folder' as TreeNodeType)).toBe(true);
    });

    it('should return false when child type is not allowed', () => {
      expect(registry.canAddChild('file' as TreeNodeType, 'folder' as TreeNodeType)).toBe(false);
      expect(registry.canAddChild('file' as TreeNodeType, 'file' as TreeNodeType)).toBe(false);
    });

    it('should return true when parent has no restrictions', () => {
      expect(registry.canAddChild('unrestricted' as TreeNodeType, 'file' as TreeNodeType)).toBe(
        true
      );
      expect(registry.canAddChild('unrestricted' as TreeNodeType, 'folder' as TreeNodeType)).toBe(
        true
      );
      expect(registry.canAddChild('unrestricted' as TreeNodeType, 'custom' as TreeNodeType)).toBe(
        true
      );
    });

    it('should return true when parent type is not registered', () => {
      expect(registry.canAddChild('unknown' as TreeNodeType, 'file' as TreeNodeType)).toBe(true);
    });
  });

  describe('getDefaultIcon', () => {
    it('should return icon from configuration', () => {
      registry.registerNodeType('withIcon' as TreeNodeType, {
        icon: 'custom-icon',
      });

      expect(registry.getDefaultIcon('withIcon' as TreeNodeType)).toBe('custom-icon');
    });

    it('should return default icon for unregistered type', () => {
      expect(registry.getDefaultIcon('unknown' as TreeNodeType)).toBe('file');
    });

    it('should return type-specific defaults', () => {
      expect(registry.getDefaultIcon('folder' as TreeNodeType)).toBe('folder');
      expect(registry.getDefaultIcon('file' as TreeNodeType)).toBe('file');
    });
  });
});
