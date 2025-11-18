import {
  ICommandHandler,
  IAggregateRepository,
  IUnitOfWork,
} from '@ecoma-io/interactor';
import { RoleAggregate, PermissionKey } from '@ecoma-io/iam-domain';
import { DomainException } from '@ecoma-io/domain';
import { AssignPermissionsCommand } from '../commands/assign-permissions.command';

export class AssignPermissionsHandler
  implements ICommandHandler<AssignPermissionsCommand, number>
{
  constructor(
    private readonly roleRepository: IAggregateRepository<RoleAggregate>,
    private readonly unitOfWork: IUnitOfWork
  ) {}

  async handle(command: AssignPermissionsCommand): Promise<number> {
    const { roleId } = command;

    // Load role aggregate
    const role = await this.roleRepository.load(roleId);
    if (!role) {
      throw new DomainException(`Role with id ${roleId} not found`);
    }

    // TODO: Implement assignPermissions() method in RoleAggregate
    console.warn(
      '[AssignPermissionsHandler] Aggregate method not implemented yet'
    );

    return role.version;
  }
}
