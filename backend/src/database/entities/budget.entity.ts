import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { Organization } from './organization.entity';
import { User } from './user.entity';
import { Department } from './department.entity';

@Entity('budgets')
export class Budget {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id' })
  organizationId: string;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'budget_number', length: 50 })
  budgetNumber: string;

  @Column({ length: 300 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  /** ปีงบประมาณ พ.ศ. เช่น 2567 */
  @Column({ name: 'fiscal_year', type: 'smallint' })
  fiscalYear: number;

  @Column({ name: 'budget_type', length: 100, default: 'ดำเนินงาน' })
  budgetType: string;

  @Column({ name: 'dept_id', nullable: true })
  deptId: string;

  @ManyToOne(() => Department, { nullable: true })
  @JoinColumn({ name: 'dept_id' })
  department: Department;

  @Column({ name: 'allocated_amount', type: 'numeric', precision: 18, scale: 2, default: 0 })
  allocatedAmount: number;

  @Column({ name: 'used_amount', type: 'numeric', precision: 18, scale: 2, default: 0 })
  usedAmount: number;

  @Column({ name: 'remaining_amount', type: 'numeric', precision: 18, scale: 2, default: 0 })
  remainingAmount: number;

  @Column({ length: 50, default: 'อนุมัติ' })
  status: string;

  @Column({ name: 'approved_by', nullable: true })
  approvedById: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'approved_by' })
  approvedBy: User;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt: Date;

  @Column({ name: 'created_by', nullable: true })
  createdById: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdBy: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
