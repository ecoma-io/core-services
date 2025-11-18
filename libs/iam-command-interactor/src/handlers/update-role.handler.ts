import {
  ICommandHandler,
  IAggregateRepository,
  IUnitOfWork,
} from '@ecoma-io/interactor';
import { RoleAggregate, RoleName } from '@ecoma-io/iam-domain';
import { DomainException } from '@ecoma-io/domain';
import { UpdateRoleCommand } from '../commands/update-role.command';

export class UpdateRoleHandler
  implements ICommandHandler<UpdateRoleCommand, number>
{
  constructor(
    private readonly roleRepository: IAggregateRepository<RoleAggregate>,
    private readonly unitOfWork: IUnitOfWork
  ) {}

  async handle(command: UpdateRoleCommand): Promise<number> {
    const { roleId } = command;

    // Load role aggregate
    const role = await this.roleRepository.load(roleId);
    if (!role) {
      throw new DomainException(`Role with id ${roleId} not found`);
    }

    // TODO: Implement updateRole() method in RoleAggregate
    console.warn('[UpdateRoleHandler] Aggregate method not implemented yet');

    return role.version;
  }
}
