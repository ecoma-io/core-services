import {
  ICommandHandler,
  IAggregateRepository,
  IUnitOfWork,
} from '@ecoma-io/interactor';
import { RoleAggregate, DomainException, RoleName } from '@ecoma-io/iam-domain';
import { UpdateRoleCommand } from '../commands/update-role.command';

export class UpdateRoleHandler
  implements ICommandHandler<UpdateRoleCommand, number>
{
  constructor(
    private readonly roleRepository: IAggregateRepository<RoleAggregate>,
    private readonly unitOfWork: IUnitOfWork
  ) {}

  async handle(command: UpdateRoleCommand): Promise<number> {
    const { roleId, name, description } = command;

    // Load role aggregate
    const role = await this.roleRepository.findById(roleId);
    if (!role) {
      throw new DomainException(`Role with id ${roleId} not found`);
    }

    // Create value object if name is provided
    const roleNameVO = name ? RoleName.create(name) : undefined;

    // Execute business logic
    role.updateRole(roleNameVO, description);

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
