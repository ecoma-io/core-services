import { UpcasterRegistryImpl } from './upcaster.registry';
import { DomainEventEnvelope } from '@ecoma-io/domain';

describe('UpcasterRegistry', () => {
  test('runs registered upcasters in order', () => {
    const reg = new UpcasterRegistryImpl();
    reg.register('A', (ev) => ({ ...ev, payload: { ...ev.payload, a: 1 } }));
    reg.register('A', (ev) => ({ ...ev, payload: { ...ev.payload, b: 2 } }));

    const ev: DomainEventEnvelope = {
      id: '1',
      type: 'A',
      aggregateId: 'agg-1',
      occurredAt: new Date().toISOString(),
      eventVersion: '1.0.0',
      payload: {},
      metadata: {},
    };

    const out = reg.upcast(ev);
    expect((out.payload as any).a).toBe(1);
    expect((out.payload as any).b).toBe(2);
  });
});
