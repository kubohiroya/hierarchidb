/**
 * @file EntityRegistrationService.test.ts
 * @description Tests for EntityRegistrationService
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { NodeType } from '@hierarchidb/common-core';
import type { EntityMetadata } from '@hierarchidb/common-core';
import { EntityRegistrationService } from './EntityRegistrationService';

describe('EntityRegistrationService', () => {
  let service: EntityRegistrationService;

  beforeEach(() => {
    service = new EntityRegistrationService();
  });

  describe('registerEntity', () => {
    it('should register a new entity metadata', () => {
      const metadata: EntityMetadata = {
        entityType: 'peer',
        tableName: 'testEntities',
        relationship: {
          type: 'one-to-one',
          foreignKeyField: 'nodeId',
          cascadeDelete: true,
        },
      };

      service.registerEntity('test-node' as NodeType, 'test-entity', metadata);

      const retrieved = service.getEntitiesByNodeType('test-node' as NodeType);
      expect(retrieved).toHaveLength(1);
      expect(retrieved[0]).toEqual(metadata);
    });

    it('should register multiple entities for the same node type', () => {
      const peerMetadata: EntityMetadata = {
        entityType: 'peer',
        tableName: 'peerEntities',
        relationship: {
          type: 'one-to-one',
          foreignKeyField: 'nodeId',
          cascadeDelete: true,
        },
      };

      const groupMetadata: EntityMetadata = {
        entityType: 'group',
        tableName: 'groupEntities',
        relationship: {
          type: 'one-to-many',
          foreignKeyField: 'parentId',
          cascadeDelete: true,
        },
      };

      service.registerEntity('complex-node' as NodeType, 'peer-entity', peerMetadata);
      service.registerEntity('complex-node' as NodeType, 'group-entity', groupMetadata);

      const retrieved = service.getEntitiesByNodeType('complex-node' as NodeType);
      expect(retrieved).toHaveLength(2);
      expect(retrieved).toContainEqual(peerMetadata);
      expect(retrieved).toContainEqual(groupMetadata);
    });

    it('should throw error for duplicate entity key', () => {
      const metadata: EntityMetadata = {
        entityType: 'peer',
        tableName: 'testEntities',
        relationship: {
          type: 'one-to-one',
          foreignKeyField: 'nodeId',
          cascadeDelete: true,
        },
      };

      service.registerEntity('test-node' as NodeType, 'duplicate-key', metadata);

      expect(() => {
        service.registerEntity('test-node' as NodeType, 'duplicate-key', metadata);
      }).toThrow('Entity key already registered: duplicate-key');
    });

    it('should validate required metadata fields', () => {
      const invalidMetadata = {
        entityType: 'peer',
        // Missing tableName and relationship
      } as any;

      expect(() => {
        service.registerEntity('test-node' as NodeType, 'invalid', invalidMetadata);
      }).toThrow('Invalid entity metadata: missing required fields');
    });

    it('should register relational entity with reference management', () => {
      const relationalMetadata: EntityMetadata = {
        entityType: 'relational',
        tableName: 'sharedResources',
        relationship: {
          type: 'many-to-many',
          foreignKeyField: 'referencingNodeIds',
          cascadeDelete: false,
        },
        referenceManagement: {
          countField: 'referenceCount',
          nodeListField: 'referencingNodeIds',
          autoDeleteWhenZero: true,
        },
      };

      service.registerEntity('resource-node' as NodeType, 'shared-resource', relationalMetadata);

      const retrieved = service.getEntitiesByNodeType('resource-node' as NodeType);
      expect(retrieved).toHaveLength(1);
      expect(retrieved[0]?.referenceManagement).toBeDefined();
      expect(retrieved[0]?.referenceManagement?.autoDeleteWhenZero).toBe(true);
    });
  });

  describe('getEntitiesByNodeType', () => {
    it('should return empty array for unregistered node type', () => {
      const result = service.getEntitiesByNodeType('unknown-node' as NodeType);
      expect(result).toEqual([]);
    });

    it('should return entities in registration order', () => {
      const metadata1: EntityMetadata = {
        entityType: 'peer',
        tableName: 'store1',
        relationship: {
          type: 'one-to-one',
          foreignKeyField: 'nodeId',
          cascadeDelete: true,
        },
      };

      const metadata2: EntityMetadata = {
        entityType: 'group',
        tableName: 'store2',
        relationship: {
          type: 'one-to-many',
          foreignKeyField: 'parentId',
          cascadeDelete: true,
        },
      };

      service.registerEntity('ordered-node' as NodeType, 'entity1', metadata1);
      service.registerEntity('ordered-node' as NodeType, 'entity2', metadata2);

      const retrieved = service.getEntitiesByNodeType('ordered-node' as NodeType);
      expect(retrieved[0]?.tableName).toBe('store1');
      expect(retrieved[1]?.tableName).toBe('store2');
    });
  });

  describe('getEntityByKey', () => {
    it('should retrieve entity by key', () => {
      const metadata: EntityMetadata = {
        entityType: 'peer',
        tableName: 'testStore',
        relationship: {
          type: 'one-to-one',
          foreignKeyField: 'nodeId',
          cascadeDelete: true,
        },
      };

      service.registerEntity('test-node' as NodeType, 'specific-key', metadata);

      const retrieved = service.getEntityByKey('specific-key');
      expect(retrieved).toEqual(metadata);
    });

    it('should return undefined for unknown key', () => {
      const retrieved = service.getEntityByKey('unknown-key');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('getEntitiesSortedByType', () => {
    it('should return entities sorted by type for deletion (relational, group, peer)', () => {
      const peerMetadata: EntityMetadata = {
        entityType: 'peer',
        tableName: 'peerStore',
        relationship: {
          type: 'one-to-one',
          foreignKeyField: 'nodeId',
          cascadeDelete: true,
        },
      };

      const groupMetadata: EntityMetadata = {
        entityType: 'group',
        tableName: 'groupStore',
        relationship: {
          type: 'one-to-many',
          foreignKeyField: 'parentId',
          cascadeDelete: true,
        },
      };

      const relationalMetadata: EntityMetadata = {
        entityType: 'relational',
        tableName: 'relationalStore',
        relationship: {
          type: 'many-to-many',
          foreignKeyField: 'nodeIds',
          cascadeDelete: false,
        },
      };

      // Register in random order
      service.registerEntity('mixed-node' as NodeType, 'peer', peerMetadata);
      service.registerEntity('mixed-node' as NodeType, 'relational', relationalMetadata);
      service.registerEntity('mixed-node' as NodeType, 'group', groupMetadata);

      const sorted = service.getEntitiesSortedByType('mixed-node' as NodeType, 'delete');

      expect(sorted).toHaveLength(3);
      expect(sorted[0]?.entityType).toBe('relational');
      expect(sorted[1]?.entityType).toBe('group');
      expect(sorted[2]?.entityType).toBe('peer');
    });

    it('should return entities sorted by type for commit (peer, group, relational)', () => {
      const peerMetadata: EntityMetadata = {
        entityType: 'peer',
        tableName: 'peerStore',
        relationship: {
          type: 'one-to-one',
          foreignKeyField: 'nodeId',
          cascadeDelete: true,
        },
      };

      const relationalMetadata: EntityMetadata = {
        entityType: 'relational',
        tableName: 'relationalStore',
        relationship: {
          type: 'many-to-many',
          foreignKeyField: 'nodeIds',
          cascadeDelete: false,
        },
      };

      service.registerEntity('commit-node' as NodeType, 'relational', relationalMetadata);
      service.registerEntity('commit-node' as NodeType, 'peer', peerMetadata);

      const sorted = service.getEntitiesSortedByType('commit-node' as NodeType, 'commit');

      expect(sorted).toHaveLength(2);
      expect(sorted[0]?.entityType).toBe('peer');
      expect(sorted[1]?.entityType).toBe('relational');
    });
  });

  describe('clear', () => {
    it('should clear all registrations', () => {
      const metadata: EntityMetadata = {
        entityType: 'peer',
        tableName: 'testStore',
        relationship: {
          type: 'one-to-one',
          foreignKeyField: 'nodeId',
          cascadeDelete: true,
        },
      };

      service.registerEntity('test-node' as NodeType, 'test-key', metadata);
      expect(service.getEntityByKey('test-key')).toBeDefined();

      service.clear();

      expect(service.getEntityByKey('test-key')).toBeUndefined();
      expect(service.getEntitiesByNodeType('test-node' as NodeType)).toEqual([]);
    });
  });
});
