import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
} from 'typeorm';

@Entity('approval_request_types')
export class ApprovalRequestType {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', nullable: true })
  organizationId: string;

  @Column({ unique: true, length: 50 })
  code: string;

  @Column({ name: 'name_th', length: 200 })
  nameTh: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'form_template', type: 'jsonb', default: '{}' })
  formTemplate: Record<string, any>;

  @Column({ name: 'approval_levels', type: 'smallint', default: 4 })
  approvalLevels: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
