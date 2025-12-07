import { redactObject } from './redact-object';

describe('redactObject', () => {
  afterEach(() => {
    jest.resetAllMocks();
    jest.clearAllMocks();
  });
  test('redacts simple keys', () => {
    // Arrange
    const src = { user: { password: 'secret', name: 'x' } };

    // Act
    const out = redactObject(src, ['password']);

    // Assert
    expect(out.user.password).toBe('***');
  });

  test('supports wildcard patterns', () => {
    // Arrange
    const src = { user: { credentials: { token: 't' } } };

    // Act
    const out = redactObject(src, ['**.token']);

    // Assert
    expect(out.user.credentials.token).toBe('***');
  });

  test('redacts inside arrays and primitive items unchanged', () => {
    // Arrange
    const src = { list: [{ token: 'a' }, { token: 'b' }, 1] } as any;

    // Act
    const out = redactObject(src, ['token']);

    // Assert
    expect(out.list[0].token).toBe('***');
    expect(out.list[1].token).toBe('***');
    expect(out.list[2]).toBe(1);
  });

  test('respects maxDepth and leaves nested objects when depth limited', () => {
    // Arrange
    const src = { a: { b: { secret: 'x' } } };

    // Act
    const out = redactObject(src, ['secret'], { maxDepth: 1 });

    // Assert: with maxDepth 1, nested object under 'a' should be untouched
    expect(out.a).toStrictEqual({ b: { secret: 'x' } });
  });

  test('ignores non-object values', () => {
    // Arrange
    const num = 42 as unknown as Record<string, unknown>;

    // Act
    const out = redactObject(num, ['x']);

    // Assert
    expect(out).toBe(num);
  });

  test('supports custom replacement and case-insensitive patterns', () => {
    // Arrange
    const src1 = { user: { password: 'top' } } as any;

    // Act
    const out1 = redactObject(src1, ['password'], {
      replacement: '[REDACTED]',
    });

    // Assert
    expect(out1.user.password).toBe('[REDACTED]');

    // Arrange: case-insensitive path
    const src2 = { user: { Password: 'top' } } as any;

    // Act
    const out2 = redactObject(src2, ['user.password'], {
      caseInsensitive: true,
    });

    // Assert
    expect(out2.user.Password).toBe('***');
  });
});
