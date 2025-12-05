import { globToRegExp } from './glob.helpers';

describe('globToRegExp', () => {
  it('handles single star glob pattern', () => {
    // Arrange
    const regex = globToRegExp('apps/*/project.json');
    // Act & Assert
    expect(regex.test('apps/x/project.json')).toBe(true);
    expect(regex.test('apps/x/y/project.json')).toBe(false);
  });

  it('handles double star glob pattern', () => {
    // Arrange
    const regex = globToRegExp('apps/**/project.json');
    // Act & Assert
    expect(regex.test('apps/x/project.json')).toBe(true);
    expect(regex.test('apps/x/y/project.json')).toBe(true);
  });

  it('normalizes backslashes to forward slashes', () => {
    // Arrange
    const regex = globToRegExp('apps\\*\\project.json');
    // Act & Assert
    expect(regex.test('apps/x/project.json')).toBe(true);
  });

  it('escapes regex special characters', () => {
    // Arrange
    const regex = globToRegExp('apps/[test]/project.json');
    // Act & Assert
    expect(regex.test('apps/[test]/project.json')).toBe(true);
    expect(regex.test('apps/t/project.json')).toBe(false);
  });
});
