import {
  ICommandHandler,
  IAggregateRepository,
  IUnitOfWork,
} from '@ecoma-io/interactor';
import { MembershipAggregate } from '@ecoma-io/iam-domain';
import { CreateMembershipCommand } from '../commands/create-membership.command';

export class CreateMembershipHandler
  implements
    ICommandHandler<
      CreateMembershipCommand,
      { membershipId: string; streamVersion: number }
    >
{
  constructor(
    private readonly membershipRepository: IAggregateRepository<MembershipAggregate>,
    private readonly unitOfWork: IUnitOfWork
  ) {}

  async handle(command: CreateMembershipCommand): Promise<{
    membershipId: string;
    streamVersion: number;
  }> {
    const { membershipId, userId, tenantId } = command;

    // Create new membership aggregate
    const membership = new MembershipAggregate(membershipId);
    membership.addToTenant(membershipId, userId, tenantId);

    // Get uncommitted events
    const events = Array.from(membership.uncommittedEvents);

    // Commit via unit of work (publishes to RabbitMQ)
    const streamVersion = await this.unitOfWork.commit(
      membershipId,
      events,
      -1 // Expected version -1 means stream should not exist
    );

    // Clear uncommitted events
    membership.clearUncommittedEvents();

    return {
      membershipId,
      streamVersion,
    };
  }
}
