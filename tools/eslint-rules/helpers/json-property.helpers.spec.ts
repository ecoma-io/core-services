import { getPropertyName, isRootProperty } from './json-property.helpers';

describe('json-property helpers', () => {
  describe('getPropertyName', () => {
    it('reads identifier type property names', () => {
      // Arrange
      const ident = { type: 'JSONIdentifier', name: 'name' } as any;
      // Act
      const result = getPropertyName({ key: ident } as any);
      // Assert
      expect(result).toBe('name');
    });

    it('reads literal type property names', () => {
      // Arrange
      const lit = { type: 'JSONLiteral', value: 'value' } as any;
      // Act
      const result = getPropertyName({ key: lit } as any);
      // Assert
      expect(result).toBe('value');
    });

    it('falls back to context.getSourceCode.getText', () => {
      // Arrange
      const key = { type: 'Unknown' } as any;
      const ctx = {
        getSourceCode: () => ({
          getText: () => '"name"',
        }),
      } as any;
      // Act
      const result = getPropertyName({ key } as any, ctx);
      // Assert
      expect(result).toBe('name');
    });

    it('returns null when key is missing', () => {
      // Arrange
      const result = getPropertyName({ key: undefined } as any);
      // Assert
      expect(result).toBeNull();
    });

    it('returns null when context is not provided and key type is unknown', () => {
      // Arrange
      const key = { type: 'Unknown' } as any;
      // Act
      const result = getPropertyName({ key } as any);
      // Assert
      expect(result).toBeNull();
    });

    it('handles getText exception gracefully', () => {
      // Arrange
      const key = { type: 'Unknown' } as any;
      const ctx = {
        getSourceCode: () => ({
          getText: () => {
            throw new Error('test error');
          },
        }),
      } as any;
      // Act
      const result = getPropertyName({ key } as any, ctx);
      // Assert
      expect(result).toBeNull();
    });
  });

  describe('isRootProperty', () => {
    it('detects root-level properties', () => {
      // Arrange
      const root = {
        parent: {
          type: 'JSONObjectExpression',
          parent: { type: 'JSONProgram' },
        },
      } as any;
      // Act & Assert
      expect(isRootProperty(root)).toBe(true);
    });

    it('detects root-level properties with JSONExpressionStatement', () => {
      // Arrange
      const root = {
        parent: {
          type: 'JSONObjectExpression',
          parent: { type: 'JSONExpressionStatement' },
        },
      } as any;
      // Act & Assert
      expect(isRootProperty(root)).toBe(true);
    });

    it('returns false for non-root properties', () => {
      // Arrange
      const notRoot = {
        parent: {
          type: 'JSONObjectExpression',
          parent: { type: 'NotProgram' },
        },
      } as any;
      // Act & Assert
      expect(isRootProperty(notRoot)).toBe(false);
    });

    it('returns false when parent is not JSONObjectExpression', () => {
      // Arrange
      const notRoot = { parent: { type: 'SomethingElse' } } as any;
      // Act & Assert
      expect(isRootProperty(notRoot)).toBe(false);
    });

    it('returns false when parent is undefined', () => {
      // Arrange
      const notRoot = { parent: undefined } as any;
      // Act & Assert
      expect(isRootProperty(notRoot)).toBe(false);
    });

    it('returns false when grandparent is undefined', () => {
      // Arrange
      const notRoot = {
        parent: { type: 'JSONObjectExpression', parent: undefined },
      } as any;
      // Act & Assert
      expect(isRootProperty(notRoot)).toBe(false);
    });
  });
});
