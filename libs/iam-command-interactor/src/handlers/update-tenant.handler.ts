import {
  ICommandHandler,
  IAggregateRepository,
  IUnitOfWork,
} from '@ecoma-io/interactor';
import { TenantAggregate, DomainException } from '@ecoma-io/iam-domain';
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
    const tenant = await this.tenantRepository.findById(tenantId);
    if (!tenant) {
      throw new DomainException(`Tenant with id ${tenantId} not found`);
    }

    // Execute business logic
    tenant.updateTenant(name, metadata);

    // Get uncommitted events and current version
    const events = tenant.getUncommittedEvents();
    const currentVersion = tenant.version;

    // Commit via unit of work
    const streamVersion = await this.unitOfWork.commit(
      tenantId,
      events,
      currentVersion
    );

    // Clear uncommitted events
    tenant.clearUncommittedEvents();

    return streamVersion;
  }
}
