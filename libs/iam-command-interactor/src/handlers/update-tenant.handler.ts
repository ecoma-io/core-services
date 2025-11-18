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

    // TODO: Implement updateTenant() method in TenantAggregate
    // tenant.updateTenant(name, metadata);
    // For now, stub returns current version
    console.warn('[UpdateTenantHandler] Aggregate method not implemented yet');

    return tenant.version;
  }
}
