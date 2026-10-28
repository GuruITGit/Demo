import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn,
  CreateDateColumn, UpdateDateColumn, DeleteDateColumn,
} from 'typeorm';
import { Organization } from './organization.entity';
import { ApprovalRequestType } from './approval-request-type.entity';
import { User } from './user.entity';
import { Department } from './department.entity';
import { Division } from './division.entity';

export enum ApprovalStatus {
  DRAFT = 'ร่าง',
  REVIEWING = 'รอตรวจสอบ',
  IN_PROGRESS = 'อยู่ระหว่างพิจารณา',
  WAITING = 'รออนุมัติ',
  APPROVED = 'อนุมัติแล้ว',
  REJECTED = 'ไม่อนุมัติ',
  RETURNED = 'ส่งกลับแก้ไข',
  CANCELLED = 'ยกเลิก',
}

@Entity('approval_requests')
export class ApprovalRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id' })
  organizationId: string;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'request_number', length: 50 })
  requestNumber: string;

  @Column({ name: 'type_id' })
  typeId: string;

  @ManyToOne(() => ApprovalRequestType)
  @JoinColumn({ name: 'type_id' })
  type: ApprovalRequestType;

  @Column({ name: 'requester_id' })
  requesterId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'requester_id' })
  requester: User;

  @Column({ name: 'department_id' })
  departmentId: string;

  @ManyToOne(() => Department)
  @JoinColumn({ name: 'department_id' })
  department: Department;

  @Column({ name: 'division_id', nullable: true })
  divisionId: string;

  @ManyToOne(() => Division)
  @JoinColumn({ name: 'division_id' })
  division: Division;

  @Column({ length: 500 })
  subject: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ name: 'form_data', type: 'jsonb', default: '{}' })
  formData: Record<string, any>;

  @Column({ type: 'varchar', length: 50, default: ApprovalStatus.DRAFT })
  status: string;

  @Column({ name: 'current_approver_id', nullable: true })
  currentApproverId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'current_approver_id' })
  currentApprover: User;

  @Column({ name: 'current_level', type: 'smallint', default: 1 })
  currentLevel: number;

  @Column({ name: 'total_levels', type: 'smallint', default: 4 })
  totalLevels: number;

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt: Date;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt: Date;

  @Column({ name: 'rejected_at', type: 'timestamptz', nullable: true })
  rejectedAt: Date;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate: Date;

  @Column({ name: 'pdf_url', length: 500, nullable: true })
  pdfUrl: string;

  @Column({ name: 'budget_amount', type: 'numeric', precision: 15, scale: 2, nullable: true })
  budgetAmount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date;
}
