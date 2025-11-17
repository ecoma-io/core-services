import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MembershipEntity } from '../entities/membership.entity';

/**
 * Membership Read Repository using TypeORM.
 *
 * @see ADR-2: PostgreSQL for Read Model
 */
@Injectable()
export class MembershipReadRepository {
  constructor(
    @InjectRepository(MembershipEntity)
    private readonly repo: Repository<MembershipEntity>
  ) {}

  /**
   * Find membership by ID.
   */
  async findById(membershipId: string): Promise<MembershipEntity | null> {
    return this.repo.findOne({
      where: { membershipId },
      relations: ['user', 'tenant'],
    });
  }

  /**
   * Find membership by user and tenant.
   */
  async findByUserAndTenant(
    userId: string,
    tenantId: string
  ): Promise<MembershipEntity | null> {
    return this.repo.findOne({ where: { userId, tenantId } });
  }

  /**
   * Find all memberships for a user.
   */
  async findByUserId(userId: string): Promise<MembershipEntity[]> {
    return this.repo.find({
      where: { userId },
      relations: ['tenant'],
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Find all memberships for a tenant.
   */
  async findByTenantId(tenantId: string): Promise<MembershipEntity[]> {
    return this.repo.find({
      where: { tenantId },
      relations: ['user'],
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Save or update membership read model.
   */
  async save(membership: MembershipEntity): Promise<void> {
    await this.repo.save(membership);
  }

  /**
   * Delete membership read model.
   */
  async delete(membershipId: string): Promise<void> {
    await this.repo.delete({ membershipId });
  }

  /**
   * Find all memberships that have a specific role assigned.
   * Used for cache invalidation when role permissions change.
   *
   * @param roleId - Role ID to search for
   * @returns Array of memberships containing this role
   */
  async findByRoleId(roleId: string): Promise<MembershipEntity[]> {
    return this.repo
      .createQueryBuilder('membership')
      .where(':roleId = ANY(membership.roleIds)', { roleId })
      .getMany();
  }
}
