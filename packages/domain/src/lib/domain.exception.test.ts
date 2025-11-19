import { DomainException } from './domain.exception';
import { IntrinsicException } from '@ecoma-io/common';

class CustomException extends DomainException {
  constructor(message = 'Custom domain exception') {
    super(message);
  }
}

describe('DomainException', () => {
  test('is instance of Error and has flag', () => {
    // Arrange
    const ex = new CustomException('bad');

    // Act & Assert
    expect(ex).toBeInstanceOf(Error);
    expect(ex).toBeInstanceOf(IntrinsicException);
    expect(ex).toBeInstanceOf(DomainException);
    expect((ex as any).isDomainException).toBe(true);
  });
});
