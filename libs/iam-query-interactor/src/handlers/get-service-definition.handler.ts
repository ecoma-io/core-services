import { ServiceDefinitionEntity } from '@ecoma-io/iam-infrastructure';
import { GetServiceDefinitionQuery } from '../queries/get-service-definition.query';

/**
 * GetServiceDefinitionHandler - Executes GetServiceDefinitionQuery.
 *
 * Fetches service definition from read model repository.
 */
export class GetServiceDefinitionHandler {
  constructor(
    private readonly serviceDefinitionRepository: {
      findById: (serviceId: string) => Promise<ServiceDefinitionEntity | null>;
    }
  ) {}

  /**
   * Execute query to get service definition by ID.
   *
   * @param query - GetServiceDefinitionQuery with serviceId
   * @returns ServiceDefinitionEntity or null if not found
   */
  async execute(
    query: GetServiceDefinitionQuery
  ): Promise<ServiceDefinitionEntity | null> {
    return this.serviceDefinitionRepository.findById(query.serviceId);
  }
}
