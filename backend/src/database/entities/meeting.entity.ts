import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn,
  CreateDateColumn, UpdateDateColumn, DeleteDateColumn,
} from 'typeorm';
import { Organization } from './organization.entity';
import { Department } from './department.entity';
import { User } from './user.entity';

@Entity('meetings')
export class Meeting {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id' })
  organizationId: string;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'meeting_number', length: 50 })
  meetingNumber: string;

  @Column({ length: 500 })
  title: string;

  @Column({ length: 50, default: 'ประชุมทั่วไป' })
  type: string;

  @Column({ length: 300, nullable: true })
  location: string;

  @Column({ name: 'is_online', default: false })
  isOnline: boolean;

  @Column({ name: 'meeting_url', length: 500, nullable: true })
  meetingUrl: string;

  @Column({ name: 'start_datetime', type: 'timestamptz' })
  startDatetime: Date;

  @Column({ name: 'end_datetime', type: 'timestamptz' })
  endDatetime: Date;

  @Column({ name: 'actual_start', type: 'timestamptz', nullable: true })
  actualStart: Date;

  @Column({ name: 'actual_end', type: 'timestamptz', nullable: true })
  actualEnd: Date;

  @Column({ name: 'chair_id' })
  chairId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'chair_id' })
  chair: User;

  @Column({ name: 'secretary_id', nullable: true })
  secretaryId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'secretary_id' })
  secretary: User;

  @Column({ length: 30, default: 'กำหนดการ' })
  status: string;

  @Column({ name: 'minutes_text', type: 'text', nullable: true })
  minutesText: string;

  @Column({ name: 'minutes_pdf_url', length: 500, nullable: true })
  minutesPdfUrl: string;

  @Column({ name: 'minutes_approved_at', type: 'timestamptz', nullable: true })
  minutesApprovedAt: Date;

  @Column({ name: 'department_id', nullable: true })
  departmentId: string;

  @ManyToOne(() => Department)
  @JoinColumn({ name: 'department_id' })
  department: Department;

  @Column({ name: 'created_by' })
  createdBy: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  creator: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date;
}
