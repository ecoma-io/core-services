import { Controller, Get, Param } from '@nestjs/common';
import { NotFoundException } from '@ecoma-io/nestjs-exceptions';
import {
  GetRoleHandler,
  makeGetRoleQuery,
} from '@ecoma-io/iam-query-interactor';

/**
 * Roles Query Controller
 *
 * Provides read-only endpoints for querying role data from read models.
 */
@Controller('roles')
export class RolesController {
  constructor(private readonly getRoleHandler: GetRoleHandler) {}

  /**
   * Get role by ID
   * GET /roles/:id
   *
   * @param id - Role ID (UUID)
   * @returns Role entity from read model
   * @throws NotFoundException if role does not exist
   */
  @Get(':id')
  async getRole(@Param('id') id: string) {
    const query = makeGetRoleQuery(id);
    const role = await this.getRoleHandler.execute(query);

    if (!role) {
      throw new NotFoundException(`Role ${id} not found`);
    }

    return role;
  }
}
