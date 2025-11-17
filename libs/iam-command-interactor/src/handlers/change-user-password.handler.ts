import {
  ICommandHandler,
  IAggregateRepository,
  IUnitOfWork,
} from '@ecoma-io/interactor';
import { UserAggregate } from '@ecoma-io/iam-domain';
import { ChangeUserPasswordCommand } from '../commands/change-user-password.command';
import { DomainException } from '@ecoma-io/domain';

/**
 * Handler for ChangeUserPasswordCommand.
 *
 * Loads user aggregate, changes password, commits to event store.
 */
export class ChangeUserPasswordHandler
  implements ICommandHandler<ChangeUserPasswordCommand, number>
{
  constructor(
    private readonly repo: IAggregateRepository<UserAggregate>,
    private readonly uow: IUnitOfWork
  ) {}

  async handle(command: ChangeUserPasswordCommand): Promise<number> {
    const { userId, newPassword } = command;

    // Load aggregate
    const agg = await this.repo.load(userId);
    if (!agg) {
      throw new DomainException(`User ${userId} not found`);
    }

    // Change password
    agg.changePassword(newPassword);

    // Commit
    const streamVersion = await this.uow.commit(
      userId,
      Array.from(agg.uncommittedEvents),
      agg.version
    );
    agg.clearUncommittedEvents();
    return streamVersion;
  }
}
