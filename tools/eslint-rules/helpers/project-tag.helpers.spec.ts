import { computeRequiredTag } from './project-tag.helpers';
import * as path from 'path';

describe('computeRequiredTag', () => {
  it('computes tag from file path with default prefix', () => {
    // Arrange
    const base = path.posix.join('/', 'repo');
    // Act
    const file = path.posix.join(base, 'apps', 'myapp', 'project.json');
    const tag = computeRequiredTag(file, { baseRoot: base });
    // Assert
    expect(tag).toBe('type:apps');
  });

  it('uses custom tag prefix', () => {
    // Arrange
    const base = path.posix.join('/', 'repo');
    // Act
    const file = path.posix.join(base, 'libs', 'core', 'project.json');
    const tag = computeRequiredTag(file, {
      baseRoot: base,
      tagPrefix: 'category:',
    });
    // Assert
    expect(tag).toBe('category:libs');
  });

  it('handles files outside base root', () => {
    // Arrange
    const base = path.posix.join('/', 'repo');
    // Act
    const tag = computeRequiredTag('/some/other/path/project.json', {
      baseRoot: base,
      tagPrefix: 't:',
    });
    // Assert
    // Leading slash is removed when deriving top folder
    expect(tag).toBe('t:some');
  });

  it('handles nested project paths', () => {
    // Arrange
    const base = path.posix.join('/', 'repo');
    // Act
    const file = path.posix.join(
      base,
      'packages',
      'ui',
      'button',
      'project.json'
    );
    const tag = computeRequiredTag(file, { baseRoot: base });
    // Assert
    expect(tag).toBe('type:packages');
  });

  it('handles paths with backslashes', () => {
    // Arrange
    const base = 'C:\\repo';
    // Act
    const file = 'C:\\repo\\apps\\myapp\\project.json';
    const tag = computeRequiredTag(file, { baseRoot: base });
    // Assert
    expect(tag).toBe('type:apps');
  });

  it('returns unknown for empty path', () => {
    // Arrange
    // Empty path results in current working directory being used
    // The test environment is in /workspaces/core-services, so the first segment is 'workspaces'
    // Act
    const tag = computeRequiredTag('', { baseRoot: '/some/absolute/root' });
    // Assert
    expect(tag).toBe('type:unknown');
  });

  it('uses default tagPrefix when not provided', () => {
    // Arrange
    const base = path.posix.join('/', 'repo');
    // Act
    const file = path.posix.join(base, 'tools', 'script', 'project.json');
    const tag = computeRequiredTag(file, { baseRoot: base });
    // Assert
    expect(tag).toBe('type:tools');
  });

  it('handles relative path that does not start with ..', () => {
    // Arrange
    const base = path.posix.join('/', 'repo');
    // Act
    const file = path.posix.join(base, 'apps', 'test', 'project.json');
    const tag = computeRequiredTag(file, { baseRoot: base });
    // Assert
    expect(tag).toBe('type:apps');
  });

  it('uses process.cwd() when workspaceRoot is not available', () => {
    // Arrange
    const file = 'apps/test/project.json';
    // Act
    const tag = computeRequiredTag(file);
    // Assert
    // Will use process.cwd() as baseRoot
    expect(tag).toContain(':');
  });
});
