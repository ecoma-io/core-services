import {
  ICommandHandler,
  IAggregateRepository,
  IUnitOfWork,
} from '@ecoma-io/interactor';
import { MembershipAggregate } from '@ecoma-io/iam-domain';
import { DomainException } from '@ecoma-io/domain';
import { RemoveRoleFromMembershipCommand } from '../commands/remove-role-from-membership.command';

export class RemoveRoleFromMembershipHandler
  implements ICommandHandler<RemoveRoleFromMembershipCommand, number>
{
  constructor(
    private readonly membershipRepository: IAggregateRepository<MembershipAggregate>,
    private readonly unitOfWork: IUnitOfWork
  ) {}

  async handle(command: RemoveRoleFromMembershipCommand): Promise<number> {
    const { membershipId } = command;

    // Load membership aggregate
    const membership = await this.membershipRepository.load(membershipId);
    if (!membership) {
      throw new DomainException(`Membership with id ${membershipId} not found`);
    }

    // TODO: Implement removeRole() method in MembershipAggregate
    console.warn(
      '[RemoveRoleFromMembershipHandler] Aggregate method not implemented yet'
    );

    return membership.version;
  }
}
