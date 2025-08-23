/**
 * Pub/Sub サービスのNode環境統合テスト
 * 
 * React非依存でPub/Subメカニズムをテストします
 */

import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { TreeSubscribeService } from '../../services/TreeSubscribeService';
import { CoreDB } from '../../db/CoreDB';
import type { NodeId, TreeNode, TreeChangeEvent } from '@hierarchidb/00-core';

describe('Pub/Sub Service Node環境テスト', () => {
  let coreDB: CoreDB;
  let observableService: TreeSubscribeService;

  beforeEach(async () => {
    coreDB = new CoreDB('test-pubsub-db');
    await coreDB.open();
    
    observableService = new TreeSubscribeService(coreDB);
  });

  afterEach(async () => {
    coreDB.close();
  });

  describe('ノード変更の購読と通知', () => {
    it('単一ノードの変更を検出できる', async () => {
      const nodeId = 'test-node-001' as NodeId;
      const receivedEvents: TreeChangeEvent[] = [];

      // ノードを作成
      const initialNode: TreeNode = {
        id: nodeId,
        parentNodeId: 'root' as NodeId,
        nodeType: 'folder',
        name: 'Initial Name',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };

      await coreDB.nodes.add(initialNode);

      // ノード変更の購読
      const observable = await observableService.subscribeNode({
        kind: 'subscribeNode',
        payload: { id: nodeId },
        commandId: 'cmd-001',
        groupId: 'test-group-001',
        issuedAt: Date.now(),
      });

      const subscription = observable.subscribe({
        next: (event) => receivedEvents.push(event),
        error: (error) => console.error('Subscription error:', error),
      });

      // ノードを更新（changeSubjectイベントが自動発火するupdateNodeメソッドを使用）
      const updatedNode = await coreDB.nodes.get(nodeId);
      if (!updatedNode) {
        throw new Error(`Node ${nodeId} not found`);
      }
      await coreDB.updateNode({
        ...updatedNode,
        name: 'Updated Name',
        version: 2,
      });

      // 少し待機（非同期処理のため）
      await new Promise(resolve => setTimeout(resolve, 10));

      // 変更通知は自動的にcoreDB.changeSubjectから発行される
      // 少し待機して変更イベントが処理されるのを待つ

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(receivedEvents).toHaveLength(1);
      expect(receivedEvents[0]?.type).toBe('update');
      expect(receivedEvents[0]?.nodeId).toBe(nodeId);

      subscription.unsubscribe();
    });

    it('複数の購読者に同時に通知される', async () => {
      const nodeId = 'test-node-002' as NodeId;
      const subscriber1Events: TreeChangeEvent[] = [];
      const subscriber2Events: TreeChangeEvent[] = [];

      // ノードを作成
      const node: TreeNode = {
        id: nodeId,
        parentNodeId: 'root' as NodeId,
        nodeType: 'folder',
        name: 'Multi Subscriber Test',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };

      await coreDB.nodes.add(node);

      // 複数の購読者を設定
      const observable1 = await observableService.subscribeNode({
        kind: 'subscribeNode',
        payload: { id: nodeId },
        commandId: 'cmd-002a',
        groupId: 'test-group-002a',
        issuedAt: Date.now(),
      });

      const observable2 = await observableService.subscribeNode({
        kind: 'subscribeNode',
        payload: { id: nodeId },
        commandId: 'cmd-002b',
        groupId: 'test-group-002b',
        issuedAt: Date.now(),
      });

      const subscription1 = observable1.subscribe({
        next: (event) => subscriber1Events.push(event),
      });

      const subscription2 = observable2.subscribe({
        next: (event) => subscriber2Events.push(event),
      });

      // ノードを実際に更新してイベントを発火
      const nodeToUpdate = await coreDB.nodes.get(nodeId);
      if (!nodeToUpdate) {
        throw new Error(`Node ${nodeId} not found`);
      }
      await coreDB.updateNode({
        ...nodeToUpdate,
        name: 'Updated by Multiple',
        version: 2,
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      // 両方の購読者が通知を受信
      expect(subscriber1Events).toHaveLength(1);
      expect(subscriber2Events).toHaveLength(1);
      expect(subscriber1Events[0]?.nodeId).toBe(nodeId);
      expect(subscriber2Events[0]?.nodeId).toBe(nodeId);

      subscription1.unsubscribe();
      subscription2.unsubscribe();
    });
  });

  describe('サブツリー変更の購読', () => {
    it('子ノードの変更を親購読者が検出できる', async () => {
      const parentId = 'parent-node' as NodeId;
      const childId = 'child-node' as NodeId;
      const receivedEvents: TreeChangeEvent[] = [];

      // 親ノードと子ノードを作成
      const parentNode: TreeNode = {
        id: parentId,
        parentNodeId: 'root' as NodeId,
        nodeType: 'folder',
        name: 'Parent',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };

      const childNode: TreeNode = {
        id: childId,
        parentNodeId: parentId,
        nodeType: 'folder',
        name: 'Child',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };

      await coreDB.nodes.bulkAdd([parentNode, childNode]);

      // サブツリーの購読
      const observable = await observableService.subscribeSubtree({
        kind: 'subscribeSubtree',
        payload: { rootNodeId: parentId },
        commandId: 'cmd-003',
        groupId: 'test-group-003',
        issuedAt: Date.now(),
      });

      const subscription = observable.subscribe({
        next: (event) => receivedEvents.push(event),
      });

      // 子ノードを実際に更新してイベントを発火
      const childToUpdate = await coreDB.nodes.get(childId);
      if (!childToUpdate) {
        throw new Error(`Child node ${childId} not found`);
      }
      await coreDB.updateNode({
        ...childToUpdate,
        name: 'Updated Child',
        version: 2,
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(receivedEvents).toHaveLength(1);
      expect(receivedEvents[0]?.nodeId).toBe(childId);
      expect(receivedEvents[0]?.type).toBe('update');

      subscription.unsubscribe();
    });
  });

  describe('購読のライフサイクル管理', () => {
    it('購読解除後は通知を受信しない', async () => {
      const nodeId = 'test-lifecycle' as NodeId;
      const receivedEvents: TreeChangeEvent[] = [];

      const node: TreeNode = {
        id: nodeId,
        parentNodeId: 'root' as NodeId,
        nodeType: 'folder',
        name: 'Lifecycle Test',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };

      await coreDB.nodes.add(node);

      const observable = await observableService.subscribeNode({
        kind: 'subscribeNode',
        payload: { id: nodeId },
        commandId: 'cmd-004',
        groupId: 'test-group-004',
        issuedAt: Date.now(),
      });

      const subscription = observable.subscribe({
        next: (event) => receivedEvents.push(event),
      });

      // 購読解除
      subscription.unsubscribe();

      // ノードを実際に更新してイベントを発火
      const nodeAfterUnsubscribe = await coreDB.nodes.get(nodeId);
      if (!nodeAfterUnsubscribe) {
        throw new Error(`Node ${nodeId} not found after unsubscribe`);
      }
      await coreDB.updateNode({
        ...nodeAfterUnsubscribe,
        name: 'Should Not Receive',
        version: 2,
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      // 通知を受信しないことを確認
      expect(receivedEvents).toHaveLength(0);
    });

    it('アクティブな購読数を追跡できる', async () => {
      const nodeId1 = 'track-node-1' as NodeId;
      const nodeId2 = 'track-node-2' as NodeId;

      // 初期状態：アクティブな購読は0
      expect(await observableService.getActiveSubscriptions()).toBe(0);

      const observable1 = await observableService.subscribeNode({
        kind: 'subscribeNode',
        payload: { id: nodeId1 },
        commandId: 'cmd-005a',
        groupId: 'test-group-005a',
        issuedAt: Date.now(),
      });

      const observable2 = await observableService.subscribeNode({
        kind: 'subscribeNode',
        payload: { id: nodeId2 },
        commandId: 'cmd-005b',
        groupId: 'test-group-005b',
        issuedAt: Date.now(),
      });

      const subscription1 = observable1.subscribe(() => {});
      const subscription2 = observable2.subscribe(() => {});

      // 2つのアクティブな購読
      expect(await observableService.getActiveSubscriptions()).toBe(2);

      // 1つ解除
      subscription1.unsubscribe();
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(await observableService.getActiveSubscriptions()).toBe(1);

      // 残りも解除
      subscription2.unsubscribe();
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(await observableService.getActiveSubscriptions()).toBe(0);
    });
  });

  describe('パフォーマンステスト', () => {
    it('大量の購読者でもパフォーマンスを維持', async () => {
      const nodeId = 'perf-test' as NodeId;
      const subscriberCount = 100;
      const subscriptions: any[] = [];

      const node: TreeNode = {
        id: nodeId,
        parentNodeId: 'root' as NodeId,
        nodeType: 'folder',
        name: 'Performance Test',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };

      await coreDB.nodes.add(node);

      const startTime = Date.now();

      // 100個の購読者を作成
      for (let i = 0; i < subscriberCount; i++) {
        const observable = await observableService.subscribeNode({
          kind: 'subscribeNode',
          payload: { id: nodeId },
          commandId: `perf-cmd-${i}`,
          groupId: `test-group-perf-${i}`,
          issuedAt: Date.now(),
        });

        const subscription = observable.subscribe(() => {});
        subscriptions.push(subscription);
      }

      const subscriptionTime = Date.now() - startTime;

      // 購読作成時間が500ms以内
      expect(subscriptionTime).toBeLessThan(500);

      // 変更通知のパフォーマンステスト
      const notificationStartTime = Date.now();

      // ノードを実際に更新してイベントを発火
      const nodeForBroadcast = await coreDB.nodes.get(nodeId);
      if (!nodeForBroadcast) {
        throw new Error(`Node ${nodeId} not found for broadcast test`);
      }
      await coreDB.updateNode({
        ...nodeForBroadcast,
        name: 'Broadcasted',
        version: 2,
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      const notificationTime = Date.now() - notificationStartTime;

      // 通知時間が100ms以内
      expect(notificationTime).toBeLessThan(100);

      // クリーンアップ
      subscriptions.forEach(sub => sub.unsubscribe());
    });
  });
});