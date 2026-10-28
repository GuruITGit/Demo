import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { Organization } from './organization.entity';
import { Employee } from './employee.entity';
import { LeaveType } from './leave-type.entity';
import { User } from './user.entity';

@Entity('leave_requests')
export class LeaveRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id' })
  organizationId: string;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'request_number', length: 50 })
  requestNumber: string;

  @Column({ name: 'employee_id' })
  employeeId: string;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @Column({ name: 'leave_type_id' })
  leaveTypeId: string;

  @ManyToOne(() => LeaveType)
  @JoinColumn({ name: 'leave_type_id' })
  leaveType: LeaveType;

  @Column({ name: 'start_date', type: 'date' })
  startDate: Date;

  @Column({ name: 'end_date', type: 'date' })
  endDate: Date;

  @Column({ name: 'total_days', type: 'numeric', precision: 5, scale: 1 })
  totalDays: number;

  @Column({ type: 'text' })
  reason: string;

  @Column({ name: 'contact_during', length: 200, nullable: true })
  contactDuring: string;

  @Column({ name: 'delegate_id', nullable: true })
  delegateId: string;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'delegate_id' })
  delegate: Employee;

  @Column({ length: 30, default: 'รอการอนุมัติ' })
  status: string;

  @Column({ name: 'current_approver_id', nullable: true })
  currentApproverId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'current_approver_id' })
  currentApprover: User;

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt: Date;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
