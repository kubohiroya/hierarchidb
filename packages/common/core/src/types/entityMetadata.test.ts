/**
 * @file entityMetadata.test.ts
 * @description Tests for EntityMetadata type definitions
 */

import { describe, it, expectTypeOf } from 'vitest';
import type {
  EntityMetadata,
  EntityType,
  EntityRelationship,
  ReferenceManagement,
  WorkingCopyConfig,
  AutoLifecycleConfig,
} from './entityMetadata';

describe('EntityMetadata Type Definitions', () => {
  describe('EntityType', () => {
    it('should only allow specific entity types', () => {
      type ValidTypes = EntityType;
      expectTypeOf<'peer'>().toMatchTypeOf<ValidTypes>();
      expectTypeOf<'group'>().toMatchTypeOf<ValidTypes>();
      expectTypeOf<'relational'>().toMatchTypeOf<ValidTypes>();

      expectTypeOf<'invalid'>().not.toMatchTypeOf<ValidTypes>();
    });
  });

  describe('EntityRelationship', () => {
    it('should define relationship structure', () => {
      const relationship: EntityRelationship = {
        type: 'one-to-one',
        foreignKeyField: 'nodeId',
        cascadeDelete: true,
      };

      expectTypeOf(relationship).toMatchTypeOf<EntityRelationship>();
      expectTypeOf(relationship.type).toEqualTypeOf<
        'one-to-one' | 'one-to-many' | 'many-to-many'
      >();
      expectTypeOf(relationship.foreignKeyField).toEqualTypeOf<string>();
      expectTypeOf(relationship.cascadeDelete).toEqualTypeOf<boolean>();
    });
  });

  describe('ReferenceManagement', () => {
    it('should define reference management for relational entities', () => {
      const refManagement: ReferenceManagement = {
        countField: 'referenceCount',
        nodeListField: 'referencingNodeIds',
        autoDeleteWhenZero: true,
      };

      expectTypeOf(refManagement).toMatchTypeOf<ReferenceManagement>();
      expectTypeOf(refManagement.countField).toEqualTypeOf<string>();
      expectTypeOf(refManagement.nodeListField).toEqualTypeOf<string>();
      expectTypeOf(refManagement.autoDeleteWhenZero).toEqualTypeOf<boolean>();
    });
  });

  describe('WorkingCopyConfig', () => {
    it('should define working copy configuration', () => {
      const config: WorkingCopyConfig = {
        enabled: true,
        tableName: 'workingCopies',
      };

      expectTypeOf(config).toMatchTypeOf<WorkingCopyConfig>();
      expectTypeOf(config.enabled).toEqualTypeOf<boolean>();
      expectTypeOf(config.tableName).toEqualTypeOf<string>();
    });
  });

  describe('EntityMetadata', () => {
    it('should define complete metadata for peer entity', () => {
      const peerMetadata: EntityMetadata = {
        entityType: 'peer',
        tableName: 'entities',
        relationship: {
          type: 'one-to-one',
          foreignKeyField: 'nodeId',
          cascadeDelete: true,
        },
        workingCopyConfig: {
          enabled: true,
          tableName: 'workingCopies',
        },
      };

      expectTypeOf(peerMetadata).toMatchTypeOf<EntityMetadata>();
    });

    it('should define complete metadata for relational entity', () => {
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

      expectTypeOf(relationalMetadata).toMatchTypeOf<EntityMetadata>();
    });

    it('should make optional fields truly optional', () => {
      const minimalMetadata: EntityMetadata = {
        entityType: 'group',
        tableName: 'groupEntities',
        relationship: {
          type: 'one-to-many',
          foreignKeyField: 'parentId',
          cascadeDelete: true,
        },
      };

      expectTypeOf(minimalMetadata).toMatchTypeOf<EntityMetadata>();
      expectTypeOf(minimalMetadata.referenceManagement).toEqualTypeOf<
        ReferenceManagement | undefined
      >();
      expectTypeOf(minimalMetadata.workingCopyConfig).toEqualTypeOf<
        WorkingCopyConfig | undefined
      >();
    });
  });

  describe('AutoLifecycleConfig', () => {
    it('should define auto lifecycle configuration', () => {
      const config: AutoLifecycleConfig = {
        entities: [
          {
            entityType: 'peer',
            tableName: 'entities',
            relationship: {
              type: 'one-to-one',
              foreignKeyField: 'nodeId',
              cascadeDelete: true,
            },
          },
        ],
      };

      expectTypeOf(config).toMatchTypeOf<AutoLifecycleConfig>();
      expectTypeOf(config.entities).toEqualTypeOf<EntityMetadata[]>();
    });
  });
});
