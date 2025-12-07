import { analyzeParams } from './analyze-params';
import { Level } from 'pino';

describe('analyze-params', () => {
  afterEach(() => {
    jest.resetAllMocks();
    jest.clearAllMocks();
  });
  test('extracts context from last param when not stacktrace', () => {
    // Arrange
    const msg = 'hi %s';
    const level = 'info' as Level;
    const params = ['bob', 'ctx'];

    // Act
    const r = analyzeParams(msg, level, params);

    // Assert
    expect(r.context).toBe('ctx');
    expect(r.interpolationValues).toStrictEqual(['bob']);
    expect(r.mergeObject).toStrictEqual({});
  });

  test('detects stack trace case and preserves instance context', () => {
    // Arrange
    const msg = 'oops';
    const level = 'error' as Level;
    const params = ['Error: x\n    at here'];

    // Act
    const r = analyzeParams(msg, level, params, 'inst');

    // Assert
    expect(r.context).toBe('inst');
  });

  test('object last param is used for interpolation when message contains placeholders', () => {
    // Arrange
    const obj = { a: 1 };
    const msg = '%s %j';

    // Act
    const r = analyzeParams(msg, 'info' as Level, ['hello', obj, 'ctx']);

    // Assert: With two placeholders ('%s' and '%j') the object is used for interpolation
    expect(r.mergeObject).toStrictEqual({});
  });
});
