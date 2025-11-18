import { Controller, Get, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { NotFoundException } from '@ecoma-io/nestjs-exceptions';
import {
  GetTenantHandler,
  makeGetTenantQuery,
} from '@ecoma-io/iam-query-interactor';

/**
 * Tenants Query Controller - Read Side Endpoints
 *
 * Exposes REST API for querying tenant read models.
 *
 * @see docs/iam/architecture.md - Section 4.2 Read Side Flow
 */
@Controller('tenants')
export class TenantsController {
  constructor(private readonly getTenantHandler: GetTenantHandler) {}

  /**
   * Get tenant by ID
   * GET /tenants/:id
   *
   * @param id - Tenant UUID
   * @returns Tenant entity or 404
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getTenant(@Param('id') id: string) {
    const query = makeGetTenantQuery(id);
    const tenant = await this.getTenantHandler.execute(query);

    if (!tenant) {
      throw new NotFoundException(`Tenant ${id} not found`);
    }

    return {
      id: tenant.tenantId,
      name: tenant.name,
      namespace: tenant.namespace,
      metadata: tenant.metadata,
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
    };
  }
}
