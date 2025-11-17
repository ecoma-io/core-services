import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * User Read Model Entity for PostgreSQL.
 * Denormalized view optimized for queries.
 *
 * @see ADR-2: PostgreSQL for Read Model (Data)
 */
@Entity('users_read_model')
@Index(['email'], { unique: true })
@Index(['status'])
export class UserEntity {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email!: string;

  @Column({ name: 'first_name', type: 'varchar', length: 100, nullable: true })
  firstName?: string;

  @Column({ name: 'last_name', type: 'varchar', length: 100, nullable: true })
  lastName?: string;

  @Column({ name: 'avatar_url', type: 'varchar', length: 500, nullable: true })
  avatarUrl?: string;

  @Column({
    type: 'varchar',
    length: 50,
    default: 'PendingVerification',
  })
  status!: 'Active' | 'Suspended' | 'PendingVerification';

  @Column({ name: 'social_links', type: 'jsonb', nullable: true })
  socialLinks?: Array<{
    provider: string;
    providerId: string;
    providerEmail?: string;
  }>;

  @Column({ name: 'mfa_enabled', type: 'boolean', default: false })
  mfaEnabled!: boolean;

  @Column({ name: 'password_changed_at', type: 'timestamp', nullable: true })
  passwordChangedAt?: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt!: Date;
}
