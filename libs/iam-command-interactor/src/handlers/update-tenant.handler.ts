import {
  ICommandHandler,
  IAggregateRepository,
  IUnitOfWork,
} from '@ecoma-io/interactor';
import { TenantAggregate } from '@ecoma-io/iam-domain';
import { DomainException } from '@ecoma-io/domain';
import { UpdateTenantCommand } from '../commands/update-tenant.command';

export class UpdateTenantHandler
  implements ICommandHandler<UpdateTenantCommand, number>
{
  constructor(
    private readonly tenantRepository: IAggregateRepository<TenantAggregate>,
    private readonly unitOfWork: IUnitOfWork
  ) {}

  async handle(command: UpdateTenantCommand): Promise<number> {
    const { tenantId, name, metadata } = command;

    // Load tenant aggregate
    const tenant = await this.tenantRepository.load(tenantId);
    if (!tenant) {
      throw new DomainException(`Tenant with id ${tenantId} not found`);
    }

    // Execute business logic
    tenant.updateTenant(name, metadata);

    // Get uncommitted events and current version
    const events = Array.from(tenant.uncommittedEvents);
    const currentVersion = tenant.version;

    // Commit via unit of work
    const streamVersion = await this.unitOfWork.commit(
      tenantId,
      events,
      currentVersion + 1 // UnitOfWork subtracts 1
    );

    // Clear uncommitted events
    tenant.clearUncommittedEvents();

    return streamVersion;
  }
}
