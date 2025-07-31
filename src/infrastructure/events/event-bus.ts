/**
 * イベントバス実装
 * ドメインイベントの発行と購読を管理
 */

import type { 
  IDomainEvent, 
  IEventHandler, 
  IEventPublisher, 
  IEventSubscriber 
} from '../../domain/events/base.event';

/**
 * インメモリイベントバス実装
 */
export class InMemoryEventBus implements IEventPublisher, IEventSubscriber {
  private readonly handlers: Map<string, Set<IEventHandler<any>>> = new Map();
  private eventHistory: IDomainEvent[] = [];
  private isProcessing = false;
  private readonly eventQueue: IDomainEvent[] = [];

  /**
   * イベントの発行
   */
  async publish(event: IDomainEvent): Promise<void> {
    // イベント履歴に追加
    this.eventHistory.push(event);

    // キューに追加
    this.eventQueue.push(event);

    // 処理中でなければ処理開始
    if (!this.isProcessing) {
      await this.processQueue();
    }
  }

  /**
   * 複数イベントの一括発行
   */
  async publishMany(events: ReadonlyArray<IDomainEvent>): Promise<void> {
    for (const event of events) {
      await this.publish(event);
    }
  }

  /**
   * イベントハンドラーの登録
   */
  subscribe<T extends IDomainEvent>(
    eventType: string,
    handler: IEventHandler<T>
  ): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    
    this.handlers.get(eventType)!.add(handler);
  }

  /**
   * イベントハンドラーの登録解除
   */
  unsubscribe(eventType: string, handler: IEventHandler<any>): void {
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      handlers.delete(handler);
      
      if (handlers.size === 0) {
        this.handlers.delete(eventType);
      }
    }
  }

  /**
   * イベントキューの処理
   */
  private async processQueue(): Promise<void> {
    this.isProcessing = true;

    while (this.eventQueue.length > 0) {
      const event = this.eventQueue.shift()!;
      await this.processEvent(event);
    }

    this.isProcessing = false;
  }

  /**
   * 個別イベントの処理
   */
  private async processEvent(event: IDomainEvent): Promise<void> {
    const handlers = this.handlers.get(event.eventType);
    
    if (handlers && handlers.size > 0) {
      // すべてのハンドラーを並列実行
      const promises = Array.from(handlers).map(handler =>
        this.executeHandler(handler, event)
      );
      
      await Promise.all(promises);
    }
  }

  /**
   * ハンドラーの実行（エラーハンドリング付き）
   */
  private async executeHandler(
    handler: IEventHandler<any>,
    event: IDomainEvent
  ): Promise<void> {
    try {
      await handler.handle(event);
    } catch (error) {
      console.error(
        `Error handling event ${event.eventType} with handler:`,
        error
      );
      // エラーが発生してもイベント処理は継続
    }
  }

  /**
   * イベント履歴の取得
   */
  getEventHistory(): ReadonlyArray<IDomainEvent> {
    return [...this.eventHistory];
  }

  /**
   * イベント履歴のクリア
   */
  clearEventHistory(): void {
    this.eventHistory = [];
  }

  /**
   * 特定タイプのイベント履歴を取得
   */
  getEventsByType(eventType: string): ReadonlyArray<IDomainEvent> {
    return this.eventHistory.filter(event => event.eventType === eventType);
  }

  /**
   * 特定集約のイベント履歴を取得
   */
  getEventsByAggregateId(aggregateId: string): ReadonlyArray<IDomainEvent> {
    return this.eventHistory.filter(event => event.aggregateId === aggregateId);
  }
}

/**
 * グローバルイベントバスインスタンス
 */
export const eventBus = new InMemoryEventBus();