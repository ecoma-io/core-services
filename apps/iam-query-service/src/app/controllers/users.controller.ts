import { Controller, Get, Param } from '@nestjs/common';
import { NotFoundException } from '@ecoma-io/nestjs-exceptions';
import {
  GetUserHandler,
  makeGetUserQuery,
} from '@ecoma-io/iam-query-interactor';

/**
 * Users Query Controller
 *
 * Provides read-only endpoints for querying user data from read models.
 */
@Controller('users')
export class UsersController {
  constructor(private readonly getUserHandler: GetUserHandler) {}

  /**
   * Get user by ID
   * GET /users/:id
   *
   * @param id - User ID (UUID)
   * @returns User entity from read model
   * @throws NotFoundException if user does not exist
   */
  @Get(':id')
  async getUser(@Param('id') id: string) {
    const query = makeGetUserQuery(id);
    const user = await this.getUserHandler.execute(query);

    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }

    return user;
  }
}
