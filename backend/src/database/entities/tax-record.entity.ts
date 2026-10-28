import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { Organization } from './organization.entity';
import { User } from './user.entity';

@Entity('tax_records')
export class TaxRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id' })
  organizationId: string;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'tax_number', length: 50 })
  taxNumber: string;

  /** ประเภทภาษี: ที่ดินและสิ่งปลูกสร้าง, ป้าย, อื่นๆ */
  @Column({ name: 'tax_type', length: 100 })
  taxType: string;

  @Column({ name: 'fiscal_year', type: 'smallint' })
  fiscalYear: number;

  @Column({ name: 'taxpayer_id_card', length: 20, nullable: true })
  taxpayerIdCard: string;

  @Column({ name: 'taxpayer_name', length: 200 })
  taxpayerName: string;

  @Column({ name: 'taxpayer_phone', length: 20, nullable: true })
  taxpayerPhone: string;

  @Column({ name: 'property_address', type: 'text', nullable: true })
  propertyAddress: string;

  @Column({ name: 'property_area_sqm', type: 'numeric', precision: 12, scale: 4, nullable: true })
  propertyAreaSqm: number;

  @Column({ name: 'base_value', type: 'numeric', precision: 18, scale: 2, default: 0 })
  baseValue: number;

  @Column({ name: 'tax_rate', type: 'numeric', precision: 6, scale: 4, default: 0 })
  taxRate: number;

  @Column({ name: 'tax_amount', type: 'numeric', precision: 18, scale: 2, default: 0 })
  taxAmount: number;

  @Column({ name: 'penalty_amount', type: 'numeric', precision: 18, scale: 2, default: 0 })
  penaltyAmount: number;

  @Column({ name: 'total_amount', type: 'numeric', precision: 18, scale: 2, default: 0 })
  totalAmount: number;

  @Column({ name: 'paid_amount', type: 'numeric', precision: 18, scale: 2, default: 0 })
  paidAmount: number;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate: Date;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt: Date;

  @Column({ length: 50, default: 'รอชำระ' })
  status: string;

  @Column({ name: 'note', type: 'text', nullable: true })
  note: string;

  @Column({ name: 'collected_by', nullable: true })
  collectedById: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'collected_by' })
  collectedBy: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
