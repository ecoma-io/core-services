import {
  ICommandHandler,
  IAggregateRepository,
  IUnitOfWork,
} from '@ecoma-io/interactor';
import { RoleAggregate, RoleName, PermissionKey } from '@ecoma-io/iam-domain';
import { CreateRoleCommand } from '../commands/create-role.command';

export class CreateRoleHandler
  implements ICommandHandler<CreateRoleCommand, number>
{
  constructor(
    private readonly roleRepository: IAggregateRepository<RoleAggregate>,
    private readonly unitOfWork: IUnitOfWork
  ) {}

  async handle(command: CreateRoleCommand): Promise<number> {
    const { roleId, tenantId, name, description, permissionKeys } = command;

    // Create value objects
    const roleNameVO = RoleName.create(name);
    const permissionKeyVOs = permissionKeys.map((key) =>
      PermissionKey.create(key)
    );

    // Create new role aggregate
    const role = new RoleAggregate();
    role.createRole(
      roleId,
      tenantId,
      roleNameVO,
      description,
      permissionKeyVOs
    );

    // Get uncommitted events
    const events = role.getUncommittedEvents();

    // Commit via unit of work
    const streamVersion = await this.unitOfWork.commit(
      roleId,
      events,
      -1 // Expected version -1 means stream should not exist
    );

    // Clear uncommitted events
    role.clearUncommittedEvents();

    return streamVersion;
  }
}
