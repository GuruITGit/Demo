import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  JoinColumn, CreateDateColumn,
} from 'typeorm';
import { Organization } from './organization.entity';
import { User } from './user.entity';

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id' })
  organizationId: string;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'recipient_id' })
  recipientId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'recipient_id' })
  recipient: User;

  @Column({ length: 100 })
  type: string;

  @Column({ length: 300 })
  title: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ name: 'action_url', length: 500, nullable: true })
  actionUrl: string;

  @Column({ name: 'ref_type', length: 100, nullable: true })
  refType: string;

  @Column({ name: 'ref_id', nullable: true })
  refId: string;

  @Column({ length: 20, default: 'in_app' })
  channel: string;

  @Column({ name: 'is_read', default: false })
  isRead: boolean;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt: Date;

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt: Date;

  @Column({ name: 'failed_at', type: 'timestamptz', nullable: true })
  failedAt: Date;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string;

  @Column({ length: 20, default: 'normal' })
  priority: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
