import type { TreeChangeEvent } from '@hierarchidb/core';
import { map, type Observable, filter as rxFilter, type Subject, share, startWith } from 'rxjs';
import type { SubscriptionInfo } from './SubscriptionManager';

/**
 * Observableインスタンス作成とライフサイクル管理を担当するファクトリークラス
 *
 * RxJS Observableの作成、カスタムunsubscribe処理の実装、
 * 適切なリソース管理を行います。メモリリーク防止とクリーンアップ処理を
 * 統一的に処理することで、コードの重複を削減します。
 */
export class ObservableFactory {
  /**
   * サブスクリプション情報をもとにObservableを作成します
   *
   * グローバルイベントストリームをフィルタリングし、特定の監視条件に
   * 合致するイベントのみを配信するObservableを生成します。
   *
   * @param globalChangeSubject グローバルイベントストリーム
   * @param subscriptionInfo サブスクリプション情報
   * @param filterPredicate イベントフィルタリング関数
   * @param transformEvent イベント変換関数
   * @param updateActivity 活動時刻更新関数
   * @param markInactive 非アクティブ化関数
   * @returns フィルタリングされたObservable
   */
  createFilteredObservable(
    globalChangeSubject: Subject<TreeChangeEvent>,
    subscriptionInfo: SubscriptionInfo,
    filterPredicate: (event: TreeChangeEvent) => boolean,
    transformEvent: (event: TreeChangeEvent, subscriptionId: string) => TreeChangeEvent,
    updateActivity: (subscriptionId: string) => void,
    markInactive: (subscriptionId: string) => void
  ): Observable<TreeChangeEvent> {
    const { id: subscriptionId, subject } = subscriptionInfo;

    // グローバルイベントストリームのフィルタリングと変換
    const filteredObservable = globalChangeSubject.pipe(
      rxFilter(filterPredicate),
      map((event) => transformEvent(event, subscriptionId)),
      share()
    );

    // フィルタリングされたイベントをサブスクリプション固有のSubjectに転送
    const subscription = filteredObservable.subscribe((event) => {
      subject.next(event);
      updateActivity(subscriptionId);
    });

    // サブスクリプション固有のObservableを作成
    const resultObservable = subject.asObservable();

    // カスタムunsubscribe処理を追加してリソース管理を実現
    return this.addCleanupBehavior(resultObservable, subscription, subscriptionId, markInactive);
  }

  /**
   * 初期値付きObservableを作成します
   *
   * includeInitialValue または includeInitialSnapshot が true の場合に、
   * 初期イベントを含むObservableを作成します。
   *
   * @param baseObservable ベースとなるObservable
   * @param initialEvent 初期イベント
   * @returns 初期イベント付きObservable
   */
  withInitialEvent(
    baseObservable: Observable<TreeChangeEvent>,
    initialEvent: TreeChangeEvent
  ): Observable<TreeChangeEvent> {
    return baseObservable.pipe(startWith(initialEvent));
  }

  /**
   * Observableにクリーンアップ動作を追加します
   *
   * subscribe メソッドをオーバーライドし、unsubscribe時に自動的に
   * リソースクリーンアップが実行されるようにします。これにより
   * メモリリークを防止し、適切なリソース管理を実現します。
   *
   * @param observable ベースObservable
   * @param subscription 内部サブスクリプション
   * @param subscriptionId サブスクリプションID
   * @param markInactive 非アクティブ化関数
   * @returns クリーンアップ処理付きObservable
   */
  private addCleanupBehavior(
    observable: Observable<TreeChangeEvent>,
    subscription: any,
    subscriptionId: string,
    markInactive: (subscriptionId: string) => void
  ): Observable<TreeChangeEvent> {
    // 元のsubscribeメソッドを保持
    const originalSubscribe = observable.subscribe.bind(observable);

    // カスタムsubscribeメソッドを実装
    observable.subscribe = (observerOrNext?: any, error?: any, complete?: any) => {
      const sub = originalSubscribe(observerOrNext as any, error, complete);
      const originalUnsubscribe = sub.unsubscribe.bind(sub);

      // カスタムunsubscribe処理を追加
      sub.unsubscribe = () => {
        // 内部サブスクリプションのクリーンアップ
        subscription.unsubscribe();
        // サブスクリプション管理状態の更新
        markInactive(subscriptionId);
        // 元のunsubscribe実行
        originalUnsubscribe();
      };

      return sub;
    };

    return observable;
  }
}
