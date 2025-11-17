import { DomainException } from './domain.exception';

describe('DomainException', () => {
  test('is instance of Error and has flag', () => {
    // Arrange
    const ex = new DomainException('bad');

    // Act & Assert
    expect(ex).toBeInstanceOf(Error);
    expect((ex as any).isDomainException).toBe(true);
  });
});
