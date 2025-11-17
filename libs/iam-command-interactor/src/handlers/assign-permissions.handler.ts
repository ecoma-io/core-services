import {
  ICommandHandler,
  IAggregateRepository,
  IUnitOfWork,
} from '@ecoma-io/interactor';
import {
  RoleAggregate,
  DomainException,
  PermissionKey,
} from '@ecoma-io/iam-domain';
import { AssignPermissionsCommand } from '../commands/assign-permissions.command';

export class AssignPermissionsHandler
  implements ICommandHandler<AssignPermissionsCommand, number>
{
  constructor(
    private readonly roleRepository: IAggregateRepository<RoleAggregate>,
    private readonly unitOfWork: IUnitOfWork
  ) {}

  async handle(command: AssignPermissionsCommand): Promise<number> {
    const { roleId, permissionKeys } = command;

    // Load role aggregate
    const role = await this.roleRepository.findById(roleId);
    if (!role) {
      throw new DomainException(`Role with id ${roleId} not found`);
    }

    // Create value objects
    const permissionKeyVOs = permissionKeys.map((key) =>
      PermissionKey.create(key)
    );

    // Execute business logic
    role.assignPermissions(permissionKeyVOs);

    // Get uncommitted events and current version
    const events = role.getUncommittedEvents();
    const currentVersion = role.version;

    // Commit via unit of work
    const streamVersion = await this.unitOfWork.commit(
      roleId,
      events,
      currentVersion
    );

    // Clear uncommitted events
    role.clearUncommittedEvents();

    return streamVersion;
  }
}
