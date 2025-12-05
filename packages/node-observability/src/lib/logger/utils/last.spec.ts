import { last } from './last';

describe('last', () => {
  afterEach(() => {
    jest.resetAllMocks();
    jest.clearAllMocks();
  });
  test('returns last element when present', () => {
    // Act & Assert
    expect(last([1, 2, 3])).toBe(3);
  });

  test('returns default when array empty', () => {
    // Act & Assert
    expect(last([], 'x')).toBe('x');
  });
});
