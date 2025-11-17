import { DomainEventEnvelope } from '@ecoma-io/domain';

export type IEvent = DomainEventEnvelope;

export interface IEventHandler<E extends IEvent = IEvent> {
  handle(event: E): Promise<void>;
}
