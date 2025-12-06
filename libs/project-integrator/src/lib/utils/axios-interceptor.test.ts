import { createAxiosInterceptor } from './axios-interceptor';

jest.mock('@opentelemetry/api', () => ({
  context: { active: jest.fn() },
  propagation: { inject: jest.fn() },
}));

describe('createAxiosInterceptor', () => {
  test('injects propagation headers and logs', () => {
    // Arrange
    const tracer = {
      startActiveSpan: jest.fn().mockImplementation((name: string, fn: any) =>
        fn({
          spanContext: () => ({ traceId: 'tid' }),
          end: jest.fn(),
        })
      ),
    } as any;

    const logger = { info: jest.fn() } as any;

    const interceptor = createAxiosInterceptor(tracer, logger);

    const hostFn = interceptor('svc');
    const config = { method: 'get', url: '/path', headers: undefined } as any;

    // Act
    const out = hostFn(config);

    // Assert
    expect(tracer.startActiveSpan).toHaveBeenCalled();
    const { propagation } = require('@opentelemetry/api');
    expect(propagation.inject).toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalled();
    expect(out).toEqual(config);
  });

  test('falls back to GET when method is undefined', () => {
    // Arrange
    const tracer = {
      startActiveSpan: jest.fn().mockImplementation((name: string, fn: any) =>
        fn({
          spanContext: () => ({ traceId: 'tid' }),
          end: jest.fn(),
        })
      ),
    } as any;

    const logger = { info: jest.fn() } as any;
    const interceptor = createAxiosInterceptor(tracer, logger);
    const hostFn = interceptor('svc');
    const config = { url: '/path' } as any;

    // Act
    const out = hostFn(config);

    // Assert
    expect(out).toEqual(config);
    expect(tracer.startActiveSpan).toHaveBeenCalled();
  });

  test('uses existing headers object without overwriting', () => {
    // Arrange
    const tracer = {
      startActiveSpan: jest.fn().mockImplementation((name: string, fn: any) =>
        fn({
          spanContext: () => ({ traceId: 'tid' }),
          end: jest.fn(),
        })
      ),
    } as any;

    const logger = { info: jest.fn() } as any;
    const interceptor = createAxiosInterceptor(tracer, logger);
    const hostFn = interceptor('svc');
    const headers = { 'x-test': '1' } as any;
    const config = { method: 'post', url: '/path', headers } as any;

    // Act
    const out = hostFn(config);

    // Assert
    expect(out).toBe(config);
    const { propagation } = require('@opentelemetry/api');
    const calls = propagation.inject.mock.calls as any[];
    expect(calls.some((c) => c[1] && c[1]['x-test'] === '1')).toBeTruthy();
  });
});
