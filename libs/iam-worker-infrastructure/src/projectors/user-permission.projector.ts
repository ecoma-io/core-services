import { Injectable, Logger } from '@nestjs/common';
import { UserPermissionService } from '@ecoma-io/iam-infrastructure';
import { MembershipReadRepository } from '@ecoma-io/iam-infrastructure';

/**
 * Event stubs (will be replaced with actual domain events later)
 */
interface RoleAssignedToUserEvent {
  membershipId: string;
  userId: string;
  tenantId: string;
  roleId: string;
}

interface RoleRemovedFromUserEvent {
  membershipId: string;
  userId: string;
  tenantId: string;
  roleId: string;
}

interface RolePermissionsChangedEvent {
  roleId: string;
  tenantId: string;
  oldPermissionKeys: string[];
  newPermissionKeys: string[];
}

/**
 * User Permission Projector
 * Listens to role assignment and role permission change events
 * Recalculates and caches user permissions when roles change
 *
 * **Events handled:**
 * - RoleAssignedToUser: User gains new role → recalculate permissions
 * - RoleRemovedFromUser: User loses role → recalculate permissions
 * - RolePermissionsChanged: Role's permissions updated → recalculate all users with this role
 *
 * @see docs/iam/architecture.md ADR-5 Stage 2
 */
@Injectable()
export class UserPermissionProjector {
  private readonly logger = new Logger(UserPermissionProjector.name);

  constructor(
    private readonly userPermissionService: UserPermissionService,
    private readonly membershipRepo: MembershipReadRepository
  ) {}

  /**
   * Handle RoleAssignedToUser event
   * Recalculate permissions for the affected user
   */
  async onRoleAssignedToUser(event: RoleAssignedToUserEvent): Promise<void> {
    this.logger.log(
      `Role ${event.roleId} assigned to user ${event.userId} in tenant ${event.tenantId}`
    );

    try {
      await this.userPermissionService.calculateAndCacheUserPermissions(
        event.userId,
        event.tenantId
      );

      this.logger.debug(
        `Recalculated permissions for user ${event.userId} in tenant ${event.tenantId}`
      );
    } catch (error) {
      this.logger.error(
        `Failed to recalculate permissions for user ${event.userId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Handle RoleRemovedFromUser event
   * Recalculate permissions for the affected user
   */
  async onRoleRemovedFromUser(event: RoleRemovedFromUserEvent): Promise<void> {
    this.logger.log(
      `Role ${event.roleId} removed from user ${event.userId} in tenant ${event.tenantId}`
    );

    try {
      await this.userPermissionService.calculateAndCacheUserPermissions(
        event.userId,
        event.tenantId
      );

      this.logger.debug(
        `Recalculated permissions for user ${event.userId} in tenant ${event.tenantId}`
      );
    } catch (error) {
      this.logger.error(
        `Failed to recalculate permissions for user ${event.userId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Handle RolePermissionsChanged event
   * Recalculate permissions for all users who have this role
   */
  async onRolePermissionsChanged(
    event: RolePermissionsChangedEvent
  ): Promise<void> {
    this.logger.log(
      `Role ${event.roleId} permissions changed in tenant ${event.tenantId}`
    );

    try {
      // Find all memberships with this role
      const memberships = await this.membershipRepo.findByRoleId(event.roleId);

      this.logger.debug(
        `Found ${memberships.length} users with role ${event.roleId}`
      );

      // Recalculate permissions for each affected user
      const promises = memberships.map((membership) =>
        this.userPermissionService.calculateAndCacheUserPermissions(
          membership.userId,
          membership.tenantId
        )
      );

      await Promise.all(promises);

      this.logger.log(
        `Recalculated permissions for ${memberships.length} users affected by role ${event.roleId} change`
      );
    } catch (error) {
      this.logger.error(
        `Failed to recalculate permissions for role ${event.roleId}:`,
        error
      );
      throw error;
    }
  }
}

/**
 * Event handler decorators (will be uncommented when actual events are available)
 */
// @EventsHandler(RoleAssignedToUserEvent)
// export class RoleAssignedToUserHandler
//   implements IEventHandler<RoleAssignedToUserEvent>
// {
//   constructor(private readonly projector: UserPermissionProjector) {}
//
//   async handle(event: RoleAssignedToUserEvent): Promise<void> {
//     await this.projector.onRoleAssignedToUser(event);
//   }
// }

// @EventsHandler(RoleRemovedFromUserEvent)
// export class RoleRemovedFromUserHandler
//   implements IEventHandler<RoleRemovedFromUserEvent>
// {
//   constructor(private readonly projector: UserPermissionProjector) {}
//
//   async handle(event: RoleRemovedFromUserEvent): Promise<void> {
//     await this.projector.onRoleRemovedFromUser(event);
//   }
// }

// @EventsHandler(RolePermissionsChangedEvent)
// export class RolePermissionsChangedHandler
//   implements IEventHandler<RolePermissionsChangedEvent>
// {
//   constructor(private readonly projector: UserPermissionProjector) {}
//
//   async handle(event: RolePermissionsChangedEvent): Promise<void> {
//     await this.projector.onRolePermissionsChanged(event);
//   }
// }
