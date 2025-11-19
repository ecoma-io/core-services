import { ServiceName } from './service-name';
import {
  ServiceNameEmptyException,
  ServiceNameFormatException,
  ServiceNameConsecutiveHyphensException,
  ServiceNameEndsWithHyphenException,
} from '../exceptions';

describe('ServiceName', () => {
  test('creates and normalizes a valid service name', () => {
    // Arrange
    const raw = '  My-Service  ';

    // Act
    const sn = ServiceName.create(raw);

    // Assert
    expect(sn.toString()).toBe('my-service');
  });

  test('throws ServiceNameEmptyException when empty', () => {
    // Arrange
    const raw = '';

    // Act & Assert
    try {
      ServiceName.create(raw);
      throw new Error('Expected to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ServiceNameEmptyException);
    }
  });

  test('throws ServiceNameFormatException when format invalid', () => {
    // Arrange
    const raw = '1Service';

    // Act & Assert
    try {
      ServiceName.create(raw);
      throw new Error('Expected to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ServiceNameFormatException);
    }
  });

  test('throws ServiceNameConsecutiveHyphensException for consecutive hyphens', () => {
    // Arrange
    const raw = 'my--service';

    // Act & Assert
    try {
      ServiceName.create(raw);
      throw new Error('Expected to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ServiceNameConsecutiveHyphensException);
    }
  });

  test('throws ServiceNameEndsWithHyphenException when ends with hyphen', () => {
    // Arrange
    const raw = 'service-';

    // Act & Assert
    try {
      ServiceName.create(raw);
      throw new Error('Expected to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ServiceNameEndsWithHyphenException);
    }
  });
});
