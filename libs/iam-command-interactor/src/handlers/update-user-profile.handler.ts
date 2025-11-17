import {
  ICommandHandler,
  IAggregateRepository,
  IUnitOfWork,
} from '@ecoma-io/interactor';
import { UserAggregate } from '@ecoma-io/iam-domain';
import { UpdateUserProfileCommand } from '../commands/update-user-profile.command';
import { DomainException } from '@ecoma-io/domain';

/**
 * Handler for UpdateUserProfileCommand.
 *
 * Loads user aggregate, updates profile, commits to event store.
 */
export class UpdateUserProfileHandler
  implements ICommandHandler<UpdateUserProfileCommand, number>
{
  constructor(
    private readonly repo: IAggregateRepository<UserAggregate>,
    private readonly uow: IUnitOfWork
  ) {}

  async handle(command: UpdateUserProfileCommand): Promise<number> {
    const { userId, firstName, lastName, avatarUrl } = command;

    // Load aggregate
    const agg = await this.repo.load(userId);
    if (!agg) {
      throw new DomainException(`User ${userId} not found`);
    }

    // Update profile
    agg.updateProfile({ firstName, lastName, avatarUrl });

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
