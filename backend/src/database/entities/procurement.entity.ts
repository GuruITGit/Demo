import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { Organization } from './organization.entity';
import { User } from './user.entity';
import { Department } from './department.entity';

@Entity('procurements')
export class Procurement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id' })
  organizationId: string;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'procurement_number', length: 50 })
  procurementNumber: string;

  @Column({ length: 500 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  /** วิธีจัดซื้อ: เฉพาะเจาะจง, e-Bidding, คัดเลือก */
  @Column({ name: 'method', length: 100, default: 'เฉพาะเจาะจง' })
  method: string;

  @Column({ name: 'budget_source', length: 200, nullable: true })
  budgetSource: string;

  @Column({ name: 'estimated_amount', type: 'numeric', precision: 18, scale: 2, default: 0 })
  estimatedAmount: number;

  @Column({ name: 'final_amount', type: 'numeric', precision: 18, scale: 2, nullable: true })
  finalAmount: number;

  @Column({ name: 'vendor_name', length: 300, nullable: true })
  vendorName: string;

  @Column({ name: 'vendor_tax_id', length: 20, nullable: true })
  vendorTaxId: string;

  @Column({ name: 'fiscal_year', type: 'smallint' })
  fiscalYear: number;

  @Column({ name: 'dept_id', nullable: true })
  deptId: string;

  @ManyToOne(() => Department, { nullable: true })
  @JoinColumn({ name: 'dept_id' })
  department: Department;

  @Column({ name: 'plan_date', type: 'date', nullable: true })
  planDate: Date;

  @Column({ name: 'announce_date', type: 'date', nullable: true })
  announceDate: Date;

  @Column({ name: 'contract_date', type: 'date', nullable: true })
  contractDate: Date;

  @Column({ name: 'complete_date', type: 'date', nullable: true })
  completeDate: Date;

  @Column({ length: 50, default: 'แผน' })
  status: string;

  @Column({ name: 'created_by', nullable: true })
  createdById: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdBy: User;

  @Column({ name: 'approved_by', nullable: true })
  approvedById: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'approved_by' })
  approvedBy: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
