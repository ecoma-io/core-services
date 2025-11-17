import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UsePipes,
  ValidationPipe,
  Logger,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { RegisterUserDto } from '../dtos/register-user.dto';
import {
  RegisterUserHandler,
  makeRegisterUserCommand,
} from '@ecoma-io/iam-command-interactor';
import { CreateTenantDto } from '../dtos/create-tenant.dto';
import {
  CreateTenantHandler,
  makeCreateTenantCommand,
} from '@ecoma-io/iam-command-interactor';

/**
 * Commands Controller - Write Side Endpoints
 *
 * Example endpoint for command execution.
 * In MVP, this will call command handlers from @ecoma-io/iam-command-interactor
 */
@Controller('commands')
export class CommandsController {
  constructor(
    private readonly registerUserHandler: RegisterUserHandler,
    private readonly createTenantHandler: CreateTenantHandler
  ) {}
  /**
   * Example: Register a new user
   * POST /commands/register-user
   *
   * TODO: Wire to RegisterUserHandler from iam-command-interactor
   */
  @Post('register-user')
  @HttpCode(HttpStatus.ACCEPTED)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async registerUser(@Body() body: RegisterUserDto) {
    const userId = uuidv4();
    const command = makeRegisterUserCommand({
      userId,
      email: body.email,
      password: body.password,
      firstName: body.firstName,
      lastName: body.lastName,
    });
    const streamVersion = await this.registerUserHandler.handle(command);
    return { userId, streamVersion };
  }

  /**
   * Create a new tenant
   * POST /commands/create-tenant
   */
  @Post('create-tenant')
  @HttpCode(HttpStatus.ACCEPTED)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async createTenant(@Body() body: CreateTenantDto) {
    const tenantId = uuidv4();
    const command = makeCreateTenantCommand({
      tenantId,
      name: body.name,
      namespace: body.namespace,
      metadata: body.metadata,
    });
    Logger.debug(`CreateTenant start: ${tenantId}`);
    try {
      const streamVersion = await this.createTenantHandler.handle(command);
      Logger.debug(`CreateTenant done: ${tenantId} v${streamVersion}`);
      return { tenantId, streamVersion };
    } catch (err) {
      Logger.error(`CreateTenant failed: ${tenantId}`);
      throw err;
    }
  }
}
