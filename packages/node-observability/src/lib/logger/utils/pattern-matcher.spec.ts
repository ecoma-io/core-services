import {
  doesPatternMatch,
  isSimplePattern,
  matchesSimplePattern,
  matchWildcardPattern,
} from './pattern-matcher';

describe('pattern-matcher', () => {
  test('isSimplePattern identifies simple patterns', () => {
    // Act & Assert
    expect(isSimplePattern('a')).toBe(true);
    expect(isSimplePattern('a.b')).toBe(false);
  });

  test('matchWildcardPattern supports ** and *', () => {
    // Act & Assert
    expect(matchWildcardPattern(['**', 'b'], ['a', 'b'])).toBe(true);
    expect(matchWildcardPattern(['a', '*'], ['a', 'x'])).toBe(true);
    // pattern consumed but path remains should be false
    expect(matchWildcardPattern(['a'], ['a', 'b'])).toBe(false);
    // trailing ** matches remaining segments
    expect(matchWildcardPattern(['**'], ['a', 'b'])).toBe(true);
  });

  test('doesPatternMatch respects case sensitivity', () => {
    // Act & Assert
    expect(doesPatternMatch('A', ['a'], true)).toBe(true);
    expect(doesPatternMatch('A', ['a'], false)).toBe(false);
  });

  test('matchesSimplePattern uses final segment', () => {
    // Act & Assert
    expect(matchesSimplePattern('x', 'y', ['a', 'x'], true)).toBe(true);
  });
});
