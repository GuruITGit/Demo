import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
} from 'typeorm';

@Entity('leave_types')
export class LeaveType {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', nullable: true })
  organizationId: string;

  @Column({ unique: true, length: 30 })
  code: string;

  @Column({ name: 'name_th', length: 100 })
  nameTh: string;

  @Column({ name: 'max_days_year', type: 'smallint', nullable: true })
  maxDaysYear: number;

  @Column({ name: 'requires_doc', default: false })
  requiresDoc: boolean;

  @Column({ name: 'advance_days', type: 'smallint', default: 0 })
  advanceDays: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
