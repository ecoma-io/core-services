import { MaybeAsync } from '@ecoma-io/common';
import { ICommand } from './command';

/**
 * Handler responsible for executing a `Command`.
 *
 * @typeParam C - Concrete command type handled by the implementation.
 * @typeParam R - Return type produced by the handler. Defaults to `void`.
 * @remarks
 * Implementations should perform necessary validation and side effects.
 */
export interface ICommandHandler<C extends ICommand, R = void> {
  /**
   * Handle the provided command.
   *
   * @param command - The command message to handle.
   * @returns A possibly-async result of handling the command.
   */
  handle(command: C): MaybeAsync<R>;
}
