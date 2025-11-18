/**
 * RegisterServiceVersion Command
 *
 * Registers a new version of a service with its permissions tree.
 */
export interface RegisterServiceVersionCommand {
  serviceId: string;
  version: string;
  name: string;
  permissionsTree: Record<string, unknown>;
}

/**
 * Factory function to create RegisterServiceVersionCommand.
 */
export function makeRegisterServiceVersionCommand(params: {
  serviceId: string;
  version: string;
  name: string;
  permissionsTree: Record<string, unknown>;
}): RegisterServiceVersionCommand {
  return {
    serviceId: params.serviceId,
    version: params.version,
    name: params.name,
    permissionsTree: params.permissionsTree,
  };
}
