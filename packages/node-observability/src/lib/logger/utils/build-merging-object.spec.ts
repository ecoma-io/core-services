import { buildMergingObject } from './build-merging-object';

describe('build-merging-object', () => {
  test('merges instance extra with additional props and context', () => {
    // Arrange & Act
    const out = buildMergingObject({ svc: 'X' }, 'ctx', { merged: true });

    // Assert
    expect(out).toMatchObject({ svc: 'X', merged: true, context: 'ctx' });
  });

  test('handles missing instance extra', () => {
    // Arrange & Act
    const out = buildMergingObject(undefined, 'ctx', { a: 1 });

    // Assert
    expect(out).toMatchObject({ a: 1, context: 'ctx' });
  });

  test('uses instance extra when additionalProps omitted', () => {
    // Act
    const out = buildMergingObject({ svc: 'X' }, 'ctx');

    // Assert
    expect(out).toMatchObject({ svc: 'X', context: 'ctx' });
  });

  test('overrides instance extra with additionalProps', () => {
    // Arrange & Act
    const out = buildMergingObject({ a: 1, b: 1 }, 'ctx', { a: 2 });

    // Assert
    expect(out).toMatchObject({ a: 2, b: 1, context: 'ctx' });
  });
});
