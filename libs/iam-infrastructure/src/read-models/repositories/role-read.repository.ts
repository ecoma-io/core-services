import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoleEntity } from '../entities/role.entity';

/**
 * Role Read Repository using TypeORM.
 *
 * @see ADR-2: PostgreSQL for Read Model
 */
@Injectable()
export class RoleReadRepository {
  constructor(
    @InjectRepository(RoleEntity)
    private readonly repo: Repository<RoleEntity>
  ) {}

  /**
   * Find role by ID.
   */
  async findById(roleId: string): Promise<RoleEntity | null> {
    return this.repo.findOne({ where: { roleId }, relations: ['tenant'] });
  }

  /**
   * Find all roles in a tenant.
   */
  async findByTenantId(tenantId: string): Promise<RoleEntity[]> {
    return this.repo.find({
      where: { tenantId },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Find role by name within tenant.
   */
  async findByTenantAndName(
    tenantId: string,
    name: string
  ): Promise<RoleEntity | null> {
    return this.repo.findOne({ where: { tenantId, name } });
  }

  /**
   * Find roles by IDs (bulk query).
   */
  async findByIds(roleIds: string[]): Promise<RoleEntity[]> {
    return this.repo.createQueryBuilder('role').whereInIds(roleIds).getMany();
  }

  /**
   * Save or update role read model.
   */
  async save(role: RoleEntity): Promise<void> {
    await this.repo.save(role);
  }

  /**
   * Delete role read model.
   */
  async delete(roleId: string): Promise<void> {
    await this.repo.delete({ roleId });
  }
}
