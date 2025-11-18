import {
  ICommandHandler,
  IAggregateRepository,
  IUnitOfWork,
} from '@ecoma-io/interactor';
import { ServiceDefinitionAggregate, ServiceName } from '@ecoma-io/iam-domain';
import { RegisterServiceCommand } from '../commands/register-service.command';

export class RegisterServiceHandler
  implements ICommandHandler<RegisterServiceCommand, number>
{
  constructor(
    private readonly serviceRepository: IAggregateRepository<ServiceDefinitionAggregate>,
    private readonly unitOfWork: IUnitOfWork
  ) {}

  async handle(command: RegisterServiceCommand): Promise<number> {
    const { serviceId, version, permissionsTree, name } = command;

    // Create new service aggregate
    const service = new ServiceDefinitionAggregate();
    service.registerVersion(serviceId, version, permissionsTree, name);

    // Get uncommitted events
    const events = Array.from(service.uncommittedEvents);

    // Commit via unit of work (new stream, expectedVersion = -1)
    const streamVersion = await this.unitOfWork.commit(
      serviceId,
      events,
      -1
    );

    // Clear uncommitted events
    service.clearUncommittedEvents();

    return streamVersion;
  }
}
