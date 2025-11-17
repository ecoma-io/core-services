import {
  ICommandHandler,
  IAggregateRepository,
  IUnitOfWork,
} from '@ecoma-io/interactor';
import { MembershipAggregate, DomainException } from '@ecoma-io/iam-domain';
import { RemoveRoleFromMembershipCommand } from '../commands/remove-role-from-membership.command';

export class RemoveRoleFromMembershipHandler
  implements ICommandHandler<RemoveRoleFromMembershipCommand, number>
{
  constructor(
    private readonly membershipRepository: IAggregateRepository<MembershipAggregate>,
    private readonly unitOfWork: IUnitOfWork
  ) {}

  async handle(command: RemoveRoleFromMembershipCommand): Promise<number> {
    const { membershipId, roleId } = command;

    // Load membership aggregate
    const membership = await this.membershipRepository.findById(membershipId);
    if (!membership) {
      throw new DomainException(`Membership with id ${membershipId} not found`);
    }

    // Execute business logic
    membership.removeRole(roleId);

    // Get uncommitted events and current version
    const events = membership.getUncommittedEvents();
    const currentVersion = membership.version;

    // Commit via unit of work
    const streamVersion = await this.unitOfWork.commit(
      membershipId,
      events,
      currentVersion
    );

    // Clear uncommitted events
    membership.clearUncommittedEvents();

    return streamVersion;
  }
}
