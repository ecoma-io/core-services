/**
 * GetServiceDefinition Query
 *
 * Fetches service definition by ID from read model.
 */
export interface GetServiceDefinitionQuery {
  serviceId: string;
}

/**
 * Factory function to create GetServiceDefinitionQuery.
 */
export function makeGetServiceDefinitionQuery(
  serviceId: string
): GetServiceDefinitionQuery {
  return { serviceId };
}
