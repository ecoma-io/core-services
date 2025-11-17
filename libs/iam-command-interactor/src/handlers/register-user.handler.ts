import { ICommandHandler } from '@ecoma-io/interactor';
import { RegisterUserCommand } from '../commands/register-user.command';
import { IAggregateRepository, IUnitOfWork } from '@ecoma-io/interactor';
import { UserAggregate } from '@ecoma-io/iam-domain';

export class RegisterUserHandler
  implements ICommandHandler<RegisterUserCommand, number>
{
  constructor(
    private readonly repo: IAggregateRepository<UserAggregate>,
    private readonly uow: IUnitOfWork
  ) {}

  async handle(command: RegisterUserCommand): Promise<number> {
    const { userId, email, password, firstName, lastName } = command;

    // load or create
    let agg = await this.repo.load(userId);
    if (!agg) {
      agg = new UserAggregate(userId);
    }

    agg.register(email, password, { firstName, lastName });

    // persist via unit of work and return stream version
    const streamVersion = await this.uow.commit(
      userId,
      Array.from(agg.uncommittedEvents),
      agg.version
    );
    agg.clearUncommittedEvents();
    return streamVersion;
  }
}
