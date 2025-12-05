import { IPublishExecutorOptions } from '../executors/publish/publish';

/**
 * Validate executor options.
 */
export function validateOptions(options: IPublishExecutorOptions): void {
  if (!options || typeof options !== 'object') {
    throw new Error('Executor options are required.');
  }

  if (!options.root || options.root === '') {
    throw new Error(
      'Option "root" is required and must be a non-empty string.'
    );
  }
}
