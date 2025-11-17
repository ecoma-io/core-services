import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../entities/user.entity';

/**
 * User Read Repository using TypeORM.
 *
 * @see ADR-2: PostgreSQL for Read Model
 */
@Injectable()
export class UserReadRepository {
  constructor(
    @InjectRepository(UserEntity)
    private readonly repo: Repository<UserEntity>
  ) {}

  /**
   * Find user by ID.
   */
  async findById(userId: string): Promise<UserEntity | null> {
    return this.repo.findOne({ where: { userId } });
  }

  /**
   * Find user by email.
   */
  async findByEmail(email: string): Promise<UserEntity | null> {
    return this.repo.findOne({ where: { email } });
  }

  /**
   * Find users by status.
   */
  async findByStatus(
    status: 'Active' | 'Suspended' | 'PendingVerification'
  ): Promise<UserEntity[]> {
    return this.repo.find({ where: { status } });
  }

  /**
   * Find user by social provider.
   */
  async findBySocialProvider(
    provider: string,
    providerId: string
  ): Promise<UserEntity | null> {
    return this.repo
      .createQueryBuilder('user')
      .where('user.social_links @> :link::jsonb', {
        link: JSON.stringify([{ provider, providerId }]),
      })
      .getOne();
  }

  /**
   * Save or update user read model.
   */
  async save(user: UserEntity): Promise<void> {
    await this.repo.save(user);
  }

  /**
   * Delete user read model.
   */
  async delete(userId: string): Promise<void> {
    await this.repo.delete({ userId });
  }

  /**
   * Find users with pagination.
   */
  async findAll(options: {
    skip?: number;
    take?: number;
  }): Promise<{ users: UserEntity[]; total: number }> {
    const [users, total] = await this.repo.findAndCount({
      skip: options.skip,
      take: options.take,
      order: { createdAt: 'DESC' },
    });
    return { users, total };
  }
}
