import {
  ICommandHandler,
  IAggregateRepository,
  IUnitOfWork,
} from '@ecoma-io/interactor';
import { ServiceDefinitionAggregate } from '@ecoma-io/iam-domain';
import { RegisterServiceVersionCommand } from '../commands/register-service-version.command';

/**
 * RegisterServiceVersionHandler - Handles RegisterServiceVersionCommand.
 *
 * Creates or updates service definition aggregate with new version.
 * Follows UnitOfWork pattern for event publishing to RabbitMQ.
 */
export class RegisterServiceVersionHandler
  implements ICommandHandler<RegisterServiceVersionCommand, number>
{
  constructor(
    private readonly serviceRepository: IAggregateRepository<ServiceDefinitionAggregate>,
    private readonly unitOfWork: IUnitOfWork
  ) {}

  /**
   * Handle RegisterServiceVersionCommand.
   *
   * Strategy:
   * 1. Load or create service definition aggregate
   * 2. Register new version with permissions tree
   * 3. Commit via UnitOfWork (saves to EventStoreDB + publishes to RabbitMQ)
   *
   * @param command - RegisterServiceVersionCommand
   * @returns Stream version after commit
   */
  async handle(command: RegisterServiceVersionCommand): Promise<number> {
    const { serviceId, version, permissionsTree, name } = command;

    // Load existing aggregate or create new one
    let service: ServiceDefinitionAggregate;
    let expectedVersion = -1; // -1 means "stream must not exist"

    try {
      service = await this.serviceRepository.load(serviceId);
      // Stream exists, expectedVersion should be current event count
      // aggregate.version is 0-based position, so we need to pass version + 1
      // for UnitOfWork to subtract 1 and get back to the position
      expectedVersion = service.version + 1;
    } catch {
      // Aggregate doesn't exist, create new
      service = new ServiceDefinitionAggregate(serviceId);
      expectedVersion = -1;
    }

    // Register new version
    service.registerVersion(serviceId, version, permissionsTree, name);

    // Get uncommitted events
    const events = Array.from(service.uncommittedEvents);

    // Commit via unit of work (publishes to RabbitMQ)
    const streamVersion = await this.unitOfWork.commit(
      serviceId,
      events,
      expectedVersion
    );

    // Clear uncommitted events
    service.clearUncommittedEvents();

    return streamVersion;
  }
}
