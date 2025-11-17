import { DomainEventEnvelope } from '@ecoma-io/domain';

export type Upcaster = (ev: DomainEventEnvelope) => DomainEventEnvelope;

export class UpcasterRegistryImpl {
  private upcasters: Record<string, Upcaster[]> = {};

  register(eventType: string, upcaster: Upcaster) {
    this.upcasters[eventType] = this.upcasters[eventType] || [];
    this.upcasters[eventType].push(upcaster);
  }

  upcast(ev: DomainEventEnvelope): DomainEventEnvelope {
    const list = this.upcasters[ev.type] || [];
    return list.reduce((acc, fn) => fn(acc), ev);
  }
}

export type UpcasterRegistry = UpcasterRegistryImpl;
