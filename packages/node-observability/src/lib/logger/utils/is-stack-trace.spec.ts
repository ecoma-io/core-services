import { isStackTrace } from './is-stack-trace';

describe('isStackTrace', () => {
  test('detects a stack-like param when message is string and level is error', () => {
    // Arrange
    const msg = 'some error';
    const param = 'Error: boom\n    at here';

    // Act & Assert
    expect(isStackTrace(msg, 'error', param)).toBe(true);
  });

  test('returns false otherwise', () => {
    // Act & Assert
    expect(isStackTrace('x', 'info', 'a')).toBe(false);
    expect(isStackTrace({}, 'error', 'a')).toBe(false);
  });
});
