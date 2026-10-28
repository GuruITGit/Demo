import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  JoinColumn, UpdateDateColumn, Unique,
} from 'typeorm';
import { Employee } from './employee.entity';
import { LeaveType } from './leave-type.entity';

@Entity('leave_quotas')
@Unique(['employeeId', 'leaveTypeId', 'year'])
export class LeaveQuota {
  @PrimaryGeneratedColumn('uuid')
  id: string;

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

  @Column({ type: 'smallint' })
  year: number;

  @Column({ name: 'total_days', type: 'numeric', precision: 5, scale: 1 })
  totalDays: number;

  @Column({ name: 'used_days', type: 'numeric', precision: 5, scale: 1, default: 0 })
  usedDays: number;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  get remainingDays(): number {
    return this.totalDays - this.usedDays;
  }
}
