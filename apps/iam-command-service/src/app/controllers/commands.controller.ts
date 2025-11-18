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
import {
  RegisterUserDto,
  CreateTenantDto,
  CreateRoleDto,
  CreateMembershipDto,
  RegisterServiceVersionDto,
  UpdateTenantDto,
  UpdateRoleDto,
  ChangePasswordDto,
  UpdateUserProfileDto,
  ActivateUserDto,
  SuspendUserDto,
  LinkSocialAccountDto,
  AssignRoleToMembershipDto,
  RemoveRoleFromMembershipDto,
  RegisterServiceDto,
  PublishServiceVersionDto,
  AssignPermissionsDto,
} from '../dtos';
import {
  RegisterUserHandler,
  makeRegisterUserCommand,
  CreateTenantHandler,
  makeCreateTenantCommand,
  CreateRoleHandler,
  makeCreateRoleCommand,
  CreateMembershipHandler,
  makeCreateMembershipCommand,
  RegisterServiceVersionHandler,
  makeRegisterServiceVersionCommand,
  UpdateTenantHandler,
  makeUpdateTenantCommand,
  UpdateRoleHandler,
  makeUpdateRoleCommand,
  ChangeUserPasswordHandler,
  makeChangeUserPasswordCommand,
  UpdateUserProfileHandler,
  makeUpdateUserProfileCommand,
  ActivateUserHandler,
  makeActivateUserCommand,
  SuspendUserHandler,
  makeSuspendUserCommand,
  LinkSocialAccountHandler,
  makeLinkSocialAccountCommand,
  AssignRoleToMembershipHandler,
  makeAssignRoleToMembershipCommand,
  RemoveRoleFromMembershipHandler,
  makeRemoveRoleFromMembershipCommand,
  RegisterServiceHandler,
  makeRegisterServiceCommand,
  PublishServiceVersionHandler,
  makePublishServiceVersionCommand,
  AssignPermissionsHandler,
  makeAssignPermissionsCommand,
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
    private readonly registerServiceVersionHandler: RegisterServiceVersionHandler,
    private readonly updateTenantHandler: UpdateTenantHandler,
    private readonly updateRoleHandler: UpdateRoleHandler,
    private readonly changeUserPasswordHandler: ChangeUserPasswordHandler,
    private readonly updateUserProfileHandler: UpdateUserProfileHandler,
    private readonly activateUserHandler: ActivateUserHandler,
    private readonly suspendUserHandler: SuspendUserHandler,
    private readonly linkSocialAccountHandler: LinkSocialAccountHandler,
    private readonly assignRoleToMembershipHandler: AssignRoleToMembershipHandler,
    private readonly removeRoleFromMembershipHandler: RemoveRoleFromMembershipHandler,
    private readonly registerServiceHandler: RegisterServiceHandler,
    private readonly publishServiceVersionHandler: PublishServiceVersionHandler,
    private readonly assignPermissionsHandler: AssignPermissionsHandler
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

  /**
   * Update an existing tenant
   * POST /commands/update-tenant
   */
  @Post('update-tenant')
  @HttpCode(HttpStatus.ACCEPTED)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async updateTenant(@Body() body: UpdateTenantDto) {
    const command = makeUpdateTenantCommand({
      tenantId: body.tenantId,
      name: body.name,
      metadata: body.metadata,
    });
    Logger.debug(`UpdateTenant start: ${body.tenantId}`);
    try {
      const streamVersion = await this.updateTenantHandler.handle(command);
      Logger.debug(`UpdateTenant done: ${body.tenantId} v${streamVersion}`);
      return { tenantId: body.tenantId, streamVersion };
    } catch (err) {
      Logger.error(`UpdateTenant failed: ${body.tenantId}`);
      throw err;
    }
  }

  /**
   * Update an existing role
   * POST /commands/update-role
   */
  @Post('update-role')
  @HttpCode(HttpStatus.ACCEPTED)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async updateRole(@Body() body: UpdateRoleDto) {
    const command = makeUpdateRoleCommand({
      roleId: body.roleId,
      name: body.name,
      description: body.description,
    });
    Logger.debug(`UpdateRole start: ${body.roleId}`);
    try {
      const streamVersion = await this.updateRoleHandler.handle(command);
      Logger.debug(`UpdateRole done: ${body.roleId} v${streamVersion}`);
      return { roleId: body.roleId, streamVersion };
    } catch (err) {
      Logger.error(`UpdateRole failed: ${body.roleId}`);
      throw err;
    }
  }

  /**
   * Change user password
   * POST /commands/change-password
   */
  @Post('change-password')
  @HttpCode(HttpStatus.ACCEPTED)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async changePassword(@Body() body: ChangePasswordDto) {
    const command = makeChangeUserPasswordCommand({
      userId: body.userId,
      newPassword: body.newPassword,
    });
    Logger.debug(`ChangePassword start: ${body.userId}`);
    try {
      const streamVersion =
        await this.changeUserPasswordHandler.handle(command);
      Logger.debug(`ChangePassword done: ${body.userId} v${streamVersion}`);
      return { userId: body.userId, streamVersion };
    } catch (err) {
      Logger.error(`ChangePassword failed: ${body.userId}`);
      throw err;
    }
  }

  /**
   * Update user profile
   * POST /commands/update-user-profile
   */
  @Post('update-user-profile')
  @HttpCode(HttpStatus.ACCEPTED)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async updateUserProfile(@Body() body: UpdateUserProfileDto) {
    const command = makeUpdateUserProfileCommand({
      userId: body.userId,
      firstName: body.firstName,
      lastName: body.lastName,
      avatarUrl: body.avatarUrl,
    });
    Logger.debug(`UpdateUserProfile start: ${body.userId}`);
    try {
      const streamVersion = await this.updateUserProfileHandler.handle(command);
      Logger.debug(`UpdateUserProfile done: ${body.userId} v${streamVersion}`);
      return { userId: body.userId, streamVersion };
    } catch (err) {
      Logger.error(`UpdateUserProfile failed: ${body.userId}`);
      throw err;
    }
  }

  /**
   * Activate a user
   * POST /commands/activate-user
   */
  @Post('activate-user')
  @HttpCode(HttpStatus.ACCEPTED)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async activateUser(@Body() body: ActivateUserDto) {
    const command = makeActivateUserCommand({
      userId: body.userId,
    });
    Logger.debug(`ActivateUser start: ${body.userId}`);
    try {
      const streamVersion = await this.activateUserHandler.handle(command);
      Logger.debug(`ActivateUser done: ${body.userId} v${streamVersion}`);
      return { userId: body.userId, streamVersion };
    } catch (err) {
      Logger.error(`ActivateUser failed: ${body.userId}`);
      throw err;
    }
  }

  /**
   * Suspend a user
   * POST /commands/suspend-user
   */
  @Post('suspend-user')
  @HttpCode(HttpStatus.ACCEPTED)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async suspendUser(@Body() body: SuspendUserDto) {
    const command = makeSuspendUserCommand({
      userId: body.userId,
    });
    Logger.debug(`SuspendUser start: ${body.userId}`);
    try {
      const streamVersion = await this.suspendUserHandler.handle(command);
      Logger.debug(`SuspendUser done: ${body.userId} v${streamVersion}`);
      return { userId: body.userId, streamVersion };
    } catch (err) {
      Logger.error(`SuspendUser failed: ${body.userId}`);
      throw err;
    }
  }

  /**
   * Link social account to user
   * POST /commands/link-social-account
   */
  @Post('link-social-account')
  @HttpCode(HttpStatus.ACCEPTED)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async linkSocialAccount(@Body() body: LinkSocialAccountDto) {
    const command = makeLinkSocialAccountCommand({
      userId: body.userId,
      provider: body.provider,
      providerId: body.providerId,
      providerEmail: body.providerEmail,
    });
    Logger.debug(`LinkSocialAccount start: ${body.userId} (${body.provider})`);
    try {
      const streamVersion = await this.linkSocialAccountHandler.handle(command);
      Logger.debug(`LinkSocialAccount done: ${body.userId} v${streamVersion}`);
      return { userId: body.userId, streamVersion };
    } catch (err) {
      Logger.error(
        `LinkSocialAccount failed: ${body.userId} (${body.provider})`
      );
      throw err;
    }
  }

  /**
   * Assign role to membership
   * POST /commands/assign-role-to-membership
   */
  @Post('assign-role-to-membership')
  @HttpCode(HttpStatus.ACCEPTED)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async assignRoleToMembership(@Body() body: AssignRoleToMembershipDto) {
    const command = makeAssignRoleToMembershipCommand({
      membershipId: body.membershipId,
      roleId: body.roleId,
    });
    Logger.debug(
      `AssignRoleToMembership start: ${body.membershipId} <- ${body.roleId}`
    );
    try {
      const streamVersion =
        await this.assignRoleToMembershipHandler.handle(command);
      Logger.debug(
        `AssignRoleToMembership done: ${body.membershipId} v${streamVersion}`
      );
      return { membershipId: body.membershipId, streamVersion };
    } catch (err) {
      Logger.error(
        `AssignRoleToMembership failed: ${body.membershipId} <- ${body.roleId}`
      );
      throw err;
    }
  }

  /**
   * Remove role from membership
   * POST /commands/remove-role-from-membership
   */
  @Post('remove-role-from-membership')
  @HttpCode(HttpStatus.ACCEPTED)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async removeRoleFromMembership(@Body() body: RemoveRoleFromMembershipDto) {
    const command = makeRemoveRoleFromMembershipCommand({
      membershipId: body.membershipId,
      roleId: body.roleId,
    });
    Logger.debug(
      `RemoveRoleFromMembership start: ${body.membershipId} -x- ${body.roleId}`
    );
    try {
      const streamVersion =
        await this.removeRoleFromMembershipHandler.handle(command);
      Logger.debug(
        `RemoveRoleFromMembership done: ${body.membershipId} v${streamVersion}`
      );
      return { membershipId: body.membershipId, streamVersion };
    } catch (err) {
      Logger.error(
        `RemoveRoleFromMembership failed: ${body.membershipId} -x- ${body.roleId}`
      );
      throw err;
    }
  }

  /**
   * Register a new service (initial registration)
   * POST /commands/register-service
   */
  @Post('register-service')
  @HttpCode(HttpStatus.ACCEPTED)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async registerService(@Body() body: RegisterServiceDto) {
    const command = makeRegisterServiceCommand({
      serviceId: body.serviceId,
      name: body.name,
      version: body.version,
      permissionsTree: body.permissionsTree,
    });
    Logger.debug(`RegisterService start: ${body.serviceId} v${body.version}`);
    try {
      const streamVersion = await this.registerServiceHandler.handle(command);
      Logger.debug(
        `RegisterService done: ${body.serviceId} v${body.version} stream@${streamVersion}`
      );
      return {
        serviceId: body.serviceId,
        version: body.version,
        streamVersion,
      };
    } catch (err) {
      Logger.error(
        `RegisterService failed: ${body.serviceId} v${body.version}`
      );
      throw err;
    }
  }

  /**
   * Publish a service version
   * POST /commands/publish-service-version
   */
  @Post('publish-service-version')
  @HttpCode(HttpStatus.ACCEPTED)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async publishServiceVersion(@Body() body: PublishServiceVersionDto) {
    const command = makePublishServiceVersionCommand({
      serviceId: body.serviceId,
      version: body.version,
      permissionsTree: body.permissionsTree,
    });
    Logger.debug(
      `PublishServiceVersion start: ${body.serviceId} v${body.version}`
    );
    try {
      const streamVersion =
        await this.publishServiceVersionHandler.handle(command);
      Logger.debug(
        `PublishServiceVersion done: ${body.serviceId} v${body.version} stream@${streamVersion}`
      );
      return {
        serviceId: body.serviceId,
        version: body.version,
        streamVersion,
      };
    } catch (err) {
      Logger.error(
        `PublishServiceVersion failed: ${body.serviceId} v${body.version}`
      );
      throw err;
    }
  }

  /**
   * Assign permissions to a role
   * POST /commands/assign-permissions
   */
  @Post('assign-permissions')
  @HttpCode(HttpStatus.ACCEPTED)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async assignPermissions(@Body() body: AssignPermissionsDto) {
    const command = makeAssignPermissionsCommand({
      roleId: body.roleId,
      permissionKeys: body.permissions,
    });
    Logger.debug(
      `AssignPermissions start: ${body.roleId} (${body.permissions.length} permissions)`
    );
    try {
      const streamVersion = await this.assignPermissionsHandler.handle(command);
      Logger.debug(`AssignPermissions done: ${body.roleId} v${streamVersion}`);
      return { roleId: body.roleId, streamVersion };
    } catch (err) {
      Logger.error(`AssignPermissions failed: ${body.roleId}`);
      throw err;
    }
  }
}
