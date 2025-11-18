import {
  Controller,
  Get,
  Param,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  GetServiceDefinitionHandler,
  makeGetServiceDefinitionQuery,
} from '@ecoma-io/iam-query-interactor';
import { NotFoundException } from '@ecoma-io/nestjs-exceptions';

/**
 * ServiceDefinitionsController - Query endpoints for service definitions.
 *
 * Handles read-side operations for service definitions with permission trees.
 */
@Controller('service-definitions')
export class ServiceDefinitionsController {
  private readonly logger = new Logger(ServiceDefinitionsController.name);

  constructor(
    private readonly getServiceDefinitionHandler: GetServiceDefinitionHandler
  ) {}

  /**
   * GET /service-definitions/:id
   *
   * Fetch service definition by ID with merged permission trees from top 3 major versions.
   *
   * @param id - Service ID (UUID)
   * @returns ServiceDefinitionEntity with versions array
   * @throws NotFoundException if service not found
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getServiceDefinition(@Param('id') id: string) {
    const query = makeGetServiceDefinitionQuery(id);
    const service = await this.getServiceDefinitionHandler.execute(query);

    if (!service) {
      throw new NotFoundException(`ServiceDefinition ${id} not found`);
    }

    return service;
  }
}
