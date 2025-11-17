import {
  ICommandHandler,
  IAggregateRepository,
  IUnitOfWork,
} from '@ecoma-io/interactor';
import {
  ServiceDefinitionAggregate,
  DomainException,
} from '@ecoma-io/iam-domain';
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
    const service = await this.serviceRepository.findById(serviceId);
    if (!service) {
      throw new DomainException(`Service with id ${serviceId} not found`);
    }

    // Execute business logic
    service.publishVersion(version, permissionsTree);

    // Get uncommitted events and current version
    const events = service.getUncommittedEvents();
    const currentVersion = service.version;

    // Commit via unit of work
    const streamVersion = await this.unitOfWork.commit(
      serviceId,
      events,
      currentVersion
    );

    // Clear uncommitted events
    service.clearUncommittedEvents();

    return streamVersion;
  }
}
