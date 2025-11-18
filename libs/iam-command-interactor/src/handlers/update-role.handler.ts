import {
  ICommandHandler,
  IAggregateRepository,
  IUnitOfWork,
} from '@ecoma-io/interactor';
import { RoleAggregate } from '@ecoma-io/iam-domain';
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
    const { roleId, name, description } = command;

    // Load role aggregate
    const role = await this.roleRepository.load(roleId);
    if (!role) {
      throw new DomainException(`Role with id ${roleId} not found`);
    }

    // Execute business logic
    role.updateRole(name, description);

    // Get uncommitted events and current version
    const events = Array.from(role.uncommittedEvents);
    const currentVersion = role.version;

    // Commit via unit of work
    const streamVersion = await this.unitOfWork.commit(
      roleId,
      events,
      currentVersion + 1 // UnitOfWork subtracts 1
    );

    // Clear uncommitted events
    role.clearUncommittedEvents();

    return streamVersion;
  }
}
