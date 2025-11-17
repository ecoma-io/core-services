// eslint-disable-next-line @typescript-eslint/no-empty-interface, @typescript-eslint/no-empty-object-type
export interface ICommand {
  // marker interface for commands
}

export interface ICommandHandler<C extends ICommand, R = void> {
  handle(command: C): Promise<R>;
}
