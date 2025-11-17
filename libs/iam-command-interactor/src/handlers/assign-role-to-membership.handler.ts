import {
  ICommandHandler,
  IAggregateRepository,
  IUnitOfWork,
} from '@ecoma-io/interactor';
import { MembershipAggregate, DomainException } from '@ecoma-io/iam-domain';
import { AssignRoleToMembershipCommand } from '../commands/assign-role-to-membership.command';

export class AssignRoleToMembershipHandler
  implements ICommandHandler<AssignRoleToMembershipCommand, number>
{
  constructor(
    private readonly membershipRepository: IAggregateRepository<MembershipAggregate>,
    private readonly unitOfWork: IUnitOfWork
  ) {}

  async handle(command: AssignRoleToMembershipCommand): Promise<number> {
    const { membershipId, roleId } = command;

    // Load membership aggregate
    const membership = await this.membershipRepository.findById(membershipId);
    if (!membership) {
      throw new DomainException(`Membership with id ${membershipId} not found`);
    }

    // Execute business logic
    membership.assignRole(roleId);

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
