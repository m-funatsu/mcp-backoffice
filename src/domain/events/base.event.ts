/**
 * ドメインイベント基底クラス
 * すべてのドメインイベントの基本となる抽象クラス
 */

/**
 * ドメインイベントインターフェース
 */
export interface IDomainEvent {
  readonly aggregateId: string;
  readonly eventType: string;
  readonly occurredAt: Date;
  readonly eventId: string;
  readonly metadata?: Record<string, unknown>;
}

/**
 * ドメインイベント基底クラス
 */
export abstract class DomainEvent implements IDomainEvent {
  readonly eventId: string;
  readonly occurredAt: Date;
  readonly metadata?: Record<string, unknown>;

  constructor(
    public readonly aggregateId: string,
    public readonly eventType: string,
    metadata?: Record<string, unknown>
  ) {
    this.eventId = this.generateEventId();
    this.occurredAt = new Date();
    this.metadata = metadata;
  }

  private generateEventId(): string {
    return `EVT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * イベントハンドラーインターフェース
 */
export interface IEventHandler<T extends IDomainEvent> {
  handle(event: T): Promise<void>;
}

/**
 * イベントパブリッシャーインターフェース
 */
export interface IEventPublisher {
  publish(event: IDomainEvent): Promise<void>;
  publishMany(events: IDomainEvent[]): Promise<void>;
}

/**
 * イベントサブスクライバーインターフェース
 */
export interface IEventSubscriber {
  subscribe<T extends IDomainEvent>(
    eventType: string,
    handler: IEventHandler<T>
  ): void;
  unsubscribe(eventType: string, handler: IEventHandler<any>): void;
}