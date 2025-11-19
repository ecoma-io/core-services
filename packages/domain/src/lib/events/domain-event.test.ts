import { DomainEvent } from './domain-event';

type Payload = { foo: string };

class TestEvent extends DomainEvent<Payload> {}

describe('DomainEvent base', () => {
  test('constructs with provided id and properties', () => {
    const props = {
      id: 'evt-1',
      version: '1.0.0',
      occurredAt: '2025-01-01T00:00:00.000Z',
      type: 'Test',
      aggregateId: 'agg-1',
      payload: { foo: 'bar' } as Payload,
    } as const;

    const e = new TestEvent(props);
    expect(e.id).toBe('evt-1');
    expect(e.version).toBe('1.0.0');
    expect(e.occurredAt).toBe('2025-01-01T00:00:00.000Z');
    expect(e.type).toBe('Test');
    expect(e.aggregateId).toBe('agg-1');
    expect(e.payload).toEqual({ foo: 'bar' });
  });

  test('generates id and occurredAt when omitted and freezes payload', () => {
    const props = {
      version: '1.0.0',
      type: 'Auto',
      aggregateId: 'agg-2',
      payload: { foo: 'baz' } as Payload,
    } as any;

    const e = new TestEvent(props);
    expect(typeof e.id).toBe('string');
    expect(typeof e.occurredAt).toBe('string');
    // payload should be frozen (shallow)
    expect(Object.isFrozen(e.payload)).toBe(true);
  });
});
