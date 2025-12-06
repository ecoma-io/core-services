import {
  initStandardizedLogger,
  initStandardizedTracer,
} from './observability';

jest.mock('@ecoma-io/node-observability', () => ({
  StandardizedLogger: { initialize: jest.fn() },
  StandardizedTracer: { initialize: jest.fn() },
}));

describe('observability utils', () => {
  test('initStandardizedLogger calls initialize with expected shape', () => {
    // Arrange: prepare args for initializer
    const opts = { id: 'i', projectName: 'p', projectVersion: 'v' };

    // Act
    initStandardizedLogger(opts);

    // Assert
    const mod = require('@ecoma-io/node-observability');
    expect(mod.StandardizedLogger.initialize).toHaveBeenCalled();
  });

  test('initStandardizedTracer calls initialize with expected shape', () => {
    // Arrange
    process.env.HYPERDX_API_KEY = 'k';
    process.env.HYPERDX_OLTP_GRPC_PORT = '1234';
    const opts = { id: 'i', projectName: 'p', projectVersion: 'v' };

    // Act
    initStandardizedTracer(opts);

    // Assert
    const mod = require('@ecoma-io/node-observability');
    expect(mod.StandardizedTracer.initialize).toHaveBeenCalled();
  });
});
