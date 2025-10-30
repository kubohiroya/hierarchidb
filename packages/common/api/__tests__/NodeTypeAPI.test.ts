/**
  * @file NodeTypeAPI.test.ts
 * @description NodeTypeAPI
  * TDD Red: NodeTypeAPI
  */
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { NodeTypeAPI } from '../src/NodeTypeAPI.js';
import { NodeId, NodeType } from '@hierarchidb/common-types';

describe.skip('NodeTypeAPI (skipped pending implementation)', () => {
  let nodeTypeAPI: NodeTypeAPI;

  beforeEach(() => {
    //  : NodeTypeAPI
    //  :
    nodeTypeAPI = {} as NodeTypeAPI;
  });

  afterEach(() => {
    //  :
    //  :
    nodeTypeAPI = null as any;
  });

  describe('listSupported', () => {
    test('全てのサポートされているノード型のリストを返す', async () => {
      //  : NodeTypeAPI
      //  : listSupported()
      //  : ['folder-plugin', 'document', 'basemap', 'project', 'shape-plugin']
      //  : API

      //  :
      //  :

      //  : listSupported()
      //  :
      const supportedTypes = await nodeTypeAPI.listSupported();

      //  :
      //  :
      expect(Array.isArray(supportedTypes)).toBe(true); //  :
      expect(supportedTypes.length).toBeGreaterThan(0); //  : 1
      expect(supportedTypes).toContain('folder'); //  : folder
    });

    test('空のシステムでは空配列を返す', async () => {
      //  :
      //  : 1
      //  : []
      //  : API

      //  :
      //  :

      //  : listSupported()
      //  :
      const supportedTypes = await nodeTypeAPI.listSupported();

      //  :
      //  :
      expect(supportedTypes).toEqual([]); //  :
    });
  });

  describe('isSupported', () => {
    test('存在するノード型に対してtrueを返す', async () => {
      //  :
      //  : isSupported()true
      //  : 'folder-plugin'true
      //  : API

      //  :
      //  : folder
      const existingNodeType: NodeType = 'folder';

      //  : isSupported()
      //  :
      const isSupported = await nodeTypeAPI.isSupported(existingNodeType);

      //  : true
      //  :
      expect(isSupported).toBe(true); //  : true
    });

    test('存在しないノード型に対してfalseを返す', async () => {
      //  :
      //  : isSupported()false
      //  : 'non-existent-type'false
      //  : API

      //  :
      //  :
      const nonExistentNodeType: NodeType = 'non-existent-type' as NodeType;

      //  : isSupported()
      //  :
      const isSupported = await nodeTypeAPI.isSupported(nonExistentNodeType);

      //  : false
      //  :
      expect(isSupported).toBe(false); //  : false
    });
  });

  describe('validateOperation', () => {
    test('有効なノード型とオペレーションの組み合わせでバリデーション成功', async () => {
      //  :
      //  : validateOperation()
      //  : {valid: true, errors: []}ValidationResult
      //  : APIvalidateOperation

      //  :
      //  : foldercreate
      const nodeType: NodeType = 'folder';
      const operation: 'create' | 'update' | 'delete' | 'move' = 'create';
      const context = { parentId: 'parent-123' as NodeId };

      //  : validateOperation()
      //  :
      const result = await nodeTypeAPI.validateOperation(nodeType, operation, context);

      //  :
      //  : validtrueerrors
      expect(result.valid).toBe(true); //  :
      expect(result.errors).toEqual([]); //  :
    });

    test('無効なノード型でバリデーション失敗', async () => {
      //  :
      //  : validateOperation()
      //  : {valid: false, errors: ['Node type invalid-type is not registered']}
      //  : APIvalidateOperation

      //  :
      //  :
      const invalidNodeType: NodeType = 'invalid-type' as NodeType;
      const operation: 'create' | 'update' | 'delete' | 'move' = 'create';

      //  : validateOperation()
      //  :
      const result = await nodeTypeAPI.validateOperation(invalidNodeType, operation);

      //  :
      //  : validfalse
      expect(result.valid).toBe(false); //  :
      expect(result.errors).toContain(`Node type ${invalidNodeType} is not registered`); //  :
    });
  });

  describe('getSupportedOperations', () => {
    test('ノード型でサポートされている操作の配列を返す', async () => {
      //  :
      //  : getSupportedOperations()
      //  : ['create', 'read', 'update', 'delete', 'move']
      //  : APIgetSupportedOperations

      //  :
      //  : folder
      const nodeType: NodeType = 'folder';

      //  : getSupportedOperations()
      //  :
      const operations = await nodeTypeAPI.getSupportedOperations(nodeType);

      //  :
      //  : CRUDmove
      expect(Array.isArray(operations)).toBe(true); //  :
      expect(operations).toContain('create'); //  : create
      expect(operations).toContain('read'); //  : read
      expect(operations).toContain('update'); //  : update
      expect(operations).toContain('delete'); //  : delete
    });
  });

  describe('supportsChildren', () => {
    test('子要素をサポートするノード型でtrueを返す', async () => {
      //  :
      //  : supportsChildren()true
      //  : foldertrue
      //  : APIsupportsChildren

      //  :
      //  : folder
      const containerNodeType: NodeType = 'folder';

      //  : supportsChildren()
      //  :
      const supportsChildren = await nodeTypeAPI.supportsChildren(containerNodeType);

      //  :
      //  : folder
      expect(supportsChildren).toBe(true); //  : true
    });
  });

  describe('getAllowedChildTypes', () => {
    test('親ノード型に対して許可された子ノード型の配列を返す', async () => {
      //  :
      //  : getAllowedChildTypes()
      //  : folder['folder-plugin', 'document', 'project']
      //  : API

      //  :
      //  : folder
      const parentType: NodeType = 'folder';

      //  : getAllowedChildTypes()
      //  :
      const allowedChildTypes = await nodeTypeAPI.getAllowedChildTypes(parentType);

      //  :
      //  :
      expect(Array.isArray(allowedChildTypes)).toBe(true); //  :
      expect(allowedChildTypes.length).toBeGreaterThan(0); //  : 1
    });
  });

  describe('hasCapability', () => {
    test('ノード型が指定された機能を持つ場合にtrueを返す', async () => {
      //  :
      //  : hasCapability()
      //  : folder'create'true
      //  : API

      //  :
      //  : foldercreate
      const nodeType: NodeType = 'folder';
      const capability = 'create';

      //  : hasCapability()
      //  :
      const hasCapability = await nodeTypeAPI.hasCapability(nodeType, capability);

      //  :
      //  : foldercreate
      expect(hasCapability).toBe(true); //  : true
    });

    test('ノード型が指定された機能を持たない場合にfalseを返す', async () => {
      //  :
      //  : hasCapability()false
      //  : 'non-existent-capability'false
      //  : API

      //  :
      //  : folder
      const nodeType: NodeType = 'folder';
      const nonExistentCapability = 'non-existent-capability';

      //  : hasCapability()
      //  :
      const hasCapability = await nodeTypeAPI.hasCapability(nodeType, nonExistentCapability);

      //  :
      //  : false
      expect(hasCapability).toBe(false); //  : false
    });
  });
});
