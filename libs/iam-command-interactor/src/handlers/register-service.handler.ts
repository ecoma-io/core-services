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
    const { serviceId, name, permissionsTree, version } = command;

    // Create value object
    const serviceNameVO = ServiceName.create(name);

    // Create new service aggregate
    const service = new ServiceDefinitionAggregate();
    service.registerService(serviceId, serviceNameVO, permissionsTree, version);

    // Get uncommitted events
    const events = service.getUncommittedEvents();

    // Commit via unit of work
    const streamVersion = await this.unitOfWork.commit(
      serviceId,
      events,
      -1 // Expected version -1 means stream should not exist
    );

    // Clear uncommitted events
    service.clearUncommittedEvents();

    return streamVersion;
  }
}
