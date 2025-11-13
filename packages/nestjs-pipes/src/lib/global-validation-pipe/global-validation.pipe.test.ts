import { ValidationPipe } from '@nestjs/common';
import { GlobalValidationPipe } from './global-validation.pipe';
import { validationPipeOptions } from './validation-pipe.options';

jest.mock('@nestjs/common', () => ({
  ...jest.requireActual('@nestjs/common'),
  ValidationPipe: jest.fn(),
}));

const mockValidationPipe = ValidationPipe as jest.MockedClass<
  typeof ValidationPipe
>;

describe('GlobalValidationPipe', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create an instance with default options when no options are provided', () => {
    // Arrange: No additional options provided.

    // Act: Instantiate GlobalValidationPipe without options.
    new GlobalValidationPipe();

    // Assert: Verify that ValidationPipe is called with the default validationPipeOptions.
    expect(mockValidationPipe).toHaveBeenCalledWith(validationPipeOptions);
  });

  it('should create an instance and merge options when additional options are provided', () => {
    // Arrange: Define additional options to merge.
    const additionalOptions = { transform: true, whitelist: false };

    // Act: Instantiate GlobalValidationPipe with additional options.
    new GlobalValidationPipe(additionalOptions);

    // Assert: Verify that ValidationPipe is called with merged options (defaults overridden by additional).
    expect(mockValidationPipe).toHaveBeenCalledWith({
      ...validationPipeOptions,
      ...additionalOptions,
    });
  });

  it('should handle undefined options by using default options', () => {
    // Arrange: Provide undefined as options.

    // Act: Instantiate GlobalValidationPipe with undefined options.
    new GlobalValidationPipe(undefined);

    // Assert: Verify that ValidationPipe is called with default options.
    expect(mockValidationPipe).toHaveBeenCalledWith(validationPipeOptions);
  });

  it('should handle empty object options by using default options', () => {
    // Arrange: Provide an empty object as options.
    const emptyOptions = {};

    // Act: Instantiate GlobalValidationPipe with empty options.
    new GlobalValidationPipe(emptyOptions);

    // Assert: Verify that ValidationPipe is called with merged options (empty object does not override).
    expect(mockValidationPipe).toHaveBeenCalledWith({
      ...validationPipeOptions,
      ...emptyOptions,
    });
  });
});
