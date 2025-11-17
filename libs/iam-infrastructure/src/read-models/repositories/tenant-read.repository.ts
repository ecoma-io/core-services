import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantEntity } from '../entities/tenant.entity';

/**
 * Tenant Read Repository using TypeORM.
 *
 * @see ADR-2: PostgreSQL for Read Model
 */
@Injectable()
export class TenantReadRepository {
  constructor(
    @InjectRepository(TenantEntity)
    private readonly repo: Repository<TenantEntity>
  ) {}

  /**
   * Find tenant by ID.
   */
  async findById(tenantId: string): Promise<TenantEntity | null> {
    return this.repo.findOne({ where: { tenantId } });
  }

  /**
   * Find tenant by namespace (unique identifier).
   */
  async findByNamespace(namespace: string): Promise<TenantEntity | null> {
    return this.repo.findOne({ where: { namespace } });
  }

  /**
   * Save or update tenant read model.
   */
  async save(tenant: TenantEntity): Promise<void> {
    await this.repo.save(tenant);
  }

  /**
   * Delete tenant read model.
   */
  async delete(tenantId: string): Promise<void> {
    await this.repo.delete({ tenantId });
  }

  /**
   * Find all tenants with pagination.
   */
  async findAll(options: {
    skip?: number;
    take?: number;
  }): Promise<{ tenants: TenantEntity[]; total: number }> {
    const [tenants, total] = await this.repo.findAndCount({
      skip: options.skip,
      take: options.take,
      order: { createdAt: 'DESC' },
    });
    return { tenants, total };
  }
}
