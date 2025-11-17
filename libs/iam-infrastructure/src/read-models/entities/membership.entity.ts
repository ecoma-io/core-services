import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { UserEntity } from './user.entity';
import { TenantEntity } from './tenant.entity';

/**
 * Membership Read Model Entity (User-Tenant linking).
 *
 * @see ADR-2: PostgreSQL for Read Model (Data)
 */
@Entity('memberships_read_model')
@Index(['userId', 'tenantId'], { unique: true })
@Index(['userId'])
@Index(['tenantId'])
export class MembershipEntity {
  @PrimaryColumn({ name: 'membership_id', type: 'uuid' })
  membershipId!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'role_ids', type: 'jsonb', default: '[]' })
  roleIds!: string[];

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'user_id' })
  user?: UserEntity;

  @ManyToOne(() => TenantEntity)
  @JoinColumn({ name: 'tenant_id' })
  tenant?: TenantEntity;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt!: Date;
}
