import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { Organization } from './organization.entity';
import { ComplaintCategory } from './complaint-category.entity';
import { Department } from './department.entity';
import { User } from './user.entity';

@Entity('complaints')
export class Complaint {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id' })
  organizationId: string;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'complaint_number', unique: true, length: 50 })
  complaintNumber: string;

  @Column({ name: 'tracking_code', unique: true, length: 20 })
  trackingCode: string;

  @Column({ name: 'category_id', nullable: true })
  categoryId: string;

  @ManyToOne(() => ComplaintCategory)
  @JoinColumn({ name: 'category_id' })
  category: ComplaintCategory;

  @Column({ name: 'is_anonymous', default: false })
  isAnonymous: boolean;

  @Column({ name: 'complainant_name', length: 200, nullable: true })
  complainantName: string;

  @Column({ name: 'complainant_phone', length: 20, nullable: true })
  complainantPhone: string;

  @Column({ name: 'complainant_email', length: 200, nullable: true })
  complainantEmail: string;

  @Column({ name: 'complainant_address', type: 'text', nullable: true })
  complainantAddress: string;

  @Column({ name: 'user_id', nullable: true })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ length: 500 })
  subject: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'text', nullable: true })
  location: string;

  @Column({ name: 'incident_date', type: 'date', nullable: true })
  incidentDate: Date;

  @Column({ length: 50, default: 'รอรับเรื่อง' })
  status: string;

  @Column({ length: 20, default: 'ปกติ' })
  priority: string;

  @Column({ name: 'assigned_dept_id', nullable: true })
  assignedDeptId: string;

  @ManyToOne(() => Department)
  @JoinColumn({ name: 'assigned_dept_id' })
  assignedDept: Department;

  @Column({ name: 'assigned_user_id', nullable: true })
  assignedUserId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'assigned_user_id' })
  assignedUser: User;

  @Column({ name: 'assigned_at', type: 'timestamptz', nullable: true })
  assignedAt: Date;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate: Date;

  @Column({ name: 'result_summary', type: 'text', nullable: true })
  resultSummary: string;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date;

  @Column({ name: 'satisfaction_score', type: 'smallint', nullable: true })
  satisfactionScore: number;

  @Column({ name: 'satisfaction_note', type: 'text', nullable: true })
  satisfactionNote: string;

  @Column({ name: 'rated_at', type: 'timestamptz', nullable: true })
  ratedAt: Date;

  @Column({ name: 'received_by', nullable: true })
  receivedBy: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'received_by' })
  receiver: User;

  @Column({ name: 'received_at', type: 'timestamptz', default: () => 'NOW()' })
  receivedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
