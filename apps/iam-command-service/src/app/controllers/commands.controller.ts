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
import { CreateRoleDto } from '../dtos/create-role.dto';
import {
  CreateRoleHandler,
  makeCreateRoleCommand,
} from '@ecoma-io/iam-command-interactor';
import { CreateMembershipDto } from '../dtos/create-membership.dto';
import {
  CreateMembershipHandler,
  makeCreateMembershipCommand,
} from '@ecoma-io/iam-command-interactor';
import { RegisterServiceVersionDto } from '../dtos/register-service-version.dto';
import {
  RegisterServiceVersionHandler,
  makeRegisterServiceVersionCommand,
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
    private readonly createTenantHandler: CreateTenantHandler,
    private readonly createRoleHandler: CreateRoleHandler,
    private readonly createMembershipHandler: CreateMembershipHandler,
    private readonly registerServiceVersionHandler: RegisterServiceVersionHandler
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

  /**
   * Create a new role
   * POST /commands/create-role
   */
  @Post('create-role')
  @HttpCode(HttpStatus.ACCEPTED)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async createRole(@Body() body: CreateRoleDto) {
    const roleId = uuidv4();
    const command = makeCreateRoleCommand({
      roleId,
      tenantId: body.tenantId,
      name: body.name,
      permissionKeys: body.permissionKeys,
      description: body.description,
    });
    Logger.debug(`CreateRole start: ${roleId}`);
    try {
      const streamVersion = await this.createRoleHandler.handle(command);
      Logger.debug(`CreateRole done: ${roleId} v${streamVersion}`);
      return { roleId, streamVersion };
    } catch (err) {
      Logger.error(`CreateRole failed: ${roleId}`);
      throw err;
    }
  }

  /**
   * Create a new membership (link user to tenant)
   * POST /commands/create-membership
   */
  @Post('create-membership')
  @HttpCode(HttpStatus.ACCEPTED)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async createMembership(@Body() body: CreateMembershipDto) {
    const command = makeCreateMembershipCommand({
      membershipId: body.membershipId,
      userId: body.userId,
      tenantId: body.tenantId,
    });
    Logger.debug(`CreateMembership start: ${body.membershipId}`);
    try {
      const result = await this.createMembershipHandler.handle(command);
      Logger.debug(
        `CreateMembership done: ${body.membershipId} v${result.streamVersion}`
      );
      return {
        membershipId: body.membershipId,
        streamVersion: result.streamVersion,
      };
    } catch (err) {
      Logger.error(`CreateMembership failed: ${body.membershipId}`);
      throw err;
    }
  }

  /**
   * Register a new service version
   * POST /commands/register-service-version
   */
  @Post('register-service-version')
  @HttpCode(HttpStatus.ACCEPTED)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async registerServiceVersion(@Body() body: RegisterServiceVersionDto) {
    const command = makeRegisterServiceVersionCommand({
      serviceId: body.serviceId,
      version: body.version,
      name: body.name,
      permissionsTree: body.permissionsTree,
    });
    Logger.debug(
      `RegisterServiceVersion start: ${body.serviceId} v${body.version}`
    );
    try {
      const streamVersion =
        await this.registerServiceVersionHandler.handle(command);
      Logger.debug(
        `RegisterServiceVersion done: ${body.serviceId} v${body.version} stream@${streamVersion}`
      );
      return {
        serviceId: body.serviceId,
        version: body.version,
        streamVersion,
      };
    } catch (err) {
      Logger.error(
        `RegisterServiceVersion failed: ${body.serviceId} v${body.version}`
      );
      throw err;
    }
  }
}
