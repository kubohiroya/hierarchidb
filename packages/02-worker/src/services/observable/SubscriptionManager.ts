import type { SubscriptionFilter, TreeChangeEvent, NodeId } from '@hierarchidb/00-core';
import type { Subject } from 'rxjs';

/**
 * サブスクリプション情報を管理するインターフェース
 *
 * リアルタイム監視の各サブスクリプションの状態を追跡し、
 * 適切なライフサイクル管理を行うためのメタデータを保持します。
 */
export interface SubscriptionInfo {
  /** サブスクリプションの一意識別子 */
  id: string;
  /** 監視の種類 - node: 単一ノード, childNodes: 子ノード, subtree: 部分木, working-copies: ワーキングコピー */
  type: 'node' | 'childNodes' | 'subtree' | 'working-copies';
  /** 監視対象のノードID */
  nodeId: NodeId;
  /** イベントフィルタリング条件（オプション） */
  filter?: SubscriptionFilter;
  /** イベント配信用のRxJS Subject */
  subject: Subject<TreeChangeEvent>;
  /** サブスクリプションがアクティブかどうか */
  isActive: boolean;
  /** 最後の活動時刻（リソース管理用） */
  lastActivity: number;
}

/**
 * サブスクリプション管理機能を提供するクラス
 *
 * TreeObservableServiceV2のサブスクリプション生成、追跡、クリーンアップを
 * 担当し、メモリリークを防止しながら効率的なリソース管理を実現します。
 */
export class SubscriptionManager {
  /** アクティブなサブスクリプションのマップ */
  private subscriptions = new Map<string, SubscriptionInfo>();
  /** サブスクリプションIDの連番カウンター */
  private subscriptionCounter = 0;
  /** 非アクティブサブスクリプションの最大保持時間（ミリ秒） */
  private readonly maxInactiveTime = 5 * 60 * 1000; // 5分

  /**
   * 新しいサブスクリプションIDを生成します
   *
   * 一意性を保証するため、カウンターとタイムスタンプを組み合わせた
   * 識別子を生成します。
   *
   * @returns 一意のサブスクリプションID
   */
  generateSubscriptionId(): string {
    return `sub_${++this.subscriptionCounter}_${Date.now()}`;
  }

  /**
   * サブスクリプション情報を登録します
   *
   * 新しいサブスクリプションをシステムに登録し、
   * 適切な監視とリソース管理を開始します。
   *
   * @param subscriptionInfo 登録するサブスクリプション情報
   */
  registerSubscription(subscriptionInfo: SubscriptionInfo): void {
    this.subscriptions.set(subscriptionInfo.id, subscriptionInfo);
  }

  /**
   * サブスクリプションの活動時刻を更新します
   *
   * イベントが発生した際に呼び出され、サブスクリプションが
   * まだアクティブであることを記録します。
   *
   * @param subscriptionId 更新するサブスクリプションID
   */
  updateSubscriptionActivity(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription) {
      subscription.lastActivity = Date.now();
    }
  }

  /**
   * サブスクリプションを非アクティブ状態にマークします
   *
   * Observable のunsubscribe時に呼び出され、
   * 該当サブスクリプションをクリーンアップ対象としてマークします。
   *
   * @param subscriptionId 非アクティブにするサブスクリプションID
   */
  markSubscriptionInactive(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription) {
      subscription.isActive = false;
    }
  }

  /**
   * アクティブなサブスクリプション数を取得します
   *
   * 現在システムで管理されているアクティブなサブスクリプションの
   * 数を返します。リソース監視に使用されます。
   *
   * @returns アクティブなサブスクリプション数
   */
  async getActiveSubscriptionsCount(): Promise<number> {
    return Array.from(this.subscriptions.values()).filter((sub) => sub.isActive).length;
  }

  /**
   * 孤立したサブスクリプションをクリーンアップします
   *
   * 非アクティブになったか、長時間使用されていないサブスクリプションを
   * システムから削除し、メモリリークを防止します。
   *
   * 定期的に実行されることを想定しており、以下の条件でクリーンアップ対象とします：
   * - isActive が false
   * - 最後の活動から maxInactiveTime を経過
   */
  async cleanupOrphanedSubscriptions(): Promise<void> {
    const now = Date.now();
    const toDelete: string[] = [];

    // クリーンアップ対象のサブスクリプションを特定
    for (const [id, subscription] of this.subscriptions.entries()) {
      if (!subscription.isActive || now - subscription.lastActivity > this.maxInactiveTime) {
        // Subjectを適切に完了させる
        subscription.subject.complete();
        toDelete.push(id);
      }
    }

    // マップから削除
    toDelete.forEach((id) => this.subscriptions.delete(id));
  }

  /**
   * 指定されたサブスクリプション情報を取得します
   *
   * @param subscriptionId 取得するサブスクリプションID
   * @returns サブスクリプション情報（存在しない場合はundefined）
   */
  getSubscription(subscriptionId: string): SubscriptionInfo | undefined {
    return this.subscriptions.get(subscriptionId);
  }

  /**
   * 全てのサブスクリプションを取得します（デバッグ用）
   *
   * @returns 全サブスクリプション情報の配列
   */
  getAllSubscriptions(): SubscriptionInfo[] {
    return Array.from(this.subscriptions.values());
  }
}
