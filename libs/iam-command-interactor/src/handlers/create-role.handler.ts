import {
  ICommandHandler,
  IAggregateRepository,
  IUnitOfWork,
} from '@ecoma-io/interactor';
import { RoleAggregate } from '@ecoma-io/iam-domain';
import { CreateRoleCommand } from '../commands/create-role.command';

export class CreateRoleHandler
  implements ICommandHandler<CreateRoleCommand, number>
{
  constructor(
    private readonly roleRepository: IAggregateRepository<RoleAggregate>,
    private readonly unitOfWork: IUnitOfWork
  ) {}

  async handle(command: CreateRoleCommand): Promise<number> {
    const { roleId, tenantId, name, permissionKeys } = command;

    // Create new role aggregate
    const role = new RoleAggregate(roleId);
    role.create(roleId, tenantId, name, permissionKeys);

    // Get uncommitted events
    const events = Array.from(role.uncommittedEvents);

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
