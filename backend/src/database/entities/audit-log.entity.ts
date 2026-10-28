import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index,
} from 'typeorm';

@Entity('audit_logs')
@Index(['userId', 'actedAt'])
@Index(['resourceType', 'resourceId'])
@Index(['action', 'module'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', nullable: true })
  organizationId: string;

  @Column({ name: 'user_id', nullable: true })
  userId: string;

  @Column({ name: 'user_name', length: 200, nullable: true })
  userName: string;

  @Column({ name: 'ip_address', type: 'inet', nullable: true })
  ipAddress: string;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent: string;

  @Column({ length: 100 })
  action: string;

  @Column({ length: 100 })
  module: string;

  @Column({ name: 'resource_type', length: 100, nullable: true })
  resourceType: string;

  @Column({ name: 'resource_id', nullable: true })
  resourceId: string;

  @Column({ name: 'resource_title', length: 500, nullable: true })
  resourceTitle: string;

  @Column({ name: 'old_values', type: 'jsonb', nullable: true })
  oldValues: Record<string, any>;

  @Column({ name: 'new_values', type: 'jsonb', nullable: true })
  newValues: Record<string, any>;

  @Column({ length: 20, default: 'success' })
  status: string;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string;

  @CreateDateColumn({ name: 'acted_at' })
  actedAt: Date;
}
