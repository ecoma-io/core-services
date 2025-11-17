import {
  ICommandHandler,
  IAggregateRepository,
  IUnitOfWork,
} from '@ecoma-io/interactor';
import { UserAggregate } from '@ecoma-io/iam-domain';
import { ActivateUserCommand } from '../commands/activate-user.command';
import { DomainException } from '@ecoma-io/domain';

/**
 * Handler for ActivateUserCommand.
 *
 * Loads user aggregate, activates account, commits to event store.
 */
export class ActivateUserHandler
  implements ICommandHandler<ActivateUserCommand, number>
{
  constructor(
    private readonly repo: IAggregateRepository<UserAggregate>,
    private readonly uow: IUnitOfWork
  ) {}

  async handle(command: ActivateUserCommand): Promise<number> {
    const { userId } = command;

    // Load aggregate
    const agg = await this.repo.load(userId);
    if (!agg) {
      throw new DomainException(`User ${userId} not found`);
    }

    // Activate
    agg.activate();

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
