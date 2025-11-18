import {
  ICommandHandler,
  IAggregateRepository,
  IUnitOfWork,
} from '@ecoma-io/interactor';
import { ServiceDefinitionAggregate } from '@ecoma-io/iam-domain';
import { DomainException } from '@ecoma-io/domain';
import { PublishServiceVersionCommand } from '../commands/publish-service-version.command';

export class PublishServiceVersionHandler
  implements ICommandHandler<PublishServiceVersionCommand, number>
{
  constructor(
    private readonly serviceRepository: IAggregateRepository<ServiceDefinitionAggregate>,
    private readonly unitOfWork: IUnitOfWork
  ) {}

  async handle(command: PublishServiceVersionCommand): Promise<number> {
    const { serviceId, version, permissionsTree } = command;

    // Load service aggregate
    const service = await this.serviceRepository.load(serviceId);
    if (!service) {
      throw new DomainException(`Service with id ${serviceId} not found`);
    }

    // TODO: Implement publishVersion() method in ServiceDefinitionAggregate
    // For now, use registerVersion
    service.registerVersion(serviceId, version, permissionsTree);

    // Get uncommitted events and current version
    const events = Array.from(service.uncommittedEvents);
    const currentVersion = service.version;

    // Commit via unit of work
    const streamVersion = await this.unitOfWork.commit(
      serviceId,
      events,
      currentVersion + 1 // UnitOfWork subtracts 1
    );

    // Clear uncommitted events
    service.clearUncommittedEvents();

    return streamVersion;
  }
}
