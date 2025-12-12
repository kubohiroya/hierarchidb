/**
  * @file NodeTypeAPI.test.ts
  * @description NodeTypeAPI
  */
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { NodeId, NodeType } from '@hierarchidb/common-types';
import { NodeTypeAPI } from '@hierarchidb/plugin-service-api';

describe.skip('NodeTypeAPI (skipped pending implementation)', () => {
  let nodeTypeAPI: NodeTypeAPI;

  beforeEach(() => {
    nodeTypeAPI = {} as NodeTypeAPI;
  });

  afterEach(() => {
    nodeTypeAPI = null as any;
  });

  describe('listSupported', () => {
    test('全てのサポートされているノード型のリストを返す', async () => {

      const supportedTypes = await nodeTypeAPI.listSupported();

      expect(Array.isArray(supportedTypes)).toBe(true);
      expect(supportedTypes.length).toBeGreaterThan(0);
      expect(supportedTypes).toContain('folder');
    });

    test('空のシステムでは空配列を返す', async () => {

      const supportedTypes = await nodeTypeAPI.listSupported();
      expect(supportedTypes).toEqual([]);
    });
  });

  describe('isSupported', () => {
    test('存在するノード型に対してtrueを返す', async () => {

      const existingNodeType: NodeType = 'folder' as NodeType;
      const isSupported = await nodeTypeAPI.isSupported(existingNodeType);
      expect(isSupported).toBe(true);
    });

    test('存在しないノード型に対してfalseを返す', async () => {
      const nonExistentNodeType: NodeType = 'non-existent-type' as NodeType;
      const isSupported = await nodeTypeAPI.isSupported(nonExistentNodeType);
      expect(isSupported).toBe(false);
    });
  });

  describe('validateOperation', () => {
    test('有効なノード型とオペレーションの組み合わせでバリデーション成功', async () => {
      const nodeType: NodeType = 'folder' as NodeType;
      const operation: 'create' | 'update' | 'delete' | 'move' = 'create';
      const context = { parentId: 'parent-123' as NodeId };
      const result = await nodeTypeAPI.validateOperation(nodeType, operation, context);
      expect(result.valid).toBe(true);
    });

    test('無効なノード型でバリデーション失敗', async () => {
      const invalidNodeType: NodeType = 'invalid-type' as NodeType;
      const operation: 'create' | 'update' | 'delete' | 'move' = 'create';
      const result = await nodeTypeAPI.validateOperation(invalidNodeType, operation);
      expect(result.valid).toBe(false);
    });
  });

  describe('getSupportedOperations', () => {
    test('ノード型でサポートされている操作の配列を返す', async () => {
      const nodeType: NodeType = 'folder' as NodeType;
      const operations = await nodeTypeAPI.getSupportedOperations(nodeType);
      expect(Array.isArray(operations)).toBe(true);
      expect(operations).toContain('create');
      expect(operations).toContain('read');
      expect(operations).toContain('update');
      expect(operations).toContain('delete');
    });
  });

  describe('supportsChildren', () => {
    test('子要素をサポートするノード型でtrueを返す', async () => {
      const containerNodeType: NodeType = 'folder' as NodeType;
      const supportsChildren = await nodeTypeAPI.supportsChildren(containerNodeType);
      expect(supportsChildren).toBe(true);
    });
  });

  describe('getAllowedChildTypes', () => {
    test('親ノード型に対して許可された子ノード型の配列を返す', async () => {
      const parentType: NodeType = 'folder' as NodeType;
      const allowedChildTypes = await nodeTypeAPI.getAllowedChildTypes(parentType);
      expect(Array.isArray(allowedChildTypes)).toBe(true);
      expect(allowedChildTypes.length).toBeGreaterThan(0);
    });
  });

  describe('hasCapability', () => {
    test('ノード型が指定された機能を持つ場合にtrueを返す', async () => {
      const nodeType: NodeType = 'folder' as NodeType;
      const capability = 'create';
      const hasCapability = await nodeTypeAPI.hasCapability(nodeType, capability);
      expect(hasCapability).toBe(true);
    });

    test('ノード型が指定された機能を持たない場合にfalseを返す', async () => {
      const nodeType: NodeType = 'folder' as NodeType;
      const nonExistentCapability = 'non-existent-capability';
      const hasCapability = await nodeTypeAPI.hasCapability(nodeType, nonExistentCapability);
      expect(hasCapability).toBe(false);
    });
  });
});
