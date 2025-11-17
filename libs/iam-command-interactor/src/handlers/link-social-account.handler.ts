import {
  ICommandHandler,
  IAggregateRepository,
  IUnitOfWork,
} from '@ecoma-io/interactor';
import { UserAggregate } from '@ecoma-io/iam-domain';
import { LinkSocialAccountCommand } from '../commands/link-social-account.command';
import { DomainException } from '@ecoma-io/domain';

/**
 * Handler for LinkSocialAccountCommand.
 *
 * Loads user aggregate, links social account, commits to event store.
 */
export class LinkSocialAccountHandler
  implements ICommandHandler<LinkSocialAccountCommand, number>
{
  constructor(
    private readonly repo: IAggregateRepository<UserAggregate>,
    private readonly uow: IUnitOfWork
  ) {}

  async handle(command: LinkSocialAccountCommand): Promise<number> {
    const { userId, provider, providerId, providerEmail } = command;

    // Load aggregate
    const agg = await this.repo.load(userId);
    if (!agg) {
      throw new DomainException(`User ${userId} not found`);
    }

    // Link social account
    agg.linkSocialAccount(provider, providerId, providerEmail);

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
