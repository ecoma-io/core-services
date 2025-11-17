import {
  ICommandHandler,
  IAggregateRepository,
  IUnitOfWork,
} from '@ecoma-io/interactor';
import { UserAggregate } from '@ecoma-io/iam-domain';
import { SuspendUserCommand } from '../commands/suspend-user.command';
import { DomainException } from '@ecoma-io/domain';

/**
 * Handler for SuspendUserCommand.
 *
 * Loads user aggregate, suspends account, commits to event store.
 */
export class SuspendUserHandler
  implements ICommandHandler<SuspendUserCommand, number>
{
  constructor(
    private readonly repo: IAggregateRepository<UserAggregate>,
    private readonly uow: IUnitOfWork
  ) {}

  async handle(command: SuspendUserCommand): Promise<number> {
    const { userId } = command;

    // Load aggregate
    const agg = await this.repo.load(userId);
    if (!agg) {
      throw new DomainException(`User ${userId} not found`);
    }

    // Suspend
    agg.suspend();

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
