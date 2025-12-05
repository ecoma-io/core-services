import { ValidationPipe, ValidationPipeOptions } from '@nestjs/common';
import { validationPipeOptions } from './validation-pipe.options';

/**
 * A custom validation pipe that extends NestJS's ValidationPipe with predefined options.
 * This class merges default validation pipe options with any additional options provided.
 */
export class GlobalValidationPipe extends ValidationPipe {
  /**
   * Creates an instance of GlobalValidationPipe.
   * @param {ValidationPipeOptions} [options] - Optional additional validation pipe options to merge with defaults.
   * @returns {GlobalValidationPipe} - A new instance of the validation pipe.
   */
  constructor(options?: ValidationPipeOptions) {
    super({
      ...validationPipeOptions,
      ...options,
    });
  }
}
