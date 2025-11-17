import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ServiceDefinitionEntity } from '../entities/service-definition.entity';

/**
 * ServiceDefinition Read Repository using TypeORM.
 *
 * @see ADR-5: Permission Merge Rules
 */
@Injectable()
export class ServiceDefinitionReadRepository {
  constructor(
    @InjectRepository(ServiceDefinitionEntity)
    private readonly repo: Repository<ServiceDefinitionEntity>
  ) {}

  /**
   * Find service definition by ID.
   */
  async findById(serviceId: string): Promise<ServiceDefinitionEntity | null> {
    return this.repo.findOne({ where: { serviceId } });
  }

  /**
   * Find service definition by name.
   */
  async findByName(name: string): Promise<ServiceDefinitionEntity | null> {
    return this.repo.findOne({ where: { name } });
  }

  /**
   * Save or update service definition read model.
   */
  async save(service: ServiceDefinitionEntity): Promise<void> {
    await this.repo.save(service);
  }

  /**
   * Delete service definition read model.
   */
  async delete(serviceId: string): Promise<void> {
    await this.repo.delete({ serviceId });
  }

  /**
   * Find all service definitions.
   */
  async findAll(): Promise<ServiceDefinitionEntity[]> {
    return this.repo.find({ order: { createdAt: 'ASC' } });
  }
}
