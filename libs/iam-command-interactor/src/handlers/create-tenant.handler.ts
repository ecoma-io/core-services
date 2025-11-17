import {
  ICommandHandler,
  IAggregateRepository,
  IUnitOfWork,
} from '@ecoma-io/interactor';
import { TenantAggregate } from '@ecoma-io/iam-domain';
import { NamespaceId } from '@ecoma-io/iam-domain';
import { CreateTenantCommand } from '../commands/create-tenant.command';

export class CreateTenantHandler
  implements ICommandHandler<CreateTenantCommand, number>
{
  constructor(
    private readonly tenantRepository: IAggregateRepository<TenantAggregate>,
    private readonly unitOfWork: IUnitOfWork
  ) {}

  async handle(command: CreateTenantCommand): Promise<number> {
    const { tenantId, name, namespace, metadata } = command;

    // Create namespace value object
    const namespaceVO = NamespaceId.create(namespace);

    // Create new tenant aggregate
    const tenant = new TenantAggregate();
    tenant.createTenant(tenantId, name, namespaceVO, metadata);

    // Get uncommitted events
    const events = tenant.getUncommittedEvents();

    // Commit via unit of work
    const streamVersion = await this.unitOfWork.commit(
      tenantId,
      events,
      -1 // Expected version -1 means stream should not exist
    );

    // Clear uncommitted events
    tenant.clearUncommittedEvents();

    return streamVersion;
  }
}
