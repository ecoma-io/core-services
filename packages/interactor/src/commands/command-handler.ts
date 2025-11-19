import { MaybeAsync } from '@ecoma-io/common';
import { Command } from './command';

/**
 * Handler responsible for executing a `Command`.
 *
 * @typeParam C - Concrete command type handled by the implementation.
 * @typeParam R - Return type produced by the handler. Defaults to `void`.
 * @remarks
 * Implementations should perform necessary validation and side effects.
 */
export interface CommandHandler<C extends Command, R = void> {
  /**
   * Handle the provided command.
   *
   * @param command - The command message to handle.
   * @returns A possibly-async result of handling the command.
   */
  handle(command: C): MaybeAsync<R>;
}
