/**
 * プラグインイベントエミッター
 */

import { NodeType } from '@hierarchidb/common-type';

/**
 * プラグインイベント
 */
export type PluginEvent = 
  | 'plugin-loaded'
  | 'plugin-initialized'
  | 'plugin-error'
  | 'cache-cleared'
  | 'all-plugins-loaded';

/**
 * イベントペイロード
 */
export interface PluginEventPayload {
  nodeType?: NodeType;
  error?: Error;
  message?: string;
  timestamp?: Date;
  [key: string]: any;
}

/**
 * イベントエミッター実装
 */
export class PluginEventEmitter {
  private handlers: Map<PluginEvent, Set<Function>> = new Map();
  
  /**
   * イベントリスナーを登録
   */
  on(event: PluginEvent, handler: Function): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
  }
  
  /**
   * イベントリスナーを削除
   */
  off(event: PluginEvent, handler: Function): void {
    const eventHandlers = this.handlers.get(event);
    if (eventHandlers) {
      eventHandlers.delete(handler);
    }
  }
  
  /**
   * 一度だけ実行されるリスナーを登録
   */
  once(event: PluginEvent, handler: Function): void {
    const wrappedHandler = (payload: PluginEventPayload) => {
      handler(payload);
      this.off(event, wrappedHandler);
    };
    this.on(event, wrappedHandler);
  }
  
  /**
   * イベントを発火
   */
  emit(event: PluginEvent, payload: PluginEventPayload): void {
    const eventHandlers = this.handlers.get(event);
    if (eventHandlers) {
      const enrichedPayload = {
        ...payload,
        timestamp: new Date(),
      };
      
      for (const handler of eventHandlers) {
        try {
          handler(enrichedPayload);
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
        }
      }
    }
  }
  
  /**
   * すべてのリスナーをクリア
   */
  clear(): void {
    this.handlers.clear();
  }
  
  /**
   * 特定イベントのリスナーをクリア
   */
  clearEvent(event: PluginEvent): void {
    this.handlers.delete(event);
  }
}